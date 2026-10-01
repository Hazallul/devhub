package com.enerjistaj.devhub.onboarding;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/** İşe başlangıç listesinin bir adımı (tek şablon, yönetici düzenler). */
@Entity
@Table(name = "onboarding_steps")
@Data
public class OnboardingStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(length = 500)
    private String description;

    /** Uygulama içi adres (ör. /docs/git-akisi) */
    @Column(length = 255)
    private String link;

    /** null = kişi kendisi işaretler */
    @Enumerated(EnumType.STRING)
    @Column(name = "auto_rule", length = 20)
    private OnboardingRule autoRule;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
