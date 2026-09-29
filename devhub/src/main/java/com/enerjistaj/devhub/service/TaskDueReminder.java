package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskStatus;
import com.enerjistaj.devhub.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/** Son günü bugün veya yarın olan açık görevler için sahibine günde bir kez hatırlatma gönderir. */
@Component
@RequiredArgsConstructor
public class TaskDueReminder {

    private final TaskRepository taskRepository;
    private final NotificationService notificationService;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        remind();
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Europe/Istanbul")
    public void remind() {
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        for (Task t : taskRepository.findByStatusNotAndDueDateBetween(TaskStatus.TAMAMLANDI, today, today.plusDays(1))) {
            boolean dueToday = t.getDueDate().equals(today);
            notificationService.notifyOnce(
                    t.getUser(), NotificationType.TASK_DUE,
                    dueToday ? "Görevinizin son günü bugün" : "Görevinizin son günü yarın",
                    t.getContent(), "/tasks?task=" + t.getId(),
                    "task-due:" + t.getId() + ":" + t.getDueDate());
        }
    }
}
