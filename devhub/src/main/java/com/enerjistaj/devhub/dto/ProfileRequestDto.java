package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.ProfileChangeRequest;
import com.enerjistaj.devhub.entity.ProfileRequestState;
import java.time.LocalDateTime;

public record ProfileRequestDto(Long id, Long userId, String fullName, String jobTitle, String previousFullName, String previousJobTitle,
                                ProfileRequestState state, String decisionNote, String decidedByName, LocalDateTime decidedAt,
                                LocalDateTime createdAt) {
    public static ProfileRequestDto from(ProfileChangeRequest r) {
        return new ProfileRequestDto(r.getId(), r.getUser().getId(), r.getFullName(), r.getJobTitle(), r.getPreviousFullName(),
            r.getPreviousJobTitle(), r.getState(), r.getDecisionNote(), r.getDecidedBy() != null ? r.getDecidedBy().getFullName() : null,
            r.getDecidedAt(), r.getCreatedAt());
    }
}
