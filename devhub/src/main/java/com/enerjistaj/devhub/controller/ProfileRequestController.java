package com.enerjistaj.devhub.controller;

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
 * Ad soyad ve unvan kişinin kimliğidir; çalışan bunları doğrudan değiştiremez, talep açar ve yönetici onaylar.
 * (Avatar rengi ve iletişim bağlantıları onay gerektirmez; yöneticiler profilleri doğrudan düzenleyebilir.)
 */
@RestController
@RequestMapping("/api/profile-requests")
@RequiredArgsConstructor
public class ProfileRequestController {

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

    @PostMapping
    @Transactional
    public ResponseEntity<ProfileRequestDto> create(@RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        if (CurrentUser.isAdmin(me)) throw ApiException.badRequest("Yöneticiler profil bilgilerini doğrudan değiştirebilir.");
        String fullName = Payloads.requiredText(body, "fullName", "Ad soyad zorunludur.", 255, "Ad soyad");
        if (fullName.length() < 3) throw ApiException.badRequest("Ad soyad en az 3 karakter olmalı.");
        String jobTitle = Payloads.optionalText(body, "jobTitle", 100, "Unvan");
        if (fullName.equals(me.getFullName()) && Objects.equals(jobTitle, me.getJobTitle())) {
            throw ApiException.badRequest("Ad soyad veya unvanda bir değişiklik yok.");
        }

        // Bekleyen eski talep varsa yenisi onun yerine geçer.
        requests.findByUserIdAndState(me.getId(), ProfileRequestState.BEKLIYOR).forEach(old -> old.setState(ProfileRequestState.IPTAL));

        ProfileChangeRequest r = new ProfileChangeRequest();
        r.setUser(me);
        r.setFullName(fullName);
        r.setJobTitle(jobTitle);
        r.setPreviousFullName(me.getFullName());
        r.setPreviousJobTitle(me.getJobTitle());
        ProfileChangeRequest saved = requests.save(r);

        notifications.notifyAdmins(me, NotificationType.PROFILE_REQUESTED, me.getFullName() + " profil değişikliği istedi", summary(saved), "/users");
        return ResponseEntity.ok(ProfileRequestDto.from(saved));
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
