package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Görevin geçmişi ve yorumları tek akışta tutulur. */
@Entity
@Table(name = "task_activity")
@Data
public class TaskActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    /** İşlemi yapan / yorumu yazan kişi; null ise sistem */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskActivityKind kind;

    /** İşlemi yapanın adını içermez (ör. "durumu değiştirdi: Yapılacak → Devam Ediyor"); ad actor'dan gelir. */
    @Column(nullable = false, length = 1000)
    private String message;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
