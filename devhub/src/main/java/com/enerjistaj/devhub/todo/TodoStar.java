package com.enerjistaj.devhub.todo;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Bir kişinin bir kartı "önemli" olarak işaretlemesi (kişiye özel; ortak listede başkasını etkilemez). */
@Entity
@Table(name = "todo_stars")
@Data
@NoArgsConstructor
public class TodoStar {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    public TodoStar(Long itemId, Long userId) {
        this.itemId = itemId;
        this.userId = userId;
    }
}
