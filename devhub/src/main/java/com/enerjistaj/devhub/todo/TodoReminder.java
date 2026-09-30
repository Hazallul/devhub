package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/** Saati gelen açık kartlar için sahibine (ortak listede tüm üyelere) bir kez hatırlatma bildirimi gönderir (dakikada bir bakar). */
@Component
@RequiredArgsConstructor
public class TodoReminder {

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final TodoItemRepository items;
    private final TodoListMemberRepository members;
    private final NotificationService notifications;

    @Scheduled(fixedDelay = 60_000, initialDelay = 20_000)
    @Transactional
    public void remind() {
        LocalDateTime now = LocalDateTime.now(ActionLogService.ZONE);
        for (TodoItem i : items.findDueReminders(now.toLocalDate())) {
            if (i.getDueDate().atTime(i.getDueTime()).isAfter(now)) continue;
            i.setReminded(true);
            String title = "Hatırlatma · " + i.getDueTime().format(HM);
            String link = "/todo?item=" + i.getId();
            if (i.getList() == null) {
                notifications.notify(i.getUser(), null, NotificationType.TODO_REMINDER, title, i.getTitle(), link);
            } else {
                // Listedeki kart: listenin tüm üyelerine hatırlatılır (tek üyeli listede yalnızca sahibine).
                members.findByListIdOrderByJoinedAtAscIdAsc(i.getList().getId())
                    .forEach(m -> notifications.notify(m.getUser(), null, NotificationType.TODO_REMINDER, title, i.getTitle(), link));
            }
        }
    }
}
