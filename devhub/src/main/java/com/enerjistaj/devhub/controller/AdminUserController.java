package com.enerjistaj.devhub.controller;

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
    private static final String[] AVATAR_COLORS = {"#F6F0D7", "#C5D89D", "#9CAB84", "#89986D", "#E4D9B4", "#B7C4A0"};
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;

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
        currentUser.requireAdmin(ONLY_ADMIN);
        String email = normalizedEmail(payload);
        if (userRepository.existsByEmailIgnoreCase(email)) throw ApiException.conflict("Bu e-posta ile kayıtlı bir kullanıcı var.");

        String temporaryPassword = generatePassword();
        User user = User.builder()
                .email(email)
                .fullName(fullName(payload))
                .passwordHash(passwordEncoder.encode(temporaryPassword))
                .role(role(payload, Role.EMPLOYEE))
                .jobTitle(Payloads.optionalText(payload, "jobTitle", 100, "Unvan"))
                .hireDate(Payloads.date(payload, "hireDate", "İşe giriş tarihi"))
                .annualLeaveDays(leaveDays(payload, 14))
                .currentProject(project(payload))
                .status("AKTIF")
                .workMode("AKTIF")
                .avatarColor(AVATAR_COLORS[RANDOM.nextInt(AVATAR_COLORS.length)])
                .mustChangePassword(true)
                .build();
        User saved = userRepository.save(user);
        return ResponseEntity.ok(Map.of("user", UserDto.from(saved), "temporaryPassword", temporaryPassword));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<UserDto> update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);

        if (payload.containsKey("fullName")) user.setFullName(fullName(payload));
        if (payload.containsKey("email")) {
            String email = normalizedEmail(payload);
            if (!email.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(email)) {
                throw ApiException.conflict("Bu e-posta ile kayıtlı bir kullanıcı var.");
            }
            user.setEmail(email);
        }
        if (payload.containsKey("jobTitle")) user.setJobTitle(Payloads.optionalText(payload, "jobTitle", 100, "Unvan"));
        if (payload.containsKey("hireDate")) user.setHireDate(Payloads.date(payload, "hireDate", "İşe giriş tarihi"));
        if (payload.containsKey("annualLeaveDays")) user.setAnnualLeaveDays(leaveDays(payload, user.getAnnualLeaveDays()));
        if (payload.containsKey("role")) {
            Role role = role(payload, user.getRole());
            if (user.getRole() == Role.ADMIN && role != Role.ADMIN) ensureAnotherAdmin(user);
            if (user.getId().equals(me.getId()) && role != Role.ADMIN) {
                throw ApiException.conflict("Kendi yönetici yetkinizi kaldıramazsınız.");
            }
            user.setRole(role);
        }
        return ResponseEntity.ok(UserDto.from(userRepository.save(user)));
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
        user.setActive(active);
        return ResponseEntity.ok(UserDto.from(userRepository.save(user)));
    }

    /** Geçici şifre üretir; kullanıcı bir sonraki girişte değiştirmek zorundadır. Şifre yalnızca bu yanıtta görünür. */
    @PostMapping("/{id}/reset-password")
    @Transactional
    public ResponseEntity<Map<String, Object>> resetPassword(@PathVariable Long id) {
        currentUser.requireAdmin(ONLY_ADMIN);
        User user = find(id);
        String temporaryPassword = generatePassword();
        user.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        user.setMustChangePassword(true);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("temporaryPassword", temporaryPassword));
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

    private static int leaveDays(Map<String, Object> payload, int fallback) {
        Object v = payload.get("annualLeaveDays");
        if (v == null || v.toString().isBlank()) return fallback;
        try {
            int days = Integer.parseInt(v.toString().trim());
            if (days < 0 || days > 60) throw ApiException.badRequest("Yıllık izin hakkı 0 ile 60 gün arasında olmalı.");
            return days;
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Yıllık izin hakkı sayı olmalı.");
        }
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
}
