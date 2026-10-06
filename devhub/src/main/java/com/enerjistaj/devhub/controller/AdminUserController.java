package com.enerjistaj.devhub.controller;

import java.time.LocalDate;
import com.enerjistaj.devhub.service.LeavePolicy;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.UserDto;
import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Yönetici için kullanıcı yönetimi: ekleme, düzenleme, pasifleştirme ve geçici şifre ile sıfırlama. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private static final String ONLY_ADMIN = "Kullanıcı yönetimi yalnızca yöneticilere açıktır.";
    private static final String[] AVATAR_COLORS = {"#DCE7F8", "#D3E4F0", "#DDE3EE", "#E4DFF3", "#D6EBE7", "#EFE5D8"};
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ActionLogService actionLogService;
    private final com.enerjistaj.devhub.todo.TodoMembershipService todoMembershipService;
    private final com.enerjistaj.devhub.service.UserDeletionService userDeletionService;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;
    private final com.enerjistaj.devhub.realtime.RealtimeService realtime;
    private final com.enerjistaj.devhub.onboarding.OnboardingService onboarding;
    private final com.enerjistaj.devhub.service.UserOffboardingService offboarding;
    private final com.enerjistaj.devhub.service.SessionService sessionService;

    /** Pasifler dahil tüm kullanıcılar. */
    @GetMapping
    public ResponseEntity<List<UserDto>> list() {
        currentUser.requireAdmin(ONLY_ADMIN);
        return ResponseEntity.ok(userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::isActive).reversed().thenComparing(User::getFullName))
                .map(UserDto::from).toList());
    }

    /** Yeni kullanıcı geçici şifreyle oluşturulur; ilk girişte şifresini değiştirmesi istenir. */
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        String email = normalizedEmail(payload);
        if (userRepository.existsByEmailIgnoreCase(email)) throw ApiException.conflict("Bu e-posta ile kayıtlı bir kullanıcı var.");

        // Başlangıç şifresi: yönetici yazdıysa o (şifre kuralına uymalı), yazmadıysa rastgele üretilir.
        // Her iki durumda da kişi ilk girişte şifresini değiştirmeden uygulamayı kullanamaz.
        String chosen = Payloads.text(payload, "password");
        if (chosen != null && (chosen.length() < 8 || !chosen.matches(".*[A-Za-zÇĞİÖŞÜçğıöşü].*") || !chosen.matches(".*\\d.*"))) {
            throw ApiException.badRequest("Başlangıç şifresi en az 8 karakter olmalı ve harf ile rakam içermeli.");
        }
        String temporaryPassword = chosen != null ? chosen : generatePassword();
        User user = User.builder()
                .email(email)
                .fullName(fullName(payload))
                .passwordHash(passwordEncoder.encode(temporaryPassword))
                .role(role(payload, Role.EMPLOYEE))
                .jobTitle(Payloads.optionalText(payload, "jobTitle", 100, "Unvan"))
                .department(department(payload))
                .hireDate(hireDate(payload))
                .annualLeaveDays(0) // hak her zaman işe giriş tarihinden hesaplanır (LeavePolicy); sütun yalnızca bilgi amaçlı güncel tutulur
                .currentProject(project(payload))
                .status("AKTIF")
                .workMode("AKTIF")
                .avatarColor(AVATAR_COLORS[RANDOM.nextInt(AVATAR_COLORS.length)])
                .mustChangePassword(true)
                .build();
        User saved = userRepository.save(user);
        // İşe başlangıç listesi varsayılan olarak açılır; yönetici formda kapatabilir.
        boolean withOnboarding = !Boolean.FALSE.equals(payload.get("onboarding"));
        if (withOnboarding) onboarding.start(saved, me);
        actionLogService.record(LogCategory.KULLANICI, LogAction.OLUSTURMA, "Yeni kullanıcı oluşturuldu: " + saved.getFullName()).by(me)
                .target("KULLANICI", saved.getId(), saved.getFullName())
                .detail("E-posta: " + saved.getEmail())
                .detail("Rol: " + roleLabel(saved.getRole()))
                .detail(saved.getJobTitle() != null ? "Unvan: " + saved.getJobTitle() : null)
                .detail(saved.getDepartment() != null ? "Departman: " + saved.getDepartment() : null)
                .detail(saved.getCurrentProject() != null ? "Proje: " + saved.getCurrentProject() : null)
                .detail(saved.getHireDate() != null ? "İşe giriş: " + saved.getHireDate() : null)
                .detail("Yıllık izin hakkı: " + LeavePolicy.entitlement(saved.getHireDate(), LocalDate.now(ActionLogService.ZONE)) + " gün (kıdeme göre otomatik)")
                .detail(chosen != null ? "Başlangıç şifresini yönetici belirledi; ilk girişte değiştirilmesi zorunlu"
                        : "Başlangıç şifresi otomatik oluşturuldu; ilk girişte değiştirilmesi zorunlu")
                .detail(withOnboarding ? "İşe başlangıç listesi açıldı" : null)
                .level(saved.getRole() == Role.ADMIN ? LogLevel.KRITIK : LogLevel.BILGI).save();
        return ResponseEntity.ok(Map.of("user", UserDto.from(saved), "temporaryPassword", temporaryPassword));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<UserDto> update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);
        String oName = user.getFullName(), oEmail = user.getEmail(), oTitle = user.getJobTitle(), oDept = user.getDepartment();
        Object oHire = user.getHireDate();
        int oDays = LeavePolicy.entitlement(user.getHireDate(), LocalDate.now(ActionLogService.ZONE));
        Role oRole = user.getRole();

        if (payload.containsKey("fullName")) user.setFullName(fullName(payload));
        if (payload.containsKey("email")) {
            String email = normalizedEmail(payload);
            if (!email.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(email)) {
                throw ApiException.conflict("Bu e-posta ile kayıtlı bir kullanıcı var.");
            }
            user.setEmail(email);
        }
        if (payload.containsKey("jobTitle")) user.setJobTitle(Payloads.optionalText(payload, "jobTitle", 100, "Unvan"));
        if (payload.containsKey("department")) user.setDepartment(department(payload));
        if (payload.containsKey("hireDate")) user.setHireDate(hireDate(payload));
        if (payload.containsKey("role")) {
            Role role = role(payload, user.getRole());
            if (user.getRole() == Role.ADMIN && role != Role.ADMIN) ensureAnotherAdmin(user);
            if (user.getId().equals(me.getId()) && role != Role.ADMIN) {
                throw ApiException.conflict("Kendi yönetici yetkinizi kaldıramazsınız.");
            }
            user.setRole(role);
        }
        User saved = userRepository.save(user);
        boolean roleChanged = oRole != saved.getRole();
        List<String> changes = java.util.stream.Stream.of(
                ActionLogService.diff("Ad soyad", oName, saved.getFullName()),
                ActionLogService.diff("E-posta", oEmail, saved.getEmail()),
                ActionLogService.diff("Unvan", oTitle, saved.getJobTitle()),
                ActionLogService.diff("Departman", oDept, saved.getDepartment()),
                ActionLogService.diff("İşe giriş", oHire, saved.getHireDate()),
                ActionLogService.diff("Yıllık izin hakkı (gün)", oDays, LeavePolicy.entitlement(saved.getHireDate(), LocalDate.now(ActionLogService.ZONE))),
                ActionLogService.diff("Rol", roleLabel(oRole), roleLabel(saved.getRole()))).filter(java.util.Objects::nonNull).toList();
        if (!changes.isEmpty()) {
            actionLogService.record(LogCategory.KULLANICI, roleChanged ? LogAction.YETKI_DEGISIKLIGI : LogAction.GUNCELLEME,
                    (roleChanged ? "Kullanıcı yetkisi değiştirildi: " : "Kullanıcı bilgileri güncellendi: ") + saved.getFullName()).by(me)
                    .target("KULLANICI", saved.getId(), saved.getFullName()).details(changes)
                    .level(roleChanged ? LogLevel.KRITIK : LogLevel.BILGI).save();
        }
        return ResponseEntity.ok(UserDto.from(saved));
    }

    @PutMapping("/{id}/active")
    @Transactional
    public ResponseEntity<UserDto> setActive(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);
        boolean active = Payloads.flag(payload, "active");
        if (!active) {
            if (user.getId().equals(me.getId())) throw ApiException.conflict("Kendi hesabınızı pasifleştiremezsiniz.");
            if (user.getRole() == Role.ADMIN) ensureAnotherAdmin(user);
        }
        boolean wasActive = user.isActive();
        user.setActive(active);
        User saved = userRepository.save(user);
        List<String> handedOver = List.of();
        if (!active) {
            todoMembershipService.onUserDeactivated(saved);
            realtime.disconnect(saved.getId());
            handedOver = offboarding.deactivated(saved, me);
        }
        if (wasActive != active) {
            actionLogService.record(LogCategory.KULLANICI, active ? LogAction.AKTIFLESTIRME : LogAction.PASIFLESTIRME,
                    (active ? "Hesap yeniden etkinleştirildi: " : "Hesap pasifleştirildi: ") + saved.getFullName()).by(me)
                    .target("KULLANICI", saved.getId(), saved.getFullName())
                    .detail(active ? "Kişi yeniden giriş yapabilir" : "Kişi giriş yapamaz; açık oturumları da geçersiz sayılır")
                    .details(handedOver)
                    .level(active ? LogLevel.UYARI : LogLevel.KRITIK).save();
        }
        return ResponseEntity.ok(UserDto.from(saved));
    }

    /** İşe giriş tarihi: en fazla bir yıl sonrası (yeni başlayacak kişi) ve 1950'den sonra olmalı. */
    private static LocalDate hireDate(Map<String, Object> payload) {
        LocalDate d = Payloads.date(payload, "hireDate", "İşe giriş tarihi");
        if (d != null && (d.isAfter(LocalDate.now(ActionLogService.ZONE).plusYears(1)) || d.isBefore(LocalDate.of(1950, 1, 1)))) {
            throw ApiException.badRequest("İşe giriş tarihi geçersiz görünüyor; tarihi kontrol edin.");
        }
        return d;
    }

    /** Geçici şifre üretir; kullanıcı bir sonraki girişte değiştirmek zorundadır. Şifre yalnızca bu yanıtta görünür. */
    @PostMapping("/{id}/reset-password")
    @Transactional
    public ResponseEntity<Map<String, Object>> resetPassword(@PathVariable Long id) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);
        String temporaryPassword = generatePassword();
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        sessionService.passwordChanged(user, true);
        userRepository.save(user);
        actionLogService.record(LogCategory.KULLANICI, LogAction.SIFRE_SIFIRLAMA, "Geçici şifre oluşturuldu: " + user.getFullName()).by(me)
                .target("KULLANICI", user.getId(), user.getFullName())
                .detail("Eski şifre geçersiz, açık oturumları kapatıldı; kişi bir sonraki girişte şifresini değiştirmek zorunda")
                .detail("Şifrenin kendisi loglanmaz").level(LogLevel.KRITIK).save();
        return ResponseEntity.ok(Map.of("temporaryPassword", temporaryPassword));
    }

    /** Silmeden önce: kaç görev, izin, yorum ve kişisel kart silinecek, kaç ortak liste/duyuru devredilecek. */
    @GetMapping("/{id}/delete-impact")
    public ResponseEntity<Map<String, Long>> deleteImpact(@PathVariable Long id) {
        currentUser.requireAdmin(ONLY_ADMIN);
        return ResponseEntity.ok(userDeletionService.impact(find(id)));
    }

    /**
     * Hesabı kalıcı olarak siler. Yalnızca önceden pasifleştirilmiş hesaplar silinebilir (yanlışlıkla silmeye karşı iki adım);
     * kişi kendini silemez. Geri alınamaz; loglarda kişinin adı kalır.
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);
        if (user.getId().equals(me.getId())) throw ApiException.conflict("Kendi hesabınızı silemezsiniz.");
        if (user.isActive()) throw ApiException.conflict("Önce hesabı pasifleştirin; yalnızca pasif hesaplar kalıcı olarak silinebilir.");
        Map<String, Long> impact = userDeletionService.impact(user);
        String name = user.getFullName(), email = user.getEmail();
        actionLogService.record(LogCategory.KULLANICI, LogAction.SILME, "Kullanıcı kalıcı olarak silindi: " + name).by(me)
                .target("KULLANICI", user.getId(), name)
                .detail("E-posta: " + email)
                .detail("Silinen görev: " + impact.get("tasks") + ", izin kaydı: " + impact.get("leaves") + ", kişisel kart: " + impact.get("todos"))
                .detail(impact.get("sharedListsTransferred") > 0 ? "Devredilen ortak liste: " + impact.get("sharedListsTransferred") : null)
                .detail(impact.get("announcements") > 0 ? "Devredilen duyuru: " + impact.get("announcements") : null)
                .level(LogLevel.KRITIK).save();
        userDeletionService.delete(user, me);
        return ResponseEntity.noContent().build();
    }

    private static String roleLabel(Role role) {
        return role == Role.ADMIN ? "Yönetici" : "Çalışan";
    }

    private void ensureAnotherAdmin(User user) {
        if (user.isActive() && userRepository.countByActiveTrueAndRole(Role.ADMIN) <= 1) {
            throw ApiException.conflict("Sistemde en az bir aktif yönetici kalmalı.");
        }
    }

    private User find(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
    }

    private static String normalizedEmail(Map<String, Object> payload) {
        String email = Payloads.requiredText(payload, "email", "E-posta zorunludur.", 255, "E-posta").toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw ApiException.badRequest("Geçerli bir e-posta adresi girin.");
        return email;
    }

    private static String fullName(Map<String, Object> payload) {
        String name = Payloads.requiredText(payload, "fullName", "Ad soyad zorunludur.", 255, "Ad soyad");
        if (name.length() < 3) throw ApiException.badRequest("Ad soyad en az 3 karakter olmalı.");
        return name;
    }

    private static Role role(Map<String, Object> payload, Role fallback) {
        Role role = Payloads.enumValue(payload, "role", Role.class, "rol");
        return role != null ? role : fallback;
    }

    private String project(Map<String, Object> payload) {
        String name = Payloads.text(payload, "currentProject");
        if (name != null && !projectRepository.existsByName(name)) throw ApiException.notFound("Proje");
        return name;
    }

    private static String generatePassword() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) sb.append(PASSWORD_CHARS.charAt(RANDOM.nextInt(PASSWORD_CHARS.length())));
        // En az bir rakam içersin
        sb.setCharAt(RANDOM.nextInt(10), (char) ('2' + RANDOM.nextInt(8)));
        return sb.toString();
    }

    /** Departman adı: baştaki/sondaki boşluk atılır, ilk harf büyütülür ("destek" → "Destek") ki aynı ekip iki farklı yazımla bölünmesin. */
    private static String department(Map<String, Object> payload) {
        String d = Payloads.optionalText(payload, "department", 60, "Departman");
        if (d == null) return null;
        d = d.trim().replaceAll("\\s+", " ");
        return d.substring(0, 1).toUpperCase(new java.util.Locale("tr", "TR")) + d.substring(1);
    }
}
