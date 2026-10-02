package com.enerjistaj.devhub.passwordreset;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Şifremi unuttum talebi. Kod ve yeni şifre yalnızca BCrypt özeti olarak tutulur. */
@Entity
@Table(name = "password_reset_requests")
@Data
public class PasswordResetRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PasswordResetState state = PasswordResetState.KOD_BEKLIYOR;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "code_expires_at", nullable = false)
    private LocalDateTime codeExpiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "new_password_hash", length = 100)
    private String newPasswordHash;

    @Column(name = "request_ip", length = 64)
    private String requestIp;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
