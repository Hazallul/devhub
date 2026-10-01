package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Görevin "Devam Ediyor"da kaldığı bir zaman aralığı. ended_at null = hâlâ devam ediyor. Zamanlar UTC. */
@Entity
@Table(name = "task_work_sessions")
@Data
public class TaskWorkSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    /** Oturum sırasında görevin sahibi */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;
}
