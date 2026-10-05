package com.enerjistaj.devhub.taskextra;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Görevin alt görevi (kontrol listesi maddesi). */
@Entity
@Table(name = "task_subtasks")
@Getter
@Setter
public class TaskSubtask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false)
    private boolean done;

    @Column(nullable = false)
    private int position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "done_by_id")
    private User doneBy;

    @Column(name = "done_at")
    private LocalDateTime doneAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
