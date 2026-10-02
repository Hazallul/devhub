package com.enerjistaj.devhub.passwordreset;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * /api/auth/password-reset/** oturumsuz çalışır (SecurityConfig /api/auth/** serbest); yönetici uçları /api/admin/password-resets.
 */
@RestController
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService service;
    private final CurrentUser currentUser;

    @PostMapping("/api/auth/password-reset/request")
    public ResponseEntity<Void> request(@RequestBody Map<String, Object> body) {
        service.request(text(body, "email"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/auth/password-reset/verify")
    public ResponseEntity<Void> verify(@RequestBody Map<String, Object> body) {
        service.verify(text(body, "email"), text(body, "code"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/auth/password-reset/complete")
    public ResponseEntity<Void> complete(@RequestBody Map<String, Object> body) {
        service.complete(text(body, "email"), text(body, "code"), text(body, "newPassword"));
        return ResponseEntity.noContent().build();
    }

    /** Bekleyenler önce, sonra son kararlar. */
    @GetMapping("/api/admin/password-resets")
    public ResponseEntity<List<PasswordResetDto>> list() {
        currentUser.requireAdmin("Şifre sıfırlama taleplerini yalnızca yöneticiler görebilir.");
        return ResponseEntity.ok(Stream.concat(service.pending().stream(), service.recentDecided().stream()).map(PasswordResetDto::from).toList());
    }

    @GetMapping("/api/admin/password-resets/pending-count")
    public ResponseEntity<Map<String, Long>> pendingCount() {
        User me = currentUser.get();
        return ResponseEntity.ok(Map.of("count", CurrentUser.isAdmin(me) ? service.pendingCount() : 0L));
    }

    /** decision: ONAYLANDI veya REDDEDILDI; note isteğe bağlı (kişiye e-postada gider). */
    @PutMapping("/api/admin/password-resets/{id}/decision")
    public ResponseEntity<PasswordResetDto> decide(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin("Şifre sıfırlama taleplerini yalnızca yöneticiler onaylayabilir.");
        String decision = text(body, "decision");
        if (!"ONAYLANDI".equals(decision) && !"REDDEDILDI".equals(decision)) throw ApiException.badRequest("Karar ONAYLANDI veya REDDEDILDI olmalı.");
        String note = Payloads.optionalText(body, "note", 500, "Açıklama");
        return ResponseEntity.ok(PasswordResetDto.from(service.decide(me, id, "ONAYLANDI".equals(decision), note)));
    }

    private static String text(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v == null ? null : v.toString();
    }
}
