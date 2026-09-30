package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/** Kişisel yapılacak kartı. Yalnızca sahibi (user) görebilir ve değiştirebilir. */
@Entity
@Table(name = "todo_items")
@Data
public class TodoItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** null = varsayılan "Genel" listesi */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "list_id")
    private TodoList list;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 4000)
    private String note;

    @Column(nullable = false)
    private boolean done;

    @Column(name = "done_at")
    private LocalDateTime doneAt;

    @Column(nullable = false)
    private boolean important;

    /** "Bugün" görünümüne eklendiği gün; ertesi gün kendiliğinden düşer. */
    @Column(name = "my_day")
    private LocalDate myDay;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** Kartın saati; tarihle birlikte hatırlatma zamanını verir. */
    @Column(name = "due_time")
    private LocalTime dueTime;

    /** Bu tarih/saat için hatırlatma gönderildi mi (tarih veya saat değişince yeniden hesaplanır) */
    @Column(nullable = false)
    private boolean reminded;

    @Enumerated(EnumType.STRING)
    @Column(name = "repeat_rule")
    private TodoRepeat repeatRule;

    /** Kart bir DevHub görevinden plana eklendiyse o görevin id'si */
    @Column(name = "task_id")
    private Long taskId;

    @Column(nullable = false)
    private int position;

    /** Kart başka birinden geldiyse gönderen */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sent_by_id")
    private User sentBy;

    @Column(name = "sent_message", length = 500)
    private String sentMessage;

    /** Gelen kart açıldı mı (kendi oluşturduğu kartlarda hep true) */
    @Column(nullable = false)
    private boolean seen = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
