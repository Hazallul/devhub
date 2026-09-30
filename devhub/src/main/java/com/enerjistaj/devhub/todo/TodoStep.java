package com.enerjistaj.devhub.todo;

import jakarta.persistence.*;
import lombok.Data;

/** Bir kartın alt adımı (kontrol listesi maddesi). */
@Entity
@Table(name = "todo_steps")
@Data
public class TodoStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private TodoItem item;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false)
    private boolean done;

    @Column(nullable = false)
    private int position;
}
