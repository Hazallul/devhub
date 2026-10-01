package com.enerjistaj.devhub.onboarding;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.realtime.RealtimeService;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

/**
 * İşe başlangıç listesi. Yeni kullanıcı oluşturulunca başlar; kişi Genel Bakış'ta adımları görür.
 * Bazı adımlar kendiliğinden tamamlanır (şifre, iletişim bilgisi, doküman açma), diğerlerini kişi işaretler.
 * Hepsi bitince yöneticilere bildirim gider. İlerleme (yalnızca hangi adımın bittiği) yöneticilere açıktır.
 */
@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final OnboardingStepRepository steps;
    private final OnboardingUserRepository onboardingUsers;
    private final JdbcTemplate jdbc;
    private final NotificationService notifications;
    private final ActionLogService actionLog;
    private final RealtimeService realtime;

    public record StepDto(Long id, String title, String description, String link, OnboardingRule autoRule, int position) {
        static StepDto from(OnboardingStep s) {
            return new StepDto(s.getId(), s.getTitle(), s.getDescription(), s.getLink(), s.getAutoRule(), s.getPosition());
        }
    }

    public record MyStep(Long id, String title, String description, String link, OnboardingRule autoRule, boolean done, LocalDateTime doneAt) {}

    /** active=false: kişi için liste yok. */
    public record Status(boolean active, LocalDateTime startedAt, LocalDateTime completedAt, boolean closed, int done, int total, List<MyStep> steps) {
        static Status none() {
            return new Status(false, null, null, false, 0, 0, List.of());
        }
    }

    public record UserProgress(Long userId, String fullName, LocalDateTime startedAt, LocalDateTime completedAt, int done, int total, List<Long> doneStepIds) {}

    // ------------------------------------------------------------- başlatma / durdurma

    /** Liste yoksa açar, kapatılmışsa yeniden gösterir. */
    @Transactional
    public void start(User user, User by) {
        OnboardingUser o = onboardingUsers.findById(user.getId()).orElse(null);
        if (o == null) {
            o = new OnboardingUser();
            o.setUser(user);
            o.setStartedBy(by);
        }
        o.setClosedAt(null);
        onboardingUsers.save(o);
    }

    @Transactional
    public boolean stop(User user) {
        if (!onboardingUsers.existsById(user.getId())) return false;
        jdbc.update("DELETE FROM onboarding_progress WHERE user_id = ?", user.getId());
        onboardingUsers.deleteById(user.getId());
        return true;
    }

    // ------------------------------------------------------------- kişinin kendi listesi

    /** Kendiliğinden tamamlanan adımları değerlendirip kişinin listesini döner. */
    @Transactional
    public Status status(User user) {
        OnboardingUser o = onboardingUsers.findById(user.getId()).orElse(null);
        if (o == null) return Status.none();
        List<OnboardingStep> all = steps.findAllByOrderByPositionAscIdAsc();
        Map<Long, LocalDateTime> done = evaluate(o, all);

        List<MyStep> mine = all.stream().map(s -> new MyStep(s.getId(), s.getTitle(), s.getDescription(), s.getLink(), s.getAutoRule(),
            done.containsKey(s.getId()), done.get(s.getId()))).toList();
        int count = (int) mine.stream().filter(MyStep::done).count();
        return new Status(true, o.getStartedAt(), o.getCompletedAt(), o.getClosedAt() != null, count, all.size(), mine);
    }

    /** Şifre ve iletişim adımlarını kişinin şu anki durumuna göre işaretler; güncel ilerlemeyi döner. */
    private Map<Long, LocalDateTime> evaluate(OnboardingUser o, List<OnboardingStep> all) {
        User user = o.getUser();
        Map<Long, LocalDateTime> done = doneMap(user.getId());
        boolean changed = false;
        for (OnboardingStep s : all) {
            if (done.containsKey(s.getId()) || s.getAutoRule() == null) continue;
            boolean met = switch (s.getAutoRule()) {
                case SIFRE -> !user.isMustChangePassword();
                case ILETISIM -> hasLinks(user.getId());
                case DOKUMAN -> false; // doküman açılınca docOpened işaretler
            };
            if (met) {
                mark(user.getId(), s.getId());
                done.put(s.getId(), LocalDateTime.now());
                changed = true;
            }
        }
        if (changed) checkCompleted(o, all, done);
        return done;
    }

    /** Elle işaretleme. Şifre ve iletişim adımları yalnızca kendiliğinden tamamlanır. */
    @Transactional
    public void setDone(User user, Long stepId, boolean value) {
        OnboardingUser o = onboardingUsers.findById(user.getId()).orElseThrow(() -> com.enerjistaj.devhub.exception.ApiException.notFound("Başlangıç listesi"));
        OnboardingStep s = steps.findById(stepId).orElseThrow(() -> com.enerjistaj.devhub.exception.ApiException.notFound("Adım"));
        if (s.getAutoRule() == OnboardingRule.SIFRE || s.getAutoRule() == OnboardingRule.ILETISIM) {
            throw com.enerjistaj.devhub.exception.ApiException.badRequest("Bu adım, gereken işlem yapılınca kendiliğinden tamamlanır.");
        }
        if (value) {
            mark(user.getId(), stepId);
            checkCompleted(o, steps.findAllByOrderByPositionAscIdAsc(), doneMap(user.getId()));
        } else {
            jdbc.update("DELETE FROM onboarding_progress WHERE user_id = ? AND step_id = ?", user.getId(), stepId);
        }
    }

    /** Tamamlanan kartı Genel Bakış'tan kaldırır. */
    @Transactional
    public void close(User user) {
        OnboardingUser o = onboardingUsers.findById(user.getId()).orElseThrow(() -> com.enerjistaj.devhub.exception.ApiException.notFound("Başlangıç listesi"));
        o.setClosedAt(LocalDateTime.now());
        onboardingUsers.save(o);
    }

    /**
     * Kişi bir doküman açtı: o dokümana bağlı "DOKUMAN" adımı varsa tamamlanır.
     * Doküman okuma isteği salt okunur bir işlem içinde geldiği için ayrı bir işlemde yazılır.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void docOpened(User user, String slug) {
        List<OnboardingStep> matching = steps.findByAutoRuleAndLink(OnboardingRule.DOKUMAN, "/docs/" + slug);
        if (matching.isEmpty()) return;
        OnboardingUser o = onboardingUsers.findById(user.getId()).orElse(null);
        if (o == null) return;
        Map<Long, LocalDateTime> done = doneMap(user.getId());
        boolean changed = false;
        for (OnboardingStep s : matching) {
            if (done.containsKey(s.getId())) continue;
            mark(user.getId(), s.getId());
            done.put(s.getId(), LocalDateTime.now());
            changed = true;
        }
        if (changed) {
            checkCompleted(o, steps.findAllByOrderByPositionAscIdAsc(), done);
            realtime.invalidate(List.of("onboarding"), null);
        }
    }

    // ------------------------------------------------------------- yönetici görünümü

    /** Listesi açık olan (aktif) kişilerin ilerlemesi; şifre/iletişim adımları o anki duruma göre değerlendirilir. */
    @Transactional
    public List<UserProgress> progress() {
        List<OnboardingStep> all = steps.findAllByOrderByPositionAscIdAsc();
        return onboardingUsers.findAllActiveUsers().stream().map(o -> {
            Map<Long, LocalDateTime> done = evaluate(o, all);
            List<Long> d = all.stream().map(OnboardingStep::getId).filter(done::containsKey).toList();
            return new UserProgress(o.getUserId(), o.getUser().getFullName(), o.getStartedAt(), o.getCompletedAt(), d.size(), all.size(), d);
        }).toList();
    }

    // ------------------------------------------------------------- yardımcılar

    private Map<Long, LocalDateTime> doneMap(Long userId) {
        Map<Long, LocalDateTime> m = new HashMap<>();
        jdbc.query("SELECT step_id, done_at FROM onboarding_progress WHERE user_id = ?",
            rs -> { m.put(rs.getLong(1), rs.getTimestamp(2).toLocalDateTime()); }, userId);
        return m;
    }

    private void mark(Long userId, Long stepId) {
        jdbc.update("INSERT IGNORE INTO onboarding_progress (user_id, step_id, done_at) VALUES (?, ?, ?)",
            userId, stepId, Timestamp.valueOf(LocalDateTime.now()));
    }

    private boolean hasLinks(Long userId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM user_links WHERE user_id = ?", Integer.class, userId);
        return n != null && n > 0;
    }

    /** Tüm adımlar bittiyse bir kez: tamamlandı olarak işaretle, yöneticilere bildir, logla. */
    private void checkCompleted(OnboardingUser o, List<OnboardingStep> all, Map<Long, LocalDateTime> done) {
        if (o.getCompletedAt() != null || all.isEmpty()) return;
        if (!all.stream().allMatch(s -> done.containsKey(s.getId()))) return;
        o.setCompletedAt(LocalDateTime.now());
        onboardingUsers.save(o);
        User u = o.getUser();
        notifications.notifyAdmins(u, NotificationType.ONBOARDING_DONE, u.getFullName() + " işe başlangıç adımlarını tamamladı",
            all.size() + " adımın hepsi bitti.", "/users");
        actionLog.record(LogCategory.KULLANICI, LogAction.TAMAMLAMA, "İşe başlangıç listesi tamamlandı: " + u.getFullName()).by(u)
            .target("KULLANICI", u.getId(), u.getFullName())
            .detail("Adım sayısı: " + all.size())
            .detail("Başlangıç: " + o.getStartedAt().toLocalDate())
            .save();
    }
}
