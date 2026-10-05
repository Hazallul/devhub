package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
@Data
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Atanan kişi; null = atanmamış (havuzda bekleyen) görev. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 1000)
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.YAPILACAK;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPriority priority = TaskPriority.ORTA;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /** Görevin ait olduğu proje (oluşturulurken kişinin o anki projesi). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(length = 4000)
    private String description;

    /** Görevi oluşturan/atayan kişi; null = bilinmiyor (eski kayıtlar). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    /** Tahmini iş gücü (dakika); eski görevlerde boş olabilir. */
    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    /** Harcanan süreye elle yapılan düzeltme (dakika, artı/eksi). Harcanan = çalışma oturumları + düzeltme. */
    @Column(name = "spent_adjust_minutes", nullable = false)
    private int spentAdjustMinutes;

    /** Durum değişince tamamlanma zamanı tutulur (raporlardaki tamamlanan görev sayıları için). */
    public void changeStatus(TaskStatus newStatus) {
        if (newStatus == TaskStatus.TAMAMLANDI && status != TaskStatus.TAMAMLANDI) completedAt = LocalDateTime.now();
        if (newStatus != TaskStatus.TAMAMLANDI) completedAt = null;
        status = newStatus;
    }
}
