package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Ad soyad / unvan değişikliği talebi: çalışan ister, yönetici onaylayınca profile uygulanır. */
@Entity
@Table(name = "profile_change_requests")
@Data
public class ProfileChangeRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "job_title", length = 100)
    private String jobTitle;

    /** Talep anındaki değerler (neyin neye değiştiği görülebilsin) */
    @Column(name = "previous_full_name", nullable = false)
    private String previousFullName;

    @Column(name = "previous_job_title", length = 100)
    private String previousJobTitle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProfileRequestState state = ProfileRequestState.BEKLIYOR;

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
