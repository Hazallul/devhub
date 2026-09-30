package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Bir listenin üyesi. Listeyi oluşturan ADMIN olarak eklenir; listedeki kartları yalnızca üyeler görür. */
@Entity
@Table(name = "todo_list_members")
@Data
public class TodoListMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "list_id", nullable = false)
    private TodoList list;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TodoListRole role = TodoListRole.MEMBER;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();
}
