package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.TaskActivityRepository;
import com.enerjistaj.devhub.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Hesabı kapatılan kişinin yarım kalan işleri kimseyi beklemesin: açık görevleri atanmamış havuza döner,
 * bekleyen ve henüz başlamamış onaylı izinleri iptal edilir; diğer modüller (talepler, anketler)
 * UserDeactivationListener ile kendi işlerini toparlar. Hesap yeniden açılırsa hiçbir şey geri atanmaz.
 */
@Service
@RequiredArgsConstructor
public class UserOffboardingService {

    static final String LEAVE_NOTE = "Hesap kapatıldığı için iptal edildi.";

    private final TaskRepository tasks;
    private final TaskActivityRepository activity;
    private final TaskStatusService taskStatus;
    private final TaskTimeService taskTime;
    private final LeaveRequestRepository leaves;
    private final ObjectProvider<UserDeactivationListener> listeners;

    /** Yapılanların kısa özeti (log ayrıntısı). */
    @Transactional
    public List<String> deactivated(User user, User actor) {
        List<String> summary = new ArrayList<>();
        taskTime.closeAllFor(user);

        int moved = 0;
        for (Task t : tasks.findByUserIdOrderByCreatedAtDesc(user.getId())) {
            if (t.getStatus() == TaskStatus.TAMAMLANDI) continue;
            // Atanmamış görev yalnızca Yapılacak'ta durabilir; durum değişikliği her zaman TaskStatusService'ten.
            if (t.getStatus() != TaskStatus.YAPILACAK) taskStatus.change(t, TaskStatus.YAPILACAK, actor);
            t.setUser(null);
            tasks.save(t);
            TaskActivity a = new TaskActivity();
            a.setTask(t);
            a.setActor(actor);
            a.setKind(TaskActivityKind.EVENT);
            a.setMessage(user.getFullName() + " kişisinin hesabı kapatıldığı için görev atanmamış havuza döndü");
            activity.save(a);
            moved++;
        }
        if (moved > 0) summary.add(moved + " açık görev atanmamış havuza döndü");

        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        int cancelled = 0;
        for (LeaveRequest l : leaves.findByUserId(user.getId())) {
            boolean pending = l.getState() == LeaveState.BEKLIYOR;
            boolean upcoming = l.getState() == LeaveState.ONAYLANDI && l.getStartDate().isAfter(today);
            if (!pending && !upcoming) continue;
            l.setState(LeaveState.IPTAL);
            l.setDecidedBy(actor);
            l.setDecidedAt(LocalDateTime.now());
            l.setDecisionNote(LEAVE_NOTE);
            leaves.save(l);
            cancelled++;
        }
        if (cancelled > 0) summary.add(cancelled + " bekleyen ya da ileri tarihli izin iptal edildi");

        listeners.orderedStream().forEach(l -> summary.addAll(l.userDeactivated(user, actor)));
        return summary;
    }
}
