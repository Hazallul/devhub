package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.ProfileRequestDto;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.ProfileChangeRequest;
import com.enerjistaj.devhub.entity.ProfileRequestState;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ProfileChangeRequestRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Eski profil değişikliği talepleri. Ad soyad ve unvanı artık yalnızca yönetici değiştirir; çalışan yeni talep açamaz.
 * Önceden açılmış talepler burada listelenir, yönetici sonuçlandırabilir ya da sahibi geri çekebilir.
 */
@RestController
@RequestMapping("/api/profile-requests")
@RequiredArgsConstructor
public class ProfileRequestController {

    private final ActionLogService actionLogService;
    private final ProfileChangeRequestRepository requests;
    private final UserRepository users;
    private final CurrentUser currentUser;
    private final NotificationService notifications;

    /** Yönetici: tüm talepler (son 60). Çalışan: kendi son talepleri. */
    @GetMapping
    public ResponseEntity<List<ProfileRequestDto>> list() {
        User me = currentUser.get();
        List<ProfileChangeRequest> found = CurrentUser.isAdmin(me)
            ? requests.findTop60ByOrderByCreatedAtDesc()
            : requests.findTop10ByUserIdOrderByCreatedAtDesc(me.getId());
        return ResponseEntity.ok(found.stream().map(ProfileRequestDto::from).toList());
    }

    /** Kenar çubuğundaki rozet (yalnızca yönetici için anlamlı). */
    @GetMapping("/pending-count")
    public ResponseEntity<Map<String, Long>> pendingCount() {
        User me = currentUser.get();
        return ResponseEntity.ok(Map.of("count", CurrentUser.isAdmin(me) ? requests.countByState(ProfileRequestState.BEKLIYOR) : 0L));
    }

    /** decision: ONAYLANDI veya REDDEDILDI; note: çalışana gösterilecek açıklama (isteğe bağlı). */
    @PutMapping("/{id}/decision")
    @Transactional
    public ResponseEntity<ProfileRequestDto> decide(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin("Profil değişikliklerini yalnızca yöneticiler onaylayabilir.");
        ProfileChangeRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("Talep"));
        ProfileRequestState decision = Payloads.enumValue(body, "decision", ProfileRequestState.class, "karar");
        if (decision != ProfileRequestState.ONAYLANDI && decision != ProfileRequestState.REDDEDILDI) {
            throw ApiException.badRequest("Karar ONAYLANDI veya REDDEDILDI olmalı.");
        }
        if (r.getState() != ProfileRequestState.BEKLIYOR) throw ApiException.conflict("Bu talep zaten sonuçlandırılmış.");

        r.setState(decision);
        r.setDecisionNote(Payloads.optionalText(body, "note", 500, "Açıklama"));
        r.setDecidedBy(me);
        r.setDecidedAt(LocalDateTime.now());
        if (decision == ProfileRequestState.ONAYLANDI) {
            User user = r.getUser();
            user.setFullName(r.getFullName());
            user.setJobTitle(r.getJobTitle());
            users.save(user);
        }
        ProfileChangeRequest saved = requests.save(r);

        actionLogService.record(LogCategory.PROFIL, decision == ProfileRequestState.ONAYLANDI ? LogAction.ONAY : LogAction.RET,
                (decision == ProfileRequestState.ONAYLANDI ? "Profil değişikliği onaylandı: " : "Profil değişikliği reddedildi: ") + r.getUser().getFullName()).by(me)
                .target("PROFIL_TALEBI", saved.getId(), r.getUser().getFullName()).details(List.of(summary(saved).split(" · ")))
                .detail(saved.getDecisionNote() != null ? "Açıklama: " + saved.getDecisionNote() : null)
                .detail(decision == ProfileRequestState.ONAYLANDI ? "Değişiklik profile uygulandı" : null).save();
        String detail = summary(saved) + (saved.getDecisionNote() != null ? " — " + saved.getDecisionNote() : "");
        notifications.notify(r.getUser(), me, NotificationType.PROFILE_DECIDED,
            decision == ProfileRequestState.ONAYLANDI ? "Profil değişikliğiniz onaylandı" : "Profil değişikliğiniz reddedildi", detail, "/settings");
        return ResponseEntity.ok(ProfileRequestDto.from(saved));
    }

    /** Kişi bekleyen talebini geri çeker. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> withdraw(@PathVariable Long id) {
        User me = currentUser.get();
        ProfileChangeRequest r = requests.findById(id).filter(x -> x.getUser().getId().equals(me.getId()))
            .orElseThrow(() -> ApiException.notFound("Talep"));
        if (r.getState() != ProfileRequestState.BEKLIYOR) throw ApiException.conflict("Yalnızca bekleyen talepler geri çekilebilir.");
        r.setState(ProfileRequestState.IPTAL);
        requests.save(r);
        actionLogService.record(LogCategory.PROFIL, LogAction.GERI_CEKME, "Profil değişikliği talebi geri çekildi").by(me)
                .target("PROFIL_TALEBI", r.getId(), me.getFullName()).details(List.of(summary(r).split(" · "))).save();
        return ResponseEntity.noContent().build();
    }

    /** "Ad: Ali Yılmaz → Ali Y. Yılmaz · Unvan: Team Lead → Engineering Manager" */
    private static String summary(ProfileChangeRequest r) {
        StringBuilder sb = new StringBuilder();
        if (!r.getFullName().equals(r.getPreviousFullName())) sb.append("Ad: ").append(r.getPreviousFullName()).append(" → ").append(r.getFullName());
        if (!Objects.equals(r.getJobTitle(), r.getPreviousJobTitle())) {
            if (!sb.isEmpty()) sb.append(" · ");
            sb.append("Unvan: ").append(r.getPreviousJobTitle() == null ? "—" : r.getPreviousJobTitle())
              .append(" → ").append(r.getJobTitle() == null ? "—" : r.getJobTitle());
        }
        return sb.toString();
    }
}
