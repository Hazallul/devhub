package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.AnnouncementDto;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.Announcement;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.AnnouncementRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final ActionLogService actionLogService;
    private final AnnouncementRepository announcementRepository;
    private final CurrentUser currentUser;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<AnnouncementDto>> getAnnouncements() {
        return ResponseEntity.ok(announcementRepository.findAllByOrderByPinnedDescCreatedAtDesc()
            .stream().map(AnnouncementDto::from).toList());
    }

    @PostMapping
    public ResponseEntity<AnnouncementDto> create(@RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin("Duyuruları yalnızca yöneticiler yayınlayabilir.");
        String title = Payloads.requiredText(payload, "title", "Başlık zorunludur.", 120, "Başlık");
        String content = Payloads.requiredText(payload, "content", "İçerik zorunludur.", 1000, "İçerik");

        Announcement a = new Announcement();
        a.setTitle(title);
        a.setContent(content);
        a.setAuthor(me);
        a.setPinned(Payloads.flag(payload, "pinned"));
        Announcement saved = announcementRepository.save(a);
        notificationService.notifyAll(me, NotificationType.ANNOUNCEMENT, "Yeni duyuru: " + title, content, "/");
        actionLogService.record(LogCategory.DUYURU, LogAction.YAYIN, "Duyuru yayınlandı: " + title).by(me)
                .target("DUYURU", saved.getId(), title)
                .detail(saved.isPinned() ? "Sabitlenmiş duyuru" : null)
                .detail("İçerik: " + (content.length() > 200 ? content.substring(0, 197) + "..." : content))
                .detail("Tüm aktif çalışanlara bildirim gönderildi").save();
        return ResponseEntity.ok(AnnouncementDto.from(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        User me = currentUser.requireAdmin("Duyuruları yalnızca yöneticiler kaldırabilir.");
        Announcement a = announcementRepository.findById(id).orElseThrow(() -> ApiException.notFound("Duyuru"));
        announcementRepository.delete(a);
        actionLogService.record(LogCategory.DUYURU, LogAction.SILME, "Duyuru kaldırıldı: " + a.getTitle()).by(me)
                .target("DUYURU", a.getId(), a.getTitle()).level(LogLevel.UYARI).save();
        return ResponseEntity.noContent().build();
    }
}
