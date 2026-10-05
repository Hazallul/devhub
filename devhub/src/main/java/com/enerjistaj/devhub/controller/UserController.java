package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.entity.UserLink;
import com.enerjistaj.devhub.entity.UserLinkType;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.UserDto;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ActionLogService actionLogService;
    private final UserStatusService userStatusService;
    private final CurrentUser currentUser;
    private final LeaveRequestRepository leaveRepository;
    private final NotificationService notificationService;
    private final PasswordEncoder passwordEncoder;
    private final com.enerjistaj.devhub.service.SessionService sessionService;
    private final com.enerjistaj.devhub.security.JwtUtils jwtUtils;

    /** Aktif kullanıcılar; pasif hesaplar ekip listelerinde görünmez (tümü için /api/admin/users). */
    @GetMapping
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findByActiveTrue().stream().map(UserDto::from).toList());
    }

    /** Diğer cihazlardaki oturumlar kapanır; bu tarayıcı yanıttaki yeni token'la devam eder. */
    @PutMapping("/me/password")
    public ResponseEntity<com.enerjistaj.devhub.dto.LoginResponse> changePassword(@RequestBody Map<String, Object> payload) {
        User me = currentUser.get();
        String current = payload.get("currentPassword") == null ? "" : payload.get("currentPassword").toString();
        String next = payload.get("newPassword") == null ? "" : payload.get("newPassword").toString();
        if (!passwordEncoder.matches(current, me.getPasswordHash())) throw ApiException.badRequest("Mevcut şifre hatalı.");
        if (next.length() < 8 || !next.matches(".*[A-Za-zÇĞİÖŞÜçğıöşü].*") || !next.matches(".*\\d.*")) {
            throw ApiException.badRequest("Yeni şifre en az 8 karakter olmalı ve harf ile rakam içermeli.");
        }
        if (passwordEncoder.matches(next, me.getPasswordHash())) throw ApiException.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");
        boolean forced = me.isMustChangePassword();
        me.setPasswordHash(passwordEncoder.encode(next));
        me.setMustChangePassword(false);
        sessionService.passwordChanged(me, false);
        User saved = userRepository.save(me);
        actionLogService.record(LogCategory.OTURUM, LogAction.SIFRE_DEGISTIRME, "Şifresini değiştirdi").by(me)
                .target("KULLANICI", me.getId(), me.getFullName())
                .detail(forced ? "Geçici şifre ilk girişte değiştirildi" : "Kullanıcı kendi isteğiyle değiştirdi")
                .detail("Diğer açık oturumlar kapatıldı").save();
        return ResponseEntity.ok(com.enerjistaj.devhub.dto.LoginResponse.builder()
                .token(jwtUtils.generateToken(saved.getEmail(), saved.getSessionVersion()))
                .user(UserDto.from(saved)).build());
    }

    @PutMapping("/{id}/project")
    public ResponseEntity<UserDto> updateUserProject(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin("Proje ataması yalnızca yöneticiler tarafından yapılabilir.");
        User user = findUser(id);
        String oldProject = user.getCurrentProject();
        String newProject = Payloads.text(payload, "currentProject"); // null → projeden çıkar

        if (newProject != null && !projectRepository.existsByName(newProject)) throw ApiException.notFound("Proje");
        if (Objects.equals(oldProject, newProject)) return ResponseEntity.ok(UserDto.from(user));

        user.setCurrentProject(newProject);
        User saved = userRepository.save(user);

        if (newProject == null) {
            actionLogService.record(LogCategory.PROJE, LogAction.PROJEDEN_CIKARMA,
                    user.getFullName() + ", " + (oldProject != null ? oldProject : "mevcut") + " projesinden çıkarıldı").by(me)
                    .target("KULLANICI", user.getId(), user.getFullName()).change("Proje", oldProject, null)
                    .detail("Kişi şu an bir projeye bağlı değil").save();
            notificationService.notify(user, me, NotificationType.PROJECT_ASSIGNED,
                    "\"" + (oldProject != null ? oldProject : "Proje") + "\" projesinden çıkarıldınız", null, "/projects");
        } else {
            actionLogService.record(LogCategory.PROJE, LogAction.PROJE_ATAMA, user.getFullName() + ", " + newProject + " projesine atandı").by(me)
                    .target("KULLANICI", user.getId(), user.getFullName()).change("Proje", oldProject, newProject).save();
            notificationService.notify(user, me, NotificationType.PROJECT_ASSIGNED,
                    "\"" + newProject + "\" projesine atandınız", null, "/projects");
        }
        return ResponseEntity.ok(UserDto.from(saved));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<UserDto> updateUserStatus(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireSelfOrAdmin(id, "Yalnızca kendi durumunuzu değiştirebilirsiniz.");
        String newStatus = Payloads.text(payload, "status");
        if (newStatus == null || !UserStatusService.ALL.contains(newStatus)) throw ApiException.badRequest("Geçersiz durum.");
        User user = findUser(id);
        if (!CurrentUser.isAdmin(me) && !UserStatusService.selfServiceOptions(user).contains(newStatus)) {
            if (UserStatusService.IZINLI.equals(user.getStatus())) {
                throw ApiException.forbidden("İzinliyken durumunuzu yalnızca yönetici değiştirebilir.");
            }
            if (UserStatusService.IZINLI.equals(newStatus)) {
                throw ApiException.forbidden("İzinli durumuna geçmek için İzinler sayfasından talep oluşturun.");
            }
            throw ApiException.forbidden("Aktif/Uzaktan çalışma şeklinizi yalnızca yönetici değiştirebilir; siz Toplantıda ile "
                    + ("UZAKTAN".equals(user.getWorkMode()) ? "Uzaktan" : "Aktif") + " arasında geçiş yapabilirsiniz.");
        }
        // İzinli durumu takvimde görünen gerçek bir izin kaydına dayanmalı; kayıt POST /api/leaves ile (yönetici için userId ile, doğrudan onaylı) açılır.
        if (UserStatusService.IZINLI.equals(newStatus) && !leaveRepository.existsApprovedOn(user.getId(), LocalDate.now(ActionLogService.ZONE))) {
            throw ApiException.badRequest("Kişiyi İzinli yapmak için izin türü ve tarihleriyle bir izin kaydı oluşturun.");
        }
        return ResponseEntity.ok(UserDto.from(userStatusService.change(user, newStatus, me)));
    }

    /**
     * Avatar rengini herkes kendisi değiştirir. Ad soyad ve unvanı yalnızca yönetici doğrudan değiştirebilir;
     * çalışanlar bunun için ProfileRequestController üzerinden onay talebi açar.
     */
    @PutMapping("/{id}/profile")
    public ResponseEntity<UserDto> updateProfile(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireSelfOrAdmin(id, "Yalnızca kendi profilinizi düzenleyebilirsiniz.");
        User user = findUser(id);
        String oldName = user.getFullName();
        String oldTitle = user.getJobTitle();

        String avatarColor = Payloads.text(payload, "avatarColor");
        if (avatarColor != null && !avatarColor.matches("^#[0-9A-Fa-f]{6}$")) throw ApiException.badRequest("Avatar rengi #RRGGBB biçiminde olmalı.");
        if (avatarColor != null) user.setAvatarColor(avatarColor);

        if (payload.containsKey("fullName") || payload.containsKey("jobTitle")) {
            String fullName = payload.containsKey("fullName")
                ? Payloads.requiredText(payload, "fullName", "Ad soyad zorunludur.", 255, "Ad soyad") : user.getFullName();
            if (fullName.length() < 3) throw ApiException.badRequest("Ad soyad en az 3 karakter olmalı.");
            String jobTitle = payload.containsKey("jobTitle") ? Payloads.optionalText(payload, "jobTitle", 100, "Unvan") : user.getJobTitle();
            boolean changed = !fullName.equals(user.getFullName()) || !java.util.Objects.equals(jobTitle, user.getJobTitle());
            if (changed && !CurrentUser.isAdmin(me)) {
                throw ApiException.forbidden("Ad soyad ve unvanı yalnızca yönetici değiştirebilir.");
            }
            user.setFullName(fullName);
            user.setJobTitle(jobTitle);
        }
        User saved = userRepository.save(user);
        if (!saved.getFullName().equals(oldName) || !java.util.Objects.equals(saved.getJobTitle(), oldTitle)) {
            actionLogService.record(LogCategory.PROFIL, LogAction.GUNCELLEME, "Profil bilgileri doğrudan güncellendi: " + saved.getFullName()).by(me)
                    .target("KULLANICI", saved.getId(), saved.getFullName())
                    .change("Ad soyad", oldName, saved.getFullName()).change("Unvan", oldTitle, saved.getJobTitle()).save();
        }
        return ResponseEntity.ok(UserDto.from(saved));
    }

    /**
     * Kişinin kendi iletişim bilgileri ve bağlantıları (onay gerekmez). Gövde: { links: [{ type, label?, value }] };
     * liste olduğu gibi yenisiyle değiştirilir.
     */
    @PutMapping("/me/links")
    @Transactional
    public ResponseEntity<UserDto> updateLinks(@RequestBody Map<String, Object> payload) {
        User user = currentUser.get();
        if (!(payload.get("links") instanceof List<?> raw)) throw ApiException.badRequest("Bağlantı listesi gerekli.");
        if (raw.size() > 12) throw ApiException.badRequest("En fazla 12 bağlantı eklenebilir.");

        List<UserLink> next = new ArrayList<>();
        for (Object o : raw) {
            if (!(o instanceof Map<?, ?> m)) throw ApiException.badRequest("Geçersiz bağlantı.");
            @SuppressWarnings("unchecked") Map<String, Object> item = (Map<String, Object>) m;
            UserLinkType type = Payloads.enumValue(item, "type", UserLinkType.class, "bağlantı türü");
            if (type == null) throw ApiException.badRequest("Bağlantı türü seçin.");
            UserLink link = new UserLink();
            link.setUser(user);
            link.setType(type);
            link.setLabel(Payloads.optionalText(item, "label", 40, "Etiket"));
            link.setValue(normalizeLink(type, Payloads.requiredText(item, "value", "Bağlantı boş olamaz.", 300, "Bağlantı")));
            if (next.stream().anyMatch(x -> x.getType() == link.getType() && x.getValue().equalsIgnoreCase(link.getValue()))) continue; // aynısı zaten var
            link.setPosition(next.size());
            next.add(link);
        }
        user.getLinks().clear();
        userRepository.saveAndFlush(user); // eski satırlar önce silinsin
        user.getLinks().addAll(next);
        User saved = userRepository.save(user);
        actionLogService.record(LogCategory.PROFIL, LogAction.GUNCELLEME, "İletişim bilgilerini güncelledi").by(user)
                .target("KULLANICI", user.getId(), user.getFullName())
                .detail("Bağlantı sayısı: " + next.size())
                .detail(next.stream().map(l -> l.getType().name()).distinct().collect(java.util.stream.Collectors.joining(", ", "Türler: ", ""))).save();
        return ResponseEntity.ok(UserDto.from(saved));
    }

    /** E-posta ve telefon biçim kontrolü; web adresleri yalnızca http(s) olabilir (şema yoksa https eklenir). */
    private static String normalizeLink(UserLinkType type, String value) {
        switch (type) {
            case EMAIL -> {
                if (!value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw ApiException.badRequest("Geçerli bir e-posta adresi girin: " + value);
                return value.toLowerCase(java.util.Locale.ROOT);
            }
            case PHONE -> {
                if (!value.matches("^\\+?[0-9 ()-]{5,25}$")) throw ApiException.badRequest("Geçerli bir telefon numarası girin: " + value);
                return value;
            }
            default -> {
                String url = value.matches("(?i)^https?://.*") ? value : "https://" + value;
                try {
                    java.net.URI uri = new java.net.URI(url);
                    if (uri.getHost() == null || !uri.getHost().contains(".")) throw new IllegalArgumentException();
                } catch (Exception e) {
                    throw ApiException.badRequest("Geçerli bir web adresi girin: " + value);
                }
                return url;
            }
        }
    }

    private User findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
    }
}
