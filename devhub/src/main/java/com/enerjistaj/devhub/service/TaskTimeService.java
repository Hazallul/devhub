package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskStatus;
import com.enerjistaj.devhub.entity.TaskWorkSession;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.TaskWorkSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

/**
 * Görevlerin harcanan süresi. Görev "Devam Ediyor"a alınınca bir çalışma oturumu açılır, oradan çıkınca kapanır;
 * harcanan süre = oturumların mesaiye düşen kısmı + elle düzeltme. Kurallar:
 * <ul>
 *   <li>Yapılacak'a geri alınırsa süre durur, tekrar Devam'a alınınca kaldığı yerden sürer (sıfırlanmaz).</li>
 *   <li>Tamamlandı'dan geri çekilirse görev kilitlenmez; Devam'a alınınca sayım yine sürer.</li>
 *   <li>Yanlışlıkla taşıma: oturum kapandıktan sonraki {@link #RESUME_WINDOW} içinde yeniden Devam'a alınırsa
 *       aynı oturum sürdürülür (aradaki birkaç dakika kaybolmaz).</li>
 *   <li>{@link #ACCIDENTAL} kısa süren ve Yapılacak'a geri alınan bir oturum (yanlış tık) hiç sayılmaz.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class TaskTimeService {

    static final Duration RESUME_WINDOW = Duration.ofMinutes(10);
    static final Duration ACCIDENTAL = Duration.ofMinutes(1);

    private final TaskWorkSessionRepository sessions;
    private final WorkTimeService workTime;

    /** Görev için hesaplanmış süre bilgisi. ticking: oturum açık ve şu an mesai saati (süre canlı artıyor). */
    public record Summary(long spentSeconds, boolean running, boolean ticking, LocalDateTime firstStartedAt) {
        static final Summary NONE = new Summary(0, false, false, null);
    }

    public record SessionDto(Long id, Long userId, String userName, LocalDateTime startedAt, LocalDateTime endedAt, long workSeconds) {}

    /** TaskStatusService çağırır: durum değişmeden hemen önce. */
    public void onStatusChange(Task t, TaskStatus from, TaskStatus to) {
        if (t.getId() == null || from == to) return;
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (from == TaskStatus.DEVAM) {
            for (TaskWorkSession s : sessions.findByTaskIdAndEndedAtIsNull(t.getId())) {
                if (to == TaskStatus.YAPILACAK && Duration.between(s.getStartedAt(), now).compareTo(ACCIDENTAL) < 0) {
                    sessions.delete(s); // yanlış tık: hiç sayılmaz
                } else {
                    s.setEndedAt(now);
                    sessions.save(s);
                }
            }
        }
        if (to == TaskStatus.DEVAM) open(t, t.getUser(), now);
    }

    /** Görev başka birine aktarıldı: Devam'daysa eski kişinin oturumu kapanır, yenisine açılır. */
    public void onReassign(Task t, User newOwner) {
        if (t.getStatus() != TaskStatus.DEVAM) return;
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        for (TaskWorkSession s : sessions.findByTaskIdAndEndedAtIsNull(t.getId())) {
            s.setEndedAt(now);
            sessions.save(s);
        }
        TaskWorkSession s = new TaskWorkSession();
        s.setTask(t);
        s.setUser(newOwner);
        s.setStartedAt(now);
        sessions.save(s);
    }

    /** Hesap pasifleştirildi: kişinin açık oturumları kapanır (süre işlemeye devam etmesin). */
    public void closeAllFor(User u) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        for (TaskWorkSession s : sessions.findByUserIdAndEndedAtIsNull(u.getId())) {
            s.setEndedAt(now);
            sessions.save(s);
        }
    }

    private void open(Task t, User owner, LocalDateTime now) {
        if (!sessions.findByTaskIdAndEndedAtIsNull(t.getId()).isEmpty()) return;
        Optional<TaskWorkSession> last = sessions.findFirstByTaskIdOrderByStartedAtDescIdDesc(t.getId());
        if (last.isPresent() && last.get().getEndedAt() != null && last.get().getUser().getId().equals(owner.getId())
            && Duration.between(last.get().getEndedAt(), now).compareTo(RESUME_WINDOW) < 0) {
            last.get().setEndedAt(null); // kısa süre önce kapanmıştı: aynı oturum sürer
            sessions.save(last.get());
            return;
        }
        TaskWorkSession s = new TaskWorkSession();
        s.setTask(t);
        s.setUser(owner);
        s.setStartedAt(now);
        sessions.save(s);
    }

    // ------------------------------------------------------------- hesap

    /** Birçok görevin süresi tek seferde (görev listesi için). */
    public Map<Long, Summary> summaries(Collection<Task> tasks) {
        if (tasks.isEmpty()) return Map.of();
        Map<Long, Task> byId = new HashMap<>();
        tasks.forEach(t -> byId.put(t.getId(), t));
        List<TaskWorkSession> all = sessions.findByTaskIdIn(byId.keySet());
        WorkTimeService.Calendar cal = calendarFor(all);
        Map<Long, long[]> acc = new HashMap<>(); // [saniye, açık mı, işliyor mu]
        Map<Long, LocalDateTime> first = new HashMap<>();
        for (TaskWorkSession s : all) {
            first.merge(s.getTask().getId(), s.getStartedAt(), (a, b) -> a.isBefore(b) ? a : b);
            long[] a = acc.computeIfAbsent(s.getTask().getId(), k -> new long[3]);
            Long uid = s.getUser().getId();
            a[0] += cal.workSeconds(uid, s.getStartedAt(), s.getEndedAt());
            if (s.getEndedAt() == null) {
                a[1] = 1;
                if (cal.isWorkingNow(uid)) a[2] = 1;
            }
        }
        Map<Long, Summary> out = new HashMap<>();
        byId.forEach((id, t) -> {
            long[] a = acc.get(id);
            long spent = (a != null ? a[0] : 0) + t.getSpentAdjustMinutes() * 60L;
            out.put(id, new Summary(Math.max(0, spent), a != null && a[1] == 1, a != null && a[2] == 1, first.get(id)));
        });
        return out;
    }

    public Summary summary(Task t) {
        return summaries(List.of(t)).getOrDefault(t.getId(), Summary.NONE);
    }

    /** Oturumların hesaplanan süresi (düzeltme hariç). */
    public long rawSeconds(Task t) {
        return summary(t).spentSeconds() - t.getSpentAdjustMinutes() * 60L;
    }

    public List<SessionDto> sessionsOf(Long taskId) {
        List<TaskWorkSession> list = sessions.findByTaskIdOrderByStartedAtAscIdAsc(taskId);
        WorkTimeService.Calendar cal = calendarFor(list);
        return list.stream().map(s -> new SessionDto(s.getId(), s.getUser().getId(), s.getUser().getFullName(), s.getStartedAt(), s.getEndedAt(),
            cal.workSeconds(s.getUser().getId(), s.getStartedAt(), s.getEndedAt()))).toList();
    }

    /** Kişi başına [from, to) aralığında çalışılan süre (saniye), ör. bu hafta. */
    public Map<Long, Long> workedByUser(LocalDateTime fromUtc, LocalDateTime toUtc) {
        List<TaskWorkSession> list = sessions.findOverlapping(fromUtc, toUtc);
        WorkTimeService.Calendar cal = calendarFor(list);
        Map<Long, Long> out = new HashMap<>();
        for (TaskWorkSession s : list) {
            LocalDateTime start = s.getStartedAt().isBefore(fromUtc) ? fromUtc : s.getStartedAt();
            LocalDateTime end = s.getEndedAt() == null || s.getEndedAt().isAfter(toUtc) ? (toUtc.isAfter(LocalDateTime.now(ZoneOffset.UTC)) ? null : toUtc) : s.getEndedAt();
            out.merge(s.getUser().getId(), cal.workSeconds(s.getUser().getId(), start, end), Long::sum);
        }
        return out;
    }

    private WorkTimeService.Calendar calendarFor(List<TaskWorkSession> list) {
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        LocalDate from = list.stream().map(s -> s.getStartedAt().toLocalDate().minusDays(1)).min(LocalDate::compareTo).orElse(today);
        return workTime.calendar(from, today.plusDays(1));
    }
}
