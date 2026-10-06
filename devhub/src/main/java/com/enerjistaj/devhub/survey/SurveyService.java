package com.enerjistaj.devhub.survey;

import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.realtime.RealtimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Anketler. Yönetici taslak hazırlar, hedef kitleyi seçer (herkes / departman / kişiler) ve yayınlar; kitledeki herkes bir kez yanıtlar.
 * Anonim ankette yanıt kişiyle hiç ilişkilendirilmez: yanıt satırında kişi yoktur, gönderim saati yerine yalnızca gün tutulur ve
 * yanıt tek tek loglanmaz (aksi halde log saatiyle yanıt eşleştirilebilirdi). Kimin yanıtladığı yalnızca katılım için bilinir.
 * Veri JDBC ile okunur/yazılır (tablolar küçük ve sorgular toplu).
 */
@Service
@RequiredArgsConstructor
public class SurveyService implements com.enerjistaj.devhub.service.UserDeactivationListener {

    public enum State { TASLAK, ACIK, KAPALI }
    public enum QType { TEK_SECIM, COKLU_SECIM, PUAN, METIN }
    public enum Audience { HERKES, DEPARTMAN, KISILER }

    public record Question(Long id, int position, QType type, String text, boolean required, List<String> options) {}

    public record Summary(Long id, String title, String description, State state, boolean anonymous, boolean resultsPublic,
                          Audience audienceType, List<String> audienceValues, String audienceLabel,
                          LocalDateTime closesAt, String createdByName, LocalDateTime createdAt, LocalDateTime publishedAt, LocalDateTime closedAt,
                          int questionCount, int recipientCount, int respondedCount, boolean recipient, boolean responded) {}

    public record Detail(Summary survey, List<Question> questions, Map<Long, Object> myAnswers, boolean canSeeResults) {}

    private static final int MAX_QUESTIONS = 30;
    private static final int MAX_OPTIONS = 12;

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ActionLogService actionLog;
    private final RealtimeService realtime;

    // ================================================================== okuma

    public List<Summary> list(User me) {
        boolean admin = CurrentUser.isAdmin(me);
        String where = admin ? "" : " WHERE s.state <> 'TASLAK' AND EXISTS (SELECT 1 FROM survey_recipients r WHERE r.survey_id = s.id AND r.user_id = ?)";
        // summarySql iki kez kişiyi ister (alıcı mı, yanıtladı mı); çalışan için süzgeçte bir kez daha.
        Object[] args = admin ? new Object[] { me.getId(), me.getId() } : new Object[] { me.getId(), me.getId(), me.getId() };
        return jdbc.query(summarySql() + where + " ORDER BY (s.state = 'ACIK') DESC, COALESCE(s.published_at, s.created_at) DESC", this::summary, args);
    }

