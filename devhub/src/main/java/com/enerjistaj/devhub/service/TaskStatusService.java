package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.repository.TaskActivityRepository;
import com.enerjistaj.devhub.todo.TodoItem;
import com.enerjistaj.devhub.todo.TodoItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Görev durumu değişikliği tek yerden yapılır (görev sayfası ve kişisel plandaki bağlı kart aynı kuralı kullanır):
 * geçmişe kayıt düşer, tamamlanınca görevi atayan kişiye bildirim gider ve göreve bağlı açık kişisel kartlar da tamamlanır.
 */
@Service
@RequiredArgsConstructor
public class TaskStatusService {

    public static final Map<TaskStatus, String> STATUS_LABEL = Map.of(
        TaskStatus.YAPILACAK, "Yapılacak", TaskStatus.DEVAM, "Devam Ediyor", TaskStatus.TAMAMLANDI, "Tamamlandı");

    private final TaskActivityRepository activityRepository;
    private final NotificationService notificationService;
    private final TodoItemRepository todoItems;
    private final TaskTimeService taskTime;
    private final com.enerjistaj.devhub.taskextra.TaskExtrasService extras;
    private final com.enerjistaj.devhub.repository.TaskRepository tasks;
    /** Görev bitince haberdar olan modüller (ör. destek talepleri); döngüsel bağımlılık olmasın diye tembel. */
    private final org.springframework.beans.factory.ObjectProvider<TaskCompletionListener> completionListeners;

    /**
     * Durum aynıysa hiçbir şey yapmaz. Çağıran, görevi kaydetmekten sorumludur.
     * Atanmamış görev başlatılamaz; beklediği görevler bitmemiş görev de Devam Ediyor'a alınamaz ve tamamlanamaz.
     */
    public void change(Task t, TaskStatus status, User actor) {
        if (status == t.getStatus()) return;
        if (status != TaskStatus.YAPILACAK) {
            if (t.getUser() == null) throw com.enerjistaj.devhub.exception.ApiException.conflict("Önce görevi birine atayın; atanmamış görev başlatılamaz.");
            List<Object[]> open = t.getId() == null ? List.of() : extras.openBlockers(t.getId());
            if (!open.isEmpty()) {
                String names = open.stream().map(o -> "\"" + o[1] + "\"").collect(java.util.stream.Collectors.joining(", "));
                throw com.enerjistaj.devhub.exception.ApiException.conflict("Bu görev önce şunların bitmesini bekliyor: " + names + ".");
            }
        }
        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(actor);
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage("durumu değiştirdi: " + STATUS_LABEL.get(t.getStatus()) + " → " + STATUS_LABEL.get(status));
        activityRepository.save(a);
        taskTime.onStatusChange(t, t.getStatus(), status); // süre: Devam'a girince başlar, çıkınca durur
        t.changeStatus(status);
        if (status != TaskStatus.TAMAMLANDI) return;

        notifyUnblocked(t, actor);
        completionListeners.orderedStream().forEach(l -> l.taskCompleted(t, actor));
        if (t.getCreatedBy() != null && !t.getCreatedBy().getId().equals(t.getUser().getId())) {
            notificationService.notify(t.getCreatedBy(), actor, NotificationType.TASK_COMPLETED,
                t.getUser().getFullName() + " görevi tamamladı", t.getContent(), "/tasks?task=" + t.getId());
        }
        // Görev bitti: kişisel plandaki bağlı kartlar da biter.
        List<TodoItem> linked = todoItems.findByTaskIdAndDoneFalse(t.getId());
        for (TodoItem i : linked) {
            i.setDone(true);
            i.setDoneAt(LocalDateTime.now());
            i.setDoneBy(actor);
        }
        todoItems.saveAll(linked);
    }

    /** Görev bitti: onu bekleyen ve artık bekleyecek başka işi kalmayan görevlerin sahiplerine "başlayabilirsiniz" bildirimi. */
    private void notifyUnblocked(Task done, User actor) {
        for (Long waitingId : extras.waitingOn(done.getId())) {
            Task w = tasks.findById(waitingId).orElse(null);
            if (w == null || w.getUser() == null || w.getStatus() == TaskStatus.TAMAMLANDI) continue;
            boolean stillBlocked = extras.openBlockers(waitingId).stream().anyMatch(o -> !((Long) o[0]).equals(done.getId()));
            if (stillBlocked) continue;
            notificationService.notify(w.getUser(), actor, NotificationType.TASK_UNBLOCKED, "Görevinize başlayabilirsiniz",
                "\"" + done.getContent() + "\" tamamlandı; \"" + w.getContent() + "\" artık başlayabilir.", "/tasks?task=" + w.getId());
        }
    }
}
