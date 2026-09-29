package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "action_logs")
@Data
public class ActionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String message;

    /** İşlemi yapan kişi; null ise sistem (ör. gece çalışan izin zamanlayıcısı). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
