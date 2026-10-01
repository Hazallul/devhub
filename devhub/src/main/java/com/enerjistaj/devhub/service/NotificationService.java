package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.dto.NotificationDto;
import com.enerjistaj.devhub.entity.Notification;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.realtime.RealtimeService;
import com.enerjistaj.devhub.repository.NotificationRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Kişiye özel bildirimler. Kişi kendi yaptığı işlem için bildirim almaz; pasif hesaplara bildirim gitmez. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final RealtimeService realtime;

    public void notify(User recipient, User actor, NotificationType type, String title, String body, String link) {
        if (recipient == null || !recipient.isActive()) return;
        if (actor != null && actor.getId().equals(recipient.getId())) return;
        save(recipient, actor, type, title, body, link, null);
    }

    /** Aynı refKey ile daha önce bildirim oluşturulduysa tekrar oluşturmaz (ör. günlük hatırlatmalar). */
    public void notifyOnce(User recipient, NotificationType type, String title, String body, String link, String refKey) {
        if (recipient == null || !recipient.isActive()) return;
        if (notificationRepository.existsByUserIdAndRefKey(recipient.getId(), refKey)) return;
        save(recipient, null, type, title, body, link, refKey);
    }

    public void notifyAdmins(User actor, NotificationType type, String title, String body, String link) {
        userRepository.findByActiveTrueAndRole(Role.ADMIN).forEach(a -> notify(a, actor, type, title, body, link));
    }

    public void notifyAll(User actor, NotificationType type, String title, String body, String link) {
        userRepository.findByActiveTrue().forEach(u -> notify(u, actor, type, title, body, link));
    }

    private void save(User recipient, User actor, NotificationType type, String title, String body, String link, String refKey) {
        Notification n = new Notification();
        n.setUser(recipient);
        n.setActor(actor);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body != null && body.length() > 500 ? body.substring(0, 497) + "..." : body);
        n.setLink(link);
        n.setRefKey(refKey);
        Notification saved = notificationRepository.save(n);
        // Açık sekmelere anında düşer (kayıt veritabanına yazıldıktan sonra).
        realtime.notification(recipient.getId(), NotificationDto.from(saved));
    }
}
