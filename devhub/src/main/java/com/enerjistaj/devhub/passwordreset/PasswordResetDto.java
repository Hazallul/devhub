package com.enerjistaj.devhub.passwordreset;

import java.time.LocalDateTime;

/** Yöneticinin gördüğü talep: kod ve şifre özeti asla dışarı çıkmaz. */
public record PasswordResetDto(Long id, Long userId, String userName, String userEmail, PasswordResetState state,
                               LocalDateTime createdAt, LocalDateTime verifiedAt, String requestIp,
                               String decisionNote, String decidedByName, LocalDateTime decidedAt) {
    public static PasswordResetDto from(PasswordResetRequest r) {
        return new PasswordResetDto(r.getId(), r.getUser().getId(), r.getUser().getFullName(), r.getUser().getEmail(), r.getState(),
            r.getCreatedAt(), r.getVerifiedAt(), r.getRequestIp(), r.getDecisionNote(),
            r.getDecidedBy() != null ? r.getDecidedBy().getFullName() : null, r.getDecidedAt());
    }
}
