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

    /** Durum aynıysa hiçbir şey yapmaz. Çağıran, görevi kaydetmekten sorumludur. */
    public void change(Task t, TaskStatus status, User actor) {
        if (status == t.getStatus()) return;
        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(actor);
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage("durumu değiştirdi: " + STATUS_LABEL.get(t.getStatus()) + " → " + STATUS_LABEL.get(status));
        activityRepository.save(a);
        t.changeStatus(status);
        if (status != TaskStatus.TAMAMLANDI) return;

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
}
