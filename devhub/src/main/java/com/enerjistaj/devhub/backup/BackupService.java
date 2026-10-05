package com.enerjistaj.devhub.backup;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.realtime.RealtimeService;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Veritabanı yedeği. Ek araç (mysqldump) gerekmez: tablolar JDBC ile okunup tek dosyalık, sıkıştırılmış bir SQL dökümüne yazılır.
 * Her satır tek bir SQL komutudur (metinlerdeki satır sonları kaçışlıdır); geri yükleme dosyayı satır satır çalıştırır.
 * <p>
 * Dosyalar {@code devhub.backup.dir} klasöründedir (Docker'da bilgisayardaki {@code devhub/backups} klasörüne bağlıdır, container
 * silinse de kaybolmaz). Otomatik yedek her saat kontrol edilir: son otomatik yedek {@code interval-days} günden eskiyse yenisi
 * alınır, böylece bilgisayar o saatte kapalı olsa bile yedek kaçmaz. Otomatik yedeklerin en yeni {@code keep-auto} tanesi tutulur;
 * elle alınanlar yalnızca yönetici silince silinir.
 * <p>
 * Geri yükleme yalnızca aynı şema sürümündeki yedekten yapılır (eski bir sürümün tabloları uygulamayla uyuşmaz). Önce o anki
 * durumun yedeği alınır, sonra bütün tablolar yedektekiyle değiştirilir ve herkesin oturumu kapatılır.
 */
@Slf4j
@Service
public class BackupService {

    public enum Kind {
        OTOMATIK("otomatik", "Otomatik"), ELLE("elle", "Elle"), GERI_YUKLEME_ONCESI("geri-yukleme-oncesi", "Geri yükleme öncesi"),
        YUKLENEN("yuklenen", "Yüklenen dosya");

        final String slug;
        final String label;

        Kind(String slug, String label) { this.slug = slug; this.label = label; }

        static Kind ofSlug(String s) {
            for (Kind k : values()) if (k.slug.equals(s)) return k;
            return null;
        }
    }

    public record BackupInfo(String name, Kind kind, String kindLabel, LocalDateTime createdAt, long sizeBytes,
                             Integer schemaVersion, String createdBy, boolean restorable) {}

    private static final Pattern NAME = Pattern.compile("^devhub-(\\d{4}-\\d{2}-\\d{2}_\\d{6})-(otomatik|elle|geri-yukleme-oncesi|yuklenen)\\.sql\\.gz$");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");
    private static final String MAGIC = "-- DevHub yedeği";
    private static final int ROWS_PER_INSERT = 200;

    private final DataSource dataSource;
    private final ActionLogService actionLog;
    private final NotificationService notifications;
    private final RealtimeService realtime;
    private final Path dir;
    private final int intervalDays;
    private final int keepAuto;
    private final ReentrantLock lock = new ReentrantLock();

    public BackupService(DataSource dataSource, ActionLogService actionLog, NotificationService notifications, RealtimeService realtime,
                         @Value("${devhub.backup.dir:backups}") String dir,
                         @Value("${devhub.backup.interval-days:3}") int intervalDays,
                         @Value("${devhub.backup.keep-auto:10}") int keepAuto) {
        this.dataSource = dataSource;
        this.actionLog = actionLog;
        this.notifications = notifications;
        this.realtime = realtime;
        this.dir = Paths.get(dir).toAbsolutePath();
        this.intervalDays = Math.max(1, intervalDays);
        this.keepAuto = Math.max(1, keepAuto);
    }

    public int intervalDays() { return intervalDays; }

    public int keepAuto() { return keepAuto; }

    // ------------------------------------------------------------------ liste

    public List<BackupInfo> list() {
        if (!Files.isDirectory(dir)) return List.of();
        int current = currentSchemaVersion();
        try (Stream<Path> files = Files.list(dir)) {
            return files.map(p -> info(p, current)).filter(Objects::nonNull)
                .sorted(Comparator.comparing(BackupInfo::createdAt).reversed()).toList();
        } catch (IOException e) {
            throw ApiException.badRequest("Yedek klasörü okunamadı.");
        }
    }

    /** Son otomatik yedeğin zamanı (UTC); hiç yoksa null. */
    public LocalDateTime lastAutomatic() {
        return list().stream().filter(b -> b.kind() == Kind.OTOMATIK).map(BackupInfo::createdAt).findFirst().orElse(null);
    }

    public Path file(String name) {
        if (name == null || !NAME.matcher(name).matches()) throw ApiException.notFound("Yedek");
        Path p = dir.resolve(name);
        if (!Files.isRegularFile(p)) throw ApiException.notFound("Yedek");
        return p;
    }

