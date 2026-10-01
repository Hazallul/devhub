package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.LogDto;
import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ActionLogRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.util.XlsxWriter;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Sistem logları. Yönetici her şeyi arar, süzer, istatistiğini görür ve CSV olarak indirir.
 * Çalışanlar yalnızca ekip akışını görür (projeler, görevler, duyurular ve durum değişiklikleri; IP adresi olmadan).
 */
@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class ActionLogController {

    private static final String ONLY_ADMIN = "Ayrıntılı sistem loglarını yalnızca yöneticiler görebilir.";
    private static final Set<LogCategory> TEAM_FEED = EnumSet.of(LogCategory.PROJE, LogCategory.GOREV, LogCategory.DUYURU);
    private static final Sort NEWEST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
    private static final DateTimeFormatter CSV_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss");

    private final ActionLogRepository logs;
    private final CurrentUser currentUser;

    public record LogPage(List<LogDto> items, long total, int page, int size) {}

    public record DayCount(LocalDate date, long count, long warnings) {}

    public record ActorCount(Long actorId, String name, long count) {}

    public record Stats(long total, long today, long failedLogins24h, long critical7d, List<DayCount> perDay,
                        Map<LogCategory, Long> byCategory, List<ActorCount> topActors) {}

    /** Son 200 kayıt. Çalışan için yalnızca ekip akışı. */
    @GetMapping
    public ResponseEntity<List<LogDto>> feed() {
        boolean admin = CurrentUser.isAdmin(currentUser.get());
        return ResponseEntity.ok(logs.findTop200ByOrderByCreatedAtDescIdDesc().stream()
            .filter(l -> admin || teamVisible(l))
            .map(l -> admin ? LogDto.from(l) : LogDto.from(l).withoutIp())
            .toList());
    }

    /** Süzme ve sayfalama: kategori, seviye, işlem, kişi, tarih aralığı (İstanbul günü) ve serbest metin. */
    @GetMapping("/search")
    public ResponseEntity<LogPage> search(@RequestParam(required = false) LogCategory category,
                                          @RequestParam(required = false) LogLevel level,
                                          @RequestParam(required = false) LogAction action,
                                          @RequestParam(required = false) Long actorId,
                                          @RequestParam(required = false) String from,
                                          @RequestParam(required = false) String to,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(required = false) Integer sinceHours,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        currentUser.requireAdmin(ONLY_ADMIN);
        int safeSize = Math.max(1, Math.min(size, 100));
        Page<ActionLog> result = logs.findAll(spec(category, level, action, actorId, from, to, q, sinceHours), PageRequest.of(Math.max(page, 0), safeSize, NEWEST));
        return ResponseEntity.ok(new LogPage(result.getContent().stream().map(LogDto::from).toList(), result.getTotalElements(), result.getNumber(), safeSize));
    }

    /** Özet: günlük kayıt sayıları, kategorilere dağılım, başarısız girişler, kritik işlemler ve en aktif kişiler. */
    @GetMapping("/stats")
    public ResponseEntity<Stats> stats(@RequestParam(defaultValue = "14") int days) {
        currentUser.requireAdmin(ONLY_ADMIN);
        int span = Math.max(1, Math.min(days, 60));
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        LocalDate first = today.minusDays(span - 1L);
        List<ActionLog> recent = logs.findByCreatedAtGreaterThanEqual(utc(first.atStartOfDay()));

        Map<LocalDate, List<ActionLog>> byDay = recent.stream().collect(Collectors.groupingBy(l -> localDay(l.getCreatedAt())));
        List<DayCount> perDay = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(today); d = d.plusDays(1)) {
            List<ActionLog> list = byDay.getOrDefault(d, List.of());
            perDay.add(new DayCount(d, list.size(), list.stream().filter(l -> l.getLevel() != LogLevel.BILGI).count()));
        }
        Map<LogCategory, Long> byCategory = new EnumMap<>(LogCategory.class);
        for (LogCategory c : LogCategory.values()) byCategory.put(c, 0L);
        recent.forEach(l -> byCategory.merge(l.getCategory(), 1L, Long::sum));

        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        long failed = recent.stream().filter(l -> l.getAction() == LogAction.GIRIS_BASARISIZ && l.getCreatedAt().isAfter(nowUtc.minusHours(24))).count();
        long critical = recent.stream().filter(l -> l.getLevel() == LogLevel.KRITIK && l.getCreatedAt().isAfter(nowUtc.minusDays(7))).count();
        List<ActorCount> top = recent.stream().filter(l -> l.getActor() != null)
            .collect(Collectors.groupingBy(l -> l.getActor().getId(), Collectors.toList())).values().stream()
            .map(list -> new ActorCount(list.get(0).getActor().getId(), list.get(0).getActor().getFullName(), list.size()))
            .sorted(Comparator.comparingLong(ActorCount::count).reversed()).limit(5).toList();

        return ResponseEntity.ok(new Stats(recent.size(), byDay.getOrDefault(today, List.of()).size(), failed, critical, perDay, byCategory, top));
    }

    /** Süzülmüş kayıtları (en fazla 5000) Excel'in doğrudan açabileceği CSV olarak indirir. */
    /**
     * Süzülmüş kayıtları indirir (en fazla 5000). format=xlsx: biçimlendirilmiş Excel dosyası (sabit ve filtreli başlık,
     * Türkçe etiketler, gerçek tarih, satır satır ayrıntılar). format=csv: standart virgüllü CSV (UTF-8 BOM'lu), başka araçlar için.
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) LogCategory category,
                                         @RequestParam(required = false) LogLevel level,
                                         @RequestParam(required = false) LogAction action,
                                         @RequestParam(required = false) Long actorId,
                                         @RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) Integer sinceHours,
                                         @RequestParam(defaultValue = "xlsx") String format) {
        currentUser.requireAdmin(ONLY_ADMIN);
        List<ActionLog> rows = logs.findAll(spec(category, level, action, actorId, from, to, q, sinceHours), PageRequest.of(0, 5000, NEWEST)).getContent();
        String stamp = LocalDateTime.now(ActionLogService.ZONE).format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"));
        if ("csv".equalsIgnoreCase(format)) {
            StringBuilder csv = new StringBuilder("\uFEFF"); // Türkçe karakterler doğru okunsun
            csv.append(String.join(",", EXPORT_HEADERS)).append("\r\n");
            for (ActionLog l : rows) {
                csv.append(l.getId()).append(',')
                    .append(localTime(l.getCreatedAt()).format(CSV_TIME)).append(',')
                    .append(csvCell(l.getLevel().label())).append(',')
                    .append(csvCell(l.getCategory().label())).append(',')
                    .append(csvCell(l.getAction().label())).append(',')
                    .append(csvCell(actorLabel(l))).append(',')
                    .append(csvCell(l.getMessage())).append(',')
                    .append(csvCell(l.getTargetName())).append(',')
                    .append(csvCell(l.getDetails())).append(',')
                    .append(csvCell(l.getIpAddress())).append("\r\n");
            }
            return download(csv.toString().getBytes(StandardCharsets.UTF_8), "devhub-loglar-" + stamp + ".csv", new MediaType("text", "csv", StandardCharsets.UTF_8));
        }

        List<XlsxWriter.Column> cols = List.of(
            new XlsxWriter.Column(EXPORT_HEADERS.get(0), 10, false), new XlsxWriter.Column(EXPORT_HEADERS.get(1), 19, false),
            new XlsxWriter.Column(EXPORT_HEADERS.get(2), 10, false), new XlsxWriter.Column(EXPORT_HEADERS.get(3), 12, false),
            new XlsxWriter.Column(EXPORT_HEADERS.get(4), 18, false), new XlsxWriter.Column(EXPORT_HEADERS.get(5), 20, true),
            new XlsxWriter.Column(EXPORT_HEADERS.get(6), 52, true), new XlsxWriter.Column(EXPORT_HEADERS.get(7), 30, true),
            new XlsxWriter.Column(EXPORT_HEADERS.get(8), 62, true), new XlsxWriter.Column(EXPORT_HEADERS.get(9), 15, false));
        List<List<XlsxWriter.Cell>> data = new ArrayList<>(rows.size());
        for (ActionLog l : rows) {
            int levelStyle = l.getLevel() == LogLevel.KRITIK ? XlsxWriter.CRITICAL : l.getLevel() == LogLevel.UYARI ? XlsxWriter.WARNING : XlsxWriter.TEXT;
            data.add(List.of(
                new XlsxWriter.Cell(l.getId(), XlsxWriter.NUMBER),
                new XlsxWriter.Cell(localTime(l.getCreatedAt()), XlsxWriter.DATE),
                new XlsxWriter.Cell(l.getLevel().label(), levelStyle),
                XlsxWriter.Cell.text(l.getCategory().label()),
                XlsxWriter.Cell.text(l.getAction().label()),
                XlsxWriter.Cell.text(actorLabel(l)),
                XlsxWriter.Cell.text(l.getMessage()),
                XlsxWriter.Cell.text(l.getTargetName()),
                XlsxWriter.Cell.text(l.getDetails()),
                XlsxWriter.Cell.text(l.getIpAddress())));
        }
        return download(XlsxWriter.write("Loglar", cols, data), "devhub-loglar-" + stamp + ".xlsx",
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    }

    private static final List<String> EXPORT_HEADERS = List.of("Kayıt No", "Tarih", "Seviye", "Kategori", "İşlem", "Yapan", "Açıklama", "Hedef", "Ayrıntılar", "IP adresi");

    private static String actorLabel(ActionLog l) {
        return l.getActor() != null ? l.getActor().getFullName() : "Sistem";
    }

    private static ResponseEntity<byte[]> download(byte[] body, String name, MediaType type) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
            .contentType(type)
            .body(body);
    }

    // ---------------------------------------------------------------- yardımcılar

    private static boolean teamVisible(ActionLog l) {
        return TEAM_FEED.contains(l.getCategory()) || (l.getCategory() == LogCategory.KULLANICI && l.getAction() == LogAction.DURUM_DEGISIKLIGI);
    }

    /** sinceHours: son N saat (özet kartlarındaki "son 24 saat", "son 7 gün" sayılarıyla birebir aynı aralık). */
    private static Specification<ActionLog> spec(LogCategory category, LogLevel level, LogAction action, Long actorId, String from, String to, String q,
                                                 Integer sinceHours) {
        LocalDate fromDay = day(from, "Başlangıç");
        LocalDate toDay = day(to, "Bitiş");
        String text = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase(Locale.forLanguageTag("tr")) + "%";
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (category != null) p.add(cb.equal(root.get("category"), category));
            if (level != null) p.add(cb.equal(root.get("level"), level));
            if (action != null) p.add(cb.equal(root.get("action"), action));
            if (actorId != null) p.add(actorId == 0 ? cb.isNull(root.get("actor")) : cb.equal(root.get("actor").get("id"), actorId));
            if (fromDay != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), utc(fromDay.atStartOfDay())));
            if (toDay != null) p.add(cb.lessThan(root.get("createdAt"), utc(toDay.plusDays(1).atStartOfDay())));
            if (sinceHours != null && sinceHours > 0) {
                p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), LocalDateTime.now(ZoneOffset.UTC).minusHours(Math.min(sinceHours, 24 * 366))));
            }
            if (text != null) {
                p.add(cb.or(
                    cb.like(cb.lower(root.get("message")), text),
                    cb.like(cb.lower(cb.coalesce(root.get("targetName"), "")), text),
                    cb.like(cb.lower(cb.coalesce(root.get("details"), "")), text),
                    cb.like(cb.lower(cb.coalesce(root.get("ipAddress"), "")), text)));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }

    private static LocalDate day(String raw, String label) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(label + " tarihi geçerli olmalı (yyyy-AA-gg).");
        }
    }

    /** Kayıtlar UTC saklanır; İstanbul saatindeki bir anı UTC'ye çevirir. */
    private static LocalDateTime utc(LocalDateTime istanbul) {
        return istanbul.atZone(ActionLogService.ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private static LocalDateTime localTime(LocalDateTime utc) {
        return utc.atZone(ZoneOffset.UTC).withZoneSameInstant(ActionLogService.ZONE).toLocalDateTime();
    }

    private static LocalDate localDay(LocalDateTime utc) {
        return localTime(utc).toLocalDate();
    }

    /** CSV hücresi: ayırıcı, tırnak veya satır sonu içeriyorsa tırnak içine alınır. */
    /** RFC 4180 CSV hücresi; = + - @ ile başlayan metin Excel'de formül sayılmasın diye başına ' eklenir. */
    private static String csvCell(String v) {
        if (v == null) return "";
        String s = v;
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        return s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r") ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }
}
