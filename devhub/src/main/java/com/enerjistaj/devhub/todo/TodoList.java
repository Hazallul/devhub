package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Kişinin kendi oluşturduğu yapılacaklar listesi. */
@Entity
@Table(name = "todo_lists")
@Data
public class TodoList {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 9)
    private String color;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