    private BackupInfo info(Path p, int currentVersion) {
        Matcher m = NAME.matcher(p.getFileName().toString());
        if (!m.matches()) return null;
        try {
            LocalDateTime at = LocalDateTime.parse(m.group(1), STAMP);
            Map<String, String> header = header(p);
            Integer version = header.containsKey("sema") ? Integer.valueOf(header.get("sema")) : null;
            return new BackupInfo(p.getFileName().toString(), Kind.ofSlug(m.group(2)), Kind.ofSlug(m.group(2)).label, at,
                Files.size(p), version, header.get("alan"), version != null && version == currentVersion);
        } catch (Exception e) {
            return null;
        }
    }

    /** Dosyanın başındaki "-- anahtar: değer" satırları. */
    private static Map<String, String> header(Path p) throws IOException {
        Map<String, String> out = new HashMap<>();
        try (BufferedReader r = reader(p)) {
            String first = r.readLine();
            if (first == null || !first.startsWith(MAGIC)) return out;
            String line;
            while ((line = r.readLine()) != null && line.startsWith("-- ")) {
                int i = line.indexOf(':');
                if (i > 3) out.put(line.substring(3, i).trim(), line.substring(i + 1).trim());
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ yedek alma

    /** Elle yedek (yönetici). */
    public BackupInfo createManual(User by) {
        BackupInfo b = create(Kind.ELLE, by);
        actionLog.record(LogCategory.SISTEM, LogAction.YEDEKLEME, "Veritabanı yedeği alındı").by(by)
            .target("YEDEK", null, b.name()).detail("Dosya: " + b.name()).detail("Boyut: " + size(b.sizeBytes())).save();
        return b;
    }

    /** Saatte bir: son otomatik yedek aralıktan eskiyse yenisini alır (ilk kontrol açılıştan 2 dakika sonra). */
    @Scheduled(initialDelay = 120_000, fixedDelay = 3_600_000)
    public void automatic() {
        BackupInfo latest = list().stream().filter(b -> b.kind() == Kind.OTOMATIK).findFirst().orElse(null);
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        // 1 saatlik pay: tam 3. günde, kontrol saati yüzünden bir sonraki saate kaymasın.
        boolean due = latest == null || !latest.createdAt().plusDays(intervalDays).minusHours(1).isAfter(now);
        // Uygulama güncellenip şema değiştiyse eski yedekler geri yüklenemez: hemen yeni sürümün yedeği alınır.
        boolean schemaChanged = latest != null && !latest.restorable();
        if (!due && !schemaChanged) return;
        try {
            BackupInfo b = create(Kind.OTOMATIK, null);
            prune();
            actionLog.record(LogCategory.SISTEM, LogAction.YEDEKLEME, "Otomatik veritabanı yedeği alındı")
                .target("YEDEK", null, b.name()).detail("Dosya: " + b.name()).detail("Boyut: " + size(b.sizeBytes()))
                .detail("Sıklık: " + intervalDays + " günde bir; en yeni " + keepAuto + " otomatik yedek saklanır").save();
            realtime.invalidate(List.of("backups"), null);
        } catch (Exception e) {
            log.error("Otomatik yedek alınamadı", e);
            actionLog.record(LogCategory.SISTEM, LogAction.YEDEKLEME, "Otomatik yedek alınamadı").detail("Hata: " + e.getMessage())
                .level(LogLevel.KRITIK).save();
            notifications.notifyAdmins(null, NotificationType.BACKUP_FAILED, "Otomatik yedek alınamadı",
                "Yedekler sayfasından elle yedek almayı deneyin.", "/backups");
        }
    }

    public BackupInfo create(Kind kind, User by) {
        if (!lock.tryLock()) throw ApiException.conflict("Şu anda başka bir yedekleme ya da geri yükleme sürüyor. Biraz sonra tekrar deneyin.");
        try {
            Files.createDirectories(dir);
            String name = "devhub-" + LocalDateTime.now(ZoneOffset.UTC).format(STAMP) + "-" + kind.slug + ".sql.gz";
            Path target = dir.resolve(name);
            Path tmp = dir.resolve(name + ".part");
            try (Connection c = dataSource.getConnection();
                 Writer w = new BufferedWriter(new OutputStreamWriter(new GZIPOutputStream(Files.newOutputStream(tmp)), StandardCharsets.UTF_8))) {
                dump(c, w, kind, by);
            } catch (Exception e) {
                Files.deleteIfExists(tmp);
                throw e;
            }
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
            return info(target, currentSchemaVersion());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Yedek alınamadı", e);
            throw ApiException.badRequest("Yedek alınamadı: " + e.getMessage());
        } finally {
            lock.unlock();
        }
    }

    private void dump(Connection c, Writer w, Kind kind, User by) throws SQLException, IOException {
        w.write(MAGIC + "\n");
        w.write("-- sema: " + currentSchemaVersion(c) + "\n");
        w.write("-- tarih: " + LocalDateTime.now(ZoneOffset.UTC) + "Z\n");
        w.write("-- tur: " + kind.slug + "\n");
        if (by != null) w.write("-- alan: " + by.getFullName().replace("\n", " ") + "\n");
        w.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\n");
        for (String table : tables(c)) {
            try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SHOW CREATE TABLE `" + table + "`")) {
                rs.next();
                w.write("DROP TABLE IF EXISTS `" + table + "`;\n");
                w.write(rs.getString(2).replace("\r", " ").replace("\n", " ") + ";\n");
            }
            try (Statement s = c.createStatement(ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
                s.setFetchSize(Integer.MIN_VALUE); // MySQL: satırları akıtarak oku, bütün tabloyu belleğe alma
                try (ResultSet rs = s.executeQuery("SELECT * FROM `" + table + "`")) {
                    ResultSetMetaData md = rs.getMetaData();
                    int cols = md.getColumnCount();
                    StringBuilder cols0 = new StringBuilder();
                    for (int i = 1; i <= cols; i++) cols0.append(i > 1 ? "," : "").append('`').append(md.getColumnName(i)).append('`');
                    int n = 0;
                    while (rs.next()) {
                        w.write(n == 0 ? "INSERT INTO `" + table + "` (" + cols0 + ") VALUES " : ",");
                        w.write('(');
                        for (int i = 1; i <= cols; i++) {
                            if (i > 1) w.write(',');
                            w.write(literal(rs, i, md.getColumnType(i)));
                        }
                        w.write(')');
                        if (++n == ROWS_PER_INSERT) {
                            w.write(";\n");
                            n = 0;
                        }
                    }
                    if (n > 0) w.write(";\n");
                }
            }
        }
        w.write("SET UNIQUE_CHECKS=1;\nSET FOREIGN_KEY_CHECKS=1;\n");
    }

    private static String literal(ResultSet rs, int i, int type) throws SQLException {
        switch (type) {
            case Types.BIT, Types.BOOLEAN -> {
                boolean v = rs.getBoolean(i);
                return rs.wasNull() ? "NULL" : (v ? "1" : "0");
            }
            case Types.TINYINT, Types.SMALLINT, Types.INTEGER, Types.BIGINT, Types.DECIMAL, Types.NUMERIC, Types.FLOAT, Types.REAL, Types.DOUBLE -> {
                String v = rs.getString(i);
                return v == null ? "NULL" : v;
            }
            case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY, Types.BLOB -> {
                byte[] b = rs.getBytes(i);
                if (b == null) return "NULL";
                if (b.length == 0) return "''";
                return "X'" + HexFormat.of().formatHex(b) + "'";
            }
            default -> {
                String v = rs.getString(i);
                return v == null ? "NULL" : quote(v);
            }
        }
    }

    static String quote(String v) {
        StringBuilder sb = new StringBuilder(v.length() + 8).append('\'');
        for (int k = 0; k < v.length(); k++) {
            char ch = v.charAt(k);
            switch (ch) {
                case '\\' -> sb.append("\\\\");
                case '\'' -> sb.append("\\'");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\0' -> sb.append("\\0");
                case 26 -> sb.append("\\Z");
                default -> sb.append(ch);
            }
        }
        return sb.append('\'').toString();
    }

    private static List<String> tables(Connection c) throws SQLException {
        List<String> out = new ArrayList<>();
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    /** Otomatik yedeklerin en yeni keepAuto tanesi kalır. */
    private void prune() {
        list().stream().filter(b -> b.kind() == Kind.OTOMATIK).skip(keepAuto).forEach(b -> {
            try {
                Files.deleteIfExists(dir.resolve(b.name()));
            } catch (IOException e) {
                log.warn("Eski yedek silinemedi: {}", b.name());
            }
        });
    }

    // ------------------------------------------------------------------ silme, yükleme, geri yükleme

    public void delete(String name, User by) {
        Path p = file(name);
        try {
            Files.delete(p);
        } catch (IOException e) {
            throw ApiException.badRequest("Yedek silinemedi.");
        }
        actionLog.record(LogCategory.SISTEM, LogAction.SILME, "Veritabanı yedeği silindi").by(by).target("YEDEK", null, name)
            .detail("Dosya: " + name).level(LogLevel.UYARI).save();
    }

    /** Başka bir yerden indirilmiş yedeği klasöre alır (ör. bilgisayar değişti). Dosyanın DevHub yedeği olduğu denetlenir. */
    public BackupInfo upload(InputStream in, User by) {
        try {
            Files.createDirectories(dir);
            String name = "devhub-" + LocalDateTime.now(ZoneOffset.UTC).format(STAMP) + "-" + Kind.YUKLENEN.slug + ".sql.gz";
            Path tmp = dir.resolve(name + ".part");
            Files.copy(in, tmp, StandardCopyOption.REPLACE_EXISTING);
            Map<String, String> h;
            try {
                h = header(tmp);
            } catch (IOException e) {
                h = Map.of();
            }
            if (!h.containsKey("sema")) {
                Files.deleteIfExists(tmp);
                throw ApiException.badRequest("Bu dosya bir DevHub yedeği değil. Yedekler sayfasından indirilen .sql.gz dosyasını seçin.");
            }
            Path target = dir.resolve(name);
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
            BackupInfo b = info(target, currentSchemaVersion());
            actionLog.record(LogCategory.SISTEM, LogAction.YEDEKLEME, "Yedek dosyası yüklendi").by(by).target("YEDEK", null, name)
                .detail("Boyut: " + size(b.sizeBytes())).save();
            return b;
        } catch (IOException e) {
            throw ApiException.badRequest("Dosya kaydedilemedi.");
        }
    }

    /**
     * Seçilen yedeği geri yükler. Önce şimdiki durumun yedeği alınır (yanlışlıkla geri yüklenirse oradan dönülür), sonra bütün
     * tablolar silinip yedektekiler yazılır ve herkesin oturumu kapatılır (yedekteki kullanıcı ve şifrelerle yeniden girilir).
     */
    public BackupInfo restore(String name, User by) {
        Path p = file(name);
        BackupInfo chosen = info(p, currentSchemaVersion());
        if (chosen == null || !chosen.restorable()) {
            throw ApiException.conflict("Bu yedek uygulamanın başka bir sürümüne ait (şema " + (chosen != null ? chosen.schemaVersion() : "?")
                + ", şu an " + currentSchemaVersion() + "). Yalnızca aynı sürümün yedekleri geri yüklenebilir.");
        }
        BackupInfo safety = create(Kind.GERI_YUKLEME_ONCESI, by);
        if (!lock.tryLock()) throw ApiException.conflict("Şu anda başka bir yedekleme ya da geri yükleme sürüyor.");
        try (Connection c = dataSource.getConnection(); BufferedReader r = reader(p)) {
            c.setAutoCommit(true);
            try (Statement s = c.createStatement()) {
                s.execute("SET FOREIGN_KEY_CHECKS=0");
                for (String t : tables(c)) s.execute("DROP TABLE IF EXISTS `" + t + "`");
                String line;
                while ((line = r.readLine()) != null) {
                    if (line.isBlank() || line.startsWith("--")) continue;
                    s.execute(line.endsWith(";") ? line.substring(0, line.length() - 1) : line);
                }
                s.execute("SET FOREIGN_KEY_CHECKS=1");
                // Eski token'lar geçersiz: herkes yedekteki hesabıyla yeniden giriş yapar.
                s.executeUpdate("UPDATE users SET session_version = session_version + 1");
            }
        } catch (Exception e) {
            log.error("Geri yükleme başarısız", e);
            throw ApiException.badRequest("Geri yükleme yarıda kaldı: " + e.getMessage()
                + ". Veriler bozulduysa \"" + safety.name() + "\" yedeğini geri yükleyin.");
        } finally {
            lock.unlock();
        }
        actionLog.record(LogCategory.SISTEM, LogAction.GERI_YUKLEME, "Veritabanı yedekten geri yüklendi").by(null)
            .target("YEDEK", null, name)
            .detail("Geri yükleyen: " + by.getFullName() + " (" + by.getEmail() + ")")
            .detail("Yedek: " + name)
            .detail("Önceki durumun yedeği: " + safety.name())
            .detail("Bütün oturumlar kapatıldı").level(LogLevel.KRITIK).save();
        return chosen;
    }

    // ------------------------------------------------------------------ yardımcılar

    private int currentSchemaVersion() {
        try (Connection c = dataSource.getConnection()) {
            return currentSchemaVersion(c);
        } catch (SQLException e) {
            return -1;
        }
    }

    private static int currentSchemaVersion(Connection c) throws SQLException {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private static BufferedReader reader(Path p) throws IOException {
        return new BufferedReader(new InputStreamReader(new GZIPInputStream(Files.newInputStream(p)), StandardCharsets.UTF_8));
    }

    static String size(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(Locale.ROOT, "%.1f KB", bytes / 1024.0);
        return String.format(Locale.ROOT, "%.1f MB", bytes / (1024.0 * 1024));
    }
}
