package com.enerjistaj.devhub.onboarding;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Listesi açılmış kişi. Satır yoksa kişi için işe başlangıç listesi gösterilmez. */
@Entity
@Table(name = "onboarding_users")
@Data
public class OnboardingUser {
    @Id
    @Column(name = "user_id")
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by_id")
    private User startedBy;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
