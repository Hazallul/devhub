package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Bildirimi alan kişi */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Bildirime yol açan işlemi yapan kişi; null ise sistem */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(length = 500)
    private String body;

    /** Tıklanınca gidilecek frontend yolu, ör. /leaves */
    @Column(length = 200)
    private String link;

    /** Aynı olay için tekrar bildirim oluşmasını önleyen anahtar */
    @Column(name = "ref_key", length = 120)
    private String refKey;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