    public int pendingCount(User me) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM survey_recipients r JOIN surveys s ON s.id = r.survey_id "
            + "WHERE r.user_id = ? AND r.responded = b'0' AND s.state = 'ACIK'", Integer.class, me.getId());
        return n == null ? 0 : n;
    }

    public Detail detail(Long id, User me) {
        Summary s = visible(id, me);
        List<Question> qs = questions(id);
        Map<Long, Object> mine = Map.of();
        if (s.responded() && !s.anonymous()) mine = myAnswers(id, me.getId(), qs);
        return new Detail(s, qs, mine, canSeeResults(s, me));
    }

    private Summary visible(Long id, User me) {
        List<Summary> found = jdbc.query(summarySql() + " WHERE s.id = ?", this::summary, me.getId(), me.getId(), id);
        if (found.isEmpty()) throw ApiException.notFound("Anket");
        Summary s = found.get(0);
        if (!CurrentUser.isAdmin(me) && (s.state() == State.TASLAK || !s.recipient())) throw ApiException.notFound("Anket");
        return s;
    }

    private boolean canSeeResults(Summary s, User me) {
        if (CurrentUser.isAdmin(me)) return true;
        return s.resultsPublic() && (s.responded() || s.state() == State.KAPALI);
    }

    private String summarySql() {
        return "SELECT s.*, u.full_name AS creator, "
            + "(SELECT COUNT(*) FROM survey_questions q WHERE q.survey_id = s.id) AS qn, "
            + "(SELECT COUNT(*) FROM survey_recipients r WHERE r.survey_id = s.id) AS rn, "
            + "(SELECT COUNT(*) FROM survey_recipients r WHERE r.survey_id = s.id AND r.responded = b'1') AS dn, "
            + "(SELECT COUNT(*) FROM survey_recipients r WHERE r.survey_id = s.id AND r.user_id = ?) AS me_rec, "
            + "(SELECT COUNT(*) FROM survey_recipients r WHERE r.survey_id = s.id AND r.user_id = ? AND r.responded = b'1') AS me_done "
            + "FROM surveys s LEFT JOIN users u ON u.id = s.created_by_id";
    }

    private Summary summary(ResultSet rs, int i) throws SQLException {
        Audience at = Audience.valueOf(rs.getString("audience_type"));
        List<String> values = lines(rs.getString("audience_values"));
        return new Summary(rs.getLong("id"), rs.getString("title"), rs.getString("description"), State.valueOf(rs.getString("state")),
            rs.getBoolean("anonymous"), rs.getBoolean("results_public"), at, values, audienceLabel(at, values),
            ts(rs, "closes_at"), rs.getString("creator"), ts(rs, "created_at"), ts(rs, "published_at"), ts(rs, "closed_at"),
            rs.getInt("qn"), rs.getInt("rn"), rs.getInt("dn"), rs.getInt("me_rec") > 0, rs.getInt("me_done") > 0);
    }

    private String audienceLabel(Audience at, List<String> values) {
        return switch (at) {
            case HERKES -> "Herkes";
            case DEPARTMAN -> values.size() == 1 ? values.get(0) + " departmanı" : String.join(", ", values) + " departmanları";
            case KISILER -> values.size() + " kişi";
        };
    }

    List<Question> questions(Long surveyId) {
        return jdbc.query("SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY position, id", (rs, i) -> new Question(
            rs.getLong("id"), rs.getInt("position"), QType.valueOf(rs.getString("type")), rs.getString("text"), rs.getBoolean("required"),
            lines(rs.getString("options"))), surveyId);
    }

    private Map<Long, Object> myAnswers(Long surveyId, Long userId, List<Question> qs) {
        Map<Long, QType> types = qs.stream().collect(Collectors.toMap(Question::id, Question::type));
        Map<Long, Object> out = new HashMap<>();
        jdbc.query("SELECT a.* FROM survey_answers a JOIN survey_responses r ON r.id = a.response_id WHERE r.survey_id = ? AND r.user_id = ?", rs -> {
            long q = rs.getLong("question_id");
            QType t = types.get(q);
            if (t == null) return;
            out.put(q, switch (t) {
                case TEK_SECIM -> Integer.valueOf(rs.getString("choices"));
                case COKLU_SECIM -> Arrays.stream(rs.getString("choices").split(",")).filter(x -> !x.isBlank()).map(Integer::valueOf).toList();
                case PUAN -> rs.getInt("rating");
                case METIN -> rs.getString("text_value");
            });
        }, surveyId, userId);
        return out;
    }

    // ================================================================== yazma (yönetici)

    @Transactional
    public Long create(Map<String, Object> body, User me) {
        Spec spec = Spec.parse(body);
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(c -> {
            PreparedStatement ps = c.prepareStatement("INSERT INTO surveys (title, description, state, anonymous, results_public, audience_type, audience_values, "
                + "closes_at, created_by_id, created_at) VALUES (?, ?, 'TASLAK', ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, spec.title);
            ps.setString(2, spec.description);
            ps.setBoolean(3, spec.anonymous);
            ps.setBoolean(4, spec.resultsPublic);
            ps.setString(5, spec.audience.name());
            ps.setString(6, String.join("\n", spec.audienceValues));
            ps.setTimestamp(7, spec.closesAt == null ? null : Timestamp.valueOf(spec.closesAt));
            ps.setLong(8, me.getId());
            return ps;
        }, key);
        Long id = Objects.requireNonNull(key.getKey()).longValue();
        writeQuestions(id, spec.questions);
        actionLog.record(LogCategory.ANKET, LogAction.OLUSTURMA, "Anket taslağı oluşturuldu: " + spec.title).by(me).target("ANKET", id, spec.title)
            .detail(spec.questions.size() + " soru").save();
        return id;
    }

    @Transactional
    public void update(Long id, Map<String, Object> body, User me) {
        Summary s = adminGet(id, me);
        if (s.state() != State.TASLAK) throw ApiException.conflict("Yayınlanmış anketin soruları değiştirilemez; yanıtlar karışırdı. Kapatıp yeni anket açın.");
        Spec spec = Spec.parse(body);
        jdbc.update("UPDATE surveys SET title = ?, description = ?, anonymous = ?, results_public = ?, audience_type = ?, audience_values = ?, closes_at = ? WHERE id = ?",
            spec.title, spec.description, spec.anonymous, spec.resultsPublic, spec.audience.name(), String.join("\n", spec.audienceValues),
            spec.closesAt == null ? null : Timestamp.valueOf(spec.closesAt), id);
        jdbc.update("DELETE FROM survey_questions WHERE survey_id = ?", id);
        writeQuestions(id, spec.questions);
    }

    /** Yayınlanmış ankette yalnızca son tarih ve sonuç görünürlüğü değişebilir. */
    @Transactional
    /** Hesabı kapatılan kişi yanıtlamadığı açık anketlerden çıkar; katılım oranı ayrılan kişiyi beklemesin. */
    @Override
    public List<String> userDeactivated(User user, User actor) {
        int n = jdbc.update("DELETE r FROM survey_recipients r JOIN surveys s ON s.id = r.survey_id WHERE r.user_id = ? AND r.responded = b'0' AND s.state = 'ACIK'", user.getId());
        return n == 0 ? List.of() : List.of(n + " açık ankette katılımcı listesinden çıkarıldı");
    }

    public void updateSettings(Long id, Map<String, Object> body, User me) {
        Summary s = adminGet(id, me);
        if (body.containsKey("closesAt")) {
            LocalDateTime closes = Spec.closes(body.get("closesAt"));
            if (closes != null && s.state() != State.KAPALI && !closes.isAfter(LocalDateTime.now(ZoneOffset.UTC))) {
                throw ApiException.badRequest("Son tarih geçmiş bir an olamaz.");
            }
            jdbc.update("UPDATE surveys SET closes_at = ? WHERE id = ?", closes == null ? null : Timestamp.valueOf(closes), id);
        }
        if (body.containsKey("resultsPublic")) jdbc.update("UPDATE surveys SET results_public = ? WHERE id = ?", Boolean.TRUE.equals(body.get("resultsPublic")), id);
    }

    private void writeQuestions(Long surveyId, List<Question> qs) {
        int pos = 0;
        for (Question q : qs) {
            jdbc.update("INSERT INTO survey_questions (survey_id, position, type, text, required, options) VALUES (?, ?, ?, ?, ?, ?)",
                surveyId, pos++, q.type().name(), q.text(), q.required(), q.options().isEmpty() ? null : String.join("\n", q.options()));
        }
    }

    @Transactional
    public void publish(Long id, User me) {
        Summary s = adminGet(id, me);
        if (s.state() != State.TASLAK) throw ApiException.conflict("Bu anket zaten yayınlandı.");
        if (s.questionCount() == 0) throw ApiException.badRequest("Yayınlamadan önce en az bir soru ekleyin.");
        if (s.closesAt() != null && !s.closesAt().isAfter(LocalDateTime.now(ZoneOffset.UTC))) throw ApiException.badRequest("Son tarih geçmiş; yeni bir son tarih seçin.");
        List<User> targets = audience(s.audienceType(), s.audienceValues(), me);
        if (targets.isEmpty()) throw ApiException.badRequest("Seçilen kitlede aktif kimse yok.");
        for (User u : targets) jdbc.update("INSERT INTO survey_recipients (survey_id, user_id) VALUES (?, ?)", id, u.getId());
        jdbc.update("UPDATE surveys SET state = 'ACIK', published_at = UTC_TIMESTAMP() WHERE id = ?", id);
        targets.forEach(u -> notifications.notify(u, me, NotificationType.SURVEY_PUBLISHED, "Yeni anket: " + s.title(),
            s.anonymous() ? "Anonim anket; yanıtlarınız adınızla eşleştirilmez." : "Birkaç dakikanızı alır.", "/surveys/" + id));
        actionLog.record(LogCategory.ANKET, LogAction.YAYIN, "Anket yayınlandı: " + s.title()).by(me).target("ANKET", id, s.title())
            .detail("Kitle: " + s.audienceLabel() + " (" + targets.size() + " kişi)")
            .detail(s.anonymous() ? "Anonim" : "Adıyla")
            .detail(s.closesAt() != null ? "Son tarih: " + s.closesAt() + " UTC" : "Son tarih yok").save();
    }

    /** Hedef kitledeki aktif kullanıcılar (anketi hazırlayan hariç). */
    private List<User> audience(Audience type, List<String> values, User creator) {
        List<User> active = users.findByActiveTrue();
        return active.stream().filter(u -> !u.getId().equals(creator.getId())).filter(u -> switch (type) {
            case HERKES -> true;
            case DEPARTMAN -> u.getDepartment() != null && values.stream().anyMatch(d -> d.equalsIgnoreCase(u.getDepartment()));
            case KISILER -> values.contains(String.valueOf(u.getId()));
        }).toList();
    }

    @Transactional
    public void close(Long id, User me) {
        Summary s = adminGet(id, me);
        if (s.state() != State.ACIK) throw ApiException.conflict("Yalnızca açık anket kapatılabilir.");
        jdbc.update("UPDATE surveys SET state = 'KAPALI', closed_at = UTC_TIMESTAMP() WHERE id = ?", id);
        actionLog.record(LogCategory.ANKET, LogAction.GUNCELLEME, "Anket kapatıldı: " + s.title()).by(me).target("ANKET", id, s.title())
            .detail(s.respondedCount() + " / " + s.recipientCount() + " kişi yanıtladı").save();
    }

    @Transactional
    public void reopen(Long id, User me) {
        Summary s = adminGet(id, me);
        if (s.state() != State.KAPALI) throw ApiException.conflict("Yalnızca kapalı anket yeniden açılabilir.");
        // Son tarih geçmişse kaldırılır, yoksa anket hemen yeniden kapanırdı.
        jdbc.update("UPDATE surveys SET state = 'ACIK', closed_at = NULL, closes_at = CASE WHEN closes_at <= UTC_TIMESTAMP() THEN NULL ELSE closes_at END WHERE id = ?", id);
        actionLog.record(LogCategory.ANKET, LogAction.GUNCELLEME, "Anket yeniden açıldı: " + s.title()).by(me).target("ANKET", id, s.title()).save();
    }

    @Transactional
    public void delete(Long id, User me) {
        Summary s = adminGet(id, me);
        jdbc.update("DELETE FROM surveys WHERE id = ?", id);
        actionLog.record(LogCategory.ANKET, LogAction.SILME, "Anket silindi: " + s.title()).by(me).target("ANKET", id, s.title())
            .detail(s.respondedCount() + " yanıt da silindi").level(LogLevel.UYARI).save();
    }

    /** Yanıtlamayanlara hatırlatma; aynı kişiye en fazla saatte bir. */
    @Transactional
    public int remind(Long id, User me) {
        Summary s = adminGet(id, me);
        if (s.state() != State.ACIK) throw ApiException.conflict("Yalnızca açık anket için hatırlatma gönderilir.");
        List<Long> ids = jdbc.queryForList("SELECT user_id FROM survey_recipients WHERE survey_id = ? AND responded = b'0' "
            + "AND (reminded_at IS NULL OR reminded_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR)", Long.class, id);
        users.findAllById(ids).forEach(u -> notifications.notify(u, me, NotificationType.SURVEY_REMINDER, "Anket yanıtınızı bekliyor: " + s.title(),
            s.closesAt() != null ? "Anket kapanmadan yanıtlayın." : "Birkaç dakikanızı alır.", "/surveys/" + id));
        if (!ids.isEmpty()) {
            jdbc.update("UPDATE survey_recipients SET reminded_at = UTC_TIMESTAMP() WHERE survey_id = ? AND user_id IN ("
                + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + ")", id);
            actionLog.record(LogCategory.ANKET, LogAction.BILGI, "Anket hatırlatması gönderildi: " + s.title()).by(me).target("ANKET", id, s.title())
                .detail(ids.size() + " kişiye").save();
        }
        return ids.size();
    }

    /** Son tarihi geçen açık anketler kapanır. */
    @Scheduled(initialDelay = 60_000, fixedDelay = 300_000)
    @Transactional
    public void autoClose() {
        List<Map<String, Object>> due = jdbc.queryForList("SELECT id, title FROM surveys WHERE state = 'ACIK' AND closes_at IS NOT NULL AND closes_at <= UTC_TIMESTAMP()");
        for (Map<String, Object> row : due) {
            Long id = ((Number) row.get("id")).longValue();
            jdbc.update("UPDATE surveys SET state = 'KAPALI', closed_at = UTC_TIMESTAMP() WHERE id = ?", id);
            actionLog.record(LogCategory.ANKET, LogAction.GUNCELLEME, "Anket son tarihinde kapandı: " + row.get("title")).target("ANKET", id, (String) row.get("title")).save();
        }
        if (!due.isEmpty()) realtime.invalidate(List.of("surveys"), null);
    }

    private Summary adminGet(Long id, User me) {
        if (!CurrentUser.isAdmin(me)) throw ApiException.forbidden("Anketleri yalnızca yöneticiler yönetebilir.");
        return visible(id, me);
    }

    // ================================================================== yanıt

    @Transactional
    @SuppressWarnings("unchecked")
    public void respond(Long id, Map<String, Object> body, User me) {
        Summary s = visible(id, me);
        if (!s.recipient()) throw ApiException.forbidden("Bu anket size gönderilmedi.");
        // Otomatik kapanma 5 dakikada bir çalışır; aradaki sürede de son tarihten sonra yanıt alınmaz.
        boolean pastDeadline = s.closesAt() != null && s.closesAt().isBefore(LocalDateTime.now(ZoneOffset.UTC));
        if (s.state() != State.ACIK || pastDeadline) throw ApiException.conflict("Bu anket kapandı; artık yanıt alınmıyor.");
        if (s.responded()) throw ApiException.conflict("Bu anketi zaten yanıtladınız.");
        Map<String, Object> raw = body.get("answers") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        List<Question> qs = questions(id);
        List<Object[]> rows = new ArrayList<>();
        for (Question q : qs) {
            Object v = raw.get(String.valueOf(q.id()));
            Object[] a = answer(q, v);
            if (a == null && q.required()) throw ApiException.badRequest("Zorunlu soruyu yanıtlayın: " + q.text());
            if (a != null) rows.add(a);
        }
        // Katılım işareti önce: aynı anda iki gönderimde ikincisi buradan döner.
        int marked = jdbc.update("UPDATE survey_recipients SET responded = b'1' WHERE survey_id = ? AND user_id = ? AND responded = b'0'", id, me.getId());
        if (marked == 0) throw ApiException.conflict("Bu anketi zaten yanıtladınız.");
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(c -> {
            PreparedStatement ps = c.prepareStatement("INSERT INTO survey_responses (survey_id, user_id, submitted_at) VALUES (?, ?, "
                + (s.anonymous() ? "UTC_DATE()" : "UTC_TIMESTAMP()") + ")", Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, id);
            if (s.anonymous()) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, me.getId());
            return ps;
        }, key);
        long responseId = Objects.requireNonNull(key.getKey()).longValue();
        for (Object[] a : rows) {
            jdbc.update("INSERT INTO survey_answers (response_id, question_id, choices, rating, text_value) VALUES (?, ?, ?, ?, ?)",
                responseId, a[0], a[1], a[2], a[3]);
        }
        if (!s.anonymous()) {
            actionLog.record(LogCategory.ANKET, LogAction.YANIT, "Anket yanıtlandı: " + s.title()).by(me).target("ANKET", id, s.title()).save();
        }
    }

    /** [soru, seçimler, puan, metin] ya da boşsa null. Geçersiz değer 400 döner. */
    private static Object[] answer(Question q, Object v) {
        if (v == null || (v instanceof String str && str.isBlank()) || (v instanceof Collection<?> c && c.isEmpty())) return null;
        try {
            return switch (q.type()) {
                case TEK_SECIM -> {
                    int i = Integer.parseInt(v.toString());
                    if (i < 0 || i >= q.options().size()) throw ApiException.badRequest("Geçersiz seçim: " + q.text());
                    yield new Object[] { q.id(), String.valueOf(i), null, null };
                }
                case COKLU_SECIM -> {
                    if (!(v instanceof Collection<?> c)) throw ApiException.badRequest("Geçersiz seçim: " + q.text());
                    TreeSet<Integer> set = new TreeSet<>();
                    for (Object o : c) {
                        int i = Integer.parseInt(o.toString());
                        if (i < 0 || i >= q.options().size()) throw ApiException.badRequest("Geçersiz seçim: " + q.text());
                        set.add(i);
                    }
                    yield new Object[] { q.id(), set.stream().map(String::valueOf).collect(Collectors.joining(",")), null, null };
                }
                case PUAN -> {
                    int r = Integer.parseInt(v.toString());
                    if (r < 1 || r > 5) throw ApiException.badRequest("Puan 1 ile 5 arasında olmalı: " + q.text());
                    yield new Object[] { q.id(), null, r, null };
                }
                case METIN -> {
                    String t = v.toString().trim();
                    if (t.length() > 2000) throw ApiException.badRequest("Yanıt en fazla 2000 karakter olabilir: " + q.text());
                    yield t.isEmpty() ? null : new Object[] { q.id(), null, null, t };
                }
            };
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Geçersiz yanıt: " + q.text());
        }
    }

    // ================================================================== sonuçlar

    public Map<String, Object> results(Long id, User me) {
        Summary s = visible(id, me);
        boolean admin = CurrentUser.isAdmin(me);
        if (!canSeeResults(s, me)) throw ApiException.forbidden("Bu anketin sonuçları paylaşılmadı.");
        List<Question> qs = questions(id);
        Map<Long, List<Map<String, Object>>> answers = new HashMap<>();
        jdbc.query("SELECT a.question_id, a.choices, a.rating, a.text_value, r.submitted_at, u.full_name FROM survey_answers a "
            + "JOIN survey_responses r ON r.id = a.response_id LEFT JOIN users u ON u.id = r.user_id WHERE r.survey_id = ? ORDER BY r.id", rs -> {
            Map<String, Object> m = new HashMap<>();
            m.put("choices", rs.getString(2));
            m.put("rating", rs.getObject(3));
            m.put("text", rs.getString(4));
            m.put("at", ts(rs, "submitted_at"));
            m.put("name", rs.getString(6));
            answers.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(m);
        }, id);

        List<Map<String, Object>> out = new ArrayList<>();
        for (Question q : qs) {
            List<Map<String, Object>> list = answers.getOrDefault(q.id(), List.of());
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("questionId", q.id());
            r.put("type", q.type());
            r.put("text", q.text());
            r.put("options", q.options());
            r.put("answered", list.size());
            switch (q.type()) {
                case TEK_SECIM, COKLU_SECIM -> {
                    int[] counts = new int[q.options().size()];
                    for (Map<String, Object> a : list) {
                        for (String part : String.valueOf(a.get("choices")).split(",")) {
                            if (part.isBlank()) continue;
                            int i = Integer.parseInt(part);
                            if (i < counts.length) counts[i]++;
                        }
                    }
                    r.put("counts", counts);
                }
                case PUAN -> {
                    int[] dist = new int[5];
                    double sum = 0;
                    for (Map<String, Object> a : list) {
                        int v = ((Number) a.get("rating")).intValue();
                        dist[v - 1]++;
                        sum += v;
                    }
                    r.put("distribution", dist);
                    r.put("average", list.isEmpty() ? null : Math.round(sum / list.size() * 10) / 10.0);
                }
                case METIN -> r.put("texts", list.stream().map(a -> {
                    Map<String, Object> t = new LinkedHashMap<>();
                    t.put("text", a.get("text"));
                    // Ad yalnızca yöneticiye ve adıyla ankette gösterilir.
                    t.put("name", admin && !s.anonymous() ? a.get("name") : null);
                    return t;
                }).toList());
            }
            out.add(r);
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("survey", s);
        res.put("questions", out);
        if (admin) {
            res.put("pending", jdbc.query("SELECT u.id, u.full_name, u.department, r.reminded_at FROM survey_recipients r JOIN users u ON u.id = r.user_id "
                + "WHERE r.survey_id = ? AND r.responded = b'0' ORDER BY u.full_name", (rs, i) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", rs.getLong(1));
                m.put("fullName", rs.getString(2));
                m.put("department", rs.getString(3));
                m.put("remindedAt", ts(rs, "reminded_at"));
                return m;
            }, id));
        }
        return res;
    }

    /** Yönetici: yanıtlar tablo olarak (bir satır = bir yanıt). Anonim ankette ad sütunu yoktur. */
    public byte[] export(Long id, User me) {
        Summary s = adminGet(id, me);
        List<Question> qs = questions(id);
        Map<Long, Map<Long, String>> byResponse = new LinkedHashMap<>();
        Map<Long, String[]> who = new HashMap<>();
        jdbc.query("SELECT r.id, r.submitted_at, u.full_name, a.question_id, a.choices, a.rating, a.text_value FROM survey_responses r "
            + "LEFT JOIN users u ON u.id = r.user_id LEFT JOIN survey_answers a ON a.response_id = r.id WHERE r.survey_id = ? ORDER BY r.id", rs -> {
            long rid = rs.getLong(1);
            who.putIfAbsent(rid, new String[] { rs.getString(3), String.valueOf(ts(rs, "submitted_at")) });
            Map<Long, String> row = byResponse.computeIfAbsent(rid, k -> new HashMap<>());
            long qid = rs.getLong(4);
            if (rs.wasNull()) return;
            Question q = qs.stream().filter(x -> x.id() == qid).findFirst().orElse(null);
            if (q == null) return;
            String text = switch (q.type()) {
                case TEK_SECIM, COKLU_SECIM -> Arrays.stream(rs.getString(5).split(",")).filter(x -> !x.isBlank())
                    .map(x -> q.options().get(Integer.parseInt(x))).collect(Collectors.joining(", "));
                case PUAN -> String.valueOf(rs.getInt(6));
                case METIN -> rs.getString(7);
            };
            row.put(qid, text);
        }, id);
        List<com.enerjistaj.devhub.util.XlsxWriter.Column> cols = new ArrayList<>();
        if (!s.anonymous()) cols.add(new com.enerjistaj.devhub.util.XlsxWriter.Column("Kişi", 24, false));
        for (Question q : qs) cols.add(new com.enerjistaj.devhub.util.XlsxWriter.Column(q.text(), q.type() == QType.METIN ? 50 : 24, true));
        List<List<com.enerjistaj.devhub.util.XlsxWriter.Cell>> rows = new ArrayList<>();
        for (Map.Entry<Long, Map<Long, String>> e : byResponse.entrySet()) {
            List<com.enerjistaj.devhub.util.XlsxWriter.Cell> row = new ArrayList<>();
            if (!s.anonymous()) row.add(com.enerjistaj.devhub.util.XlsxWriter.Cell.text(who.get(e.getKey())[0]));
            for (Question q : qs) row.add(com.enerjistaj.devhub.util.XlsxWriter.Cell.text(e.getValue().getOrDefault(q.id(), "")));
            rows.add(row);
        }
        return com.enerjistaj.devhub.util.XlsxWriter.write("Yanıtlar", cols, rows);
    }

    // ================================================================== yardımcılar

    private static LocalDateTime ts(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toLocalDateTime();
    }

    static List<String> lines(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split("\n")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }

    /** Gövdeden okunan anket tanımı (doğrulanmış). */
    private record Spec(String title, String description, boolean anonymous, boolean resultsPublic, Audience audience,
                        List<String> audienceValues, LocalDateTime closesAt, List<Question> questions) {

        @SuppressWarnings("unchecked")
        static Spec parse(Map<String, Object> body) {
            String title = com.enerjistaj.devhub.dto.Payloads.requiredText(body, "title", "Anket başlığı boş olamaz.", 200, "Başlık");
            String description = com.enerjistaj.devhub.dto.Payloads.optionalText(body, "description", 2000, "Açıklama");
            Audience audience = com.enerjistaj.devhub.dto.Payloads.enumValue(body, "audienceType", Audience.class, "kitle");
            if (audience == null) audience = Audience.HERKES;
            List<String> values = body.get("audienceValues") instanceof Collection<?> c
                ? c.stream().map(o -> String.valueOf(o).trim().replace("\n", " ")).filter(x -> !x.isEmpty()).distinct().toList() : List.of();
            if (audience != Audience.HERKES && values.isEmpty()) {
                throw ApiException.badRequest(audience == Audience.DEPARTMAN ? "En az bir departman seçin." : "En az bir kişi seçin.");
            }
            if (audience == Audience.HERKES) values = List.of();
            LocalDateTime closes = closes(body.get("closesAt"));
            List<Question> qs = new ArrayList<>();
            if (body.get("questions") instanceof List<?> list) {
                if (list.size() > MAX_QUESTIONS) throw ApiException.badRequest("Bir ankette en fazla " + MAX_QUESTIONS + " soru olabilir.");
                for (Object o : list) {
                    if (!(o instanceof Map<?, ?> m0)) continue;
                    Map<String, Object> m = (Map<String, Object>) m0;
                    QType type = com.enerjistaj.devhub.dto.Payloads.enumValue(m, "type", QType.class, "soru türü");
                    if (type == null) throw ApiException.badRequest("Soru türünü seçin.");
                    String text = com.enerjistaj.devhub.dto.Payloads.requiredText(m, "text", "Soru metni boş olamaz.", 500, "Soru");
                    boolean required = !Boolean.FALSE.equals(m.get("required"));
                    List<String> options = m.get("options") instanceof Collection<?> oc
                        ? oc.stream().map(x -> String.valueOf(x).trim().replace("\n", " ")).filter(x -> !x.isEmpty()).toList() : List.of();
                    if (type == QType.TEK_SECIM || type == QType.COKLU_SECIM) {
                        if (options.size() < 2) throw ApiException.badRequest("Seçmeli soruda en az iki seçenek olmalı: " + text);
                        if (options.size() > MAX_OPTIONS) throw ApiException.badRequest("Bir soruda en fazla " + MAX_OPTIONS + " seçenek olabilir.");
                        if (options.stream().anyMatch(x -> x.length() > 200)) throw ApiException.badRequest("Seçenekler en fazla 200 karakter olabilir.");
                    } else {
                        options = List.of();
                    }
                    qs.add(new Question(null, qs.size(), type, text, required, options));
                }
            }
            return new Spec(title, description, Boolean.TRUE.equals(body.get("anonymous")), Boolean.TRUE.equals(body.get("resultsPublic")),
                audience, values, closes, qs);
        }

        /** "2026-10-10T17:00" (İstanbul saati) ya da ofsetli ISO → UTC. Boşsa null. */
        static LocalDateTime closes(Object raw) {
            if (raw == null || raw.toString().isBlank()) return null;
            String v = raw.toString().trim();
            try {
                if (v.endsWith("Z") || v.matches(".*[+-]\\d{2}:\\d{2}$")) return java.time.OffsetDateTime.parse(v).withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
                return LocalDateTime.parse(v).atZone(ActionLogService.ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
            } catch (java.time.format.DateTimeParseException e) {
                throw ApiException.badRequest("Son tarih geçersiz.");
            }
        }
    }
}
