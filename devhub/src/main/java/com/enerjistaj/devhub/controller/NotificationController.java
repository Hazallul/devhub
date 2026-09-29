package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.NotificationDto;
import com.enerjistaj.devhub.entity.Notification;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.NotificationRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Oturumdaki kullanıcının bildirimleri. */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<List<NotificationDto>> list(@RequestParam(defaultValue = "30") int limit) {
        User me = currentUser.get();
        return ResponseEntity.ok(notificationRepository
                .findByUserIdOrderByCreatedAtDesc(me.getId(), PageRequest.of(0, Math.min(Math.max(limit, 1), 100)))
                .stream().map(NotificationDto::from).toList());
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount() {
        return ResponseEntity.ok(Map.of("count", notificationRepository.countByUserIdAndReadAtIsNull(currentUser.get().getId())));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markRead(@PathVariable Long id) {
        User me = currentUser.get();
        Notification n = notificationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Bildirim"));
        if (!n.getUser().getId().equals(me.getId())) throw ApiException.notFound("Bildirim");
        if (n.getReadAt() == null) n.setReadAt(LocalDateTime.now());
        return ResponseEntity.ok(NotificationDto.from(notificationRepository.save(n)));
    }

    @PutMapping("/read-all")
    @Transactional
    public ResponseEntity<Map<String, Integer>> markAllRead() {
        int updated = notificationRepository.markAllRead(currentUser.get().getId(), LocalDateTime.now());
        return ResponseEntity.ok(Map.of("updated", updated));
    }
}
