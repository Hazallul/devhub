package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Karta yazılan yorum. Kartı görebilen herkes (ortak listede tüm üyeler) okur ve yazar. */
@Entity
@Table(name = "todo_comments")
@Data
public class TodoComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private TodoItem item;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
