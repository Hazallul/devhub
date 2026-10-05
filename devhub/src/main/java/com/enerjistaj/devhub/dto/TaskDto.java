package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskPriority;
import com.enerjistaj.devhub.entity.TaskStatus;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class TaskDto {
    private Long id;
    private Long userId;
    private String content;
    private LocalDateTime createdAt;
    private TaskStatus status;
    private TaskPriority priority;
    private LocalDate dueDate;
    private Long projectId;
    private LocalDateTime completedAt;
    private String description;
    /** Görevi oluşturan/atayan kişi; null = bilinmiyor */
    private Long createdById;
    private String createdByName;
    private long commentCount;
    /** Tahmini iş gücü (dakika); eski görevlerde null */
    private Integer estimatedMinutes;
    /** Harcanan çalışma süresi (saniye, yalnızca mesai saatleri, düzeltme dahil) */
    private long spentSeconds;
    /** Görev şu an Devam Ediyor'da (çalışma oturumu açık) */
    private boolean running;
    /** Oturum açık ve şu an mesai saati: süre canlı artıyor (istemci saniyeyi kendisi ilerletir) */
    private boolean ticking;
    /** İlk kez Devam Ediyor'a alındığı an (UTC); hiç başlanmadıysa null */
    private LocalDateTime startedAt;
    /** Etiketler (kimlik), alt görev ilerlemesi, dosya eki sayısı */
    private java.util.List<Long> labelIds;
    private int subtasksDone;
    private int subtasksTotal;
    private int attachmentCount;
    /** Bu görevin beklediği görevler; openBlockerIds henüz bitmemiş olanlar (varsa görev başlayamaz) */
    private java.util.List<Long> blockerIds;
    private java.util.List<Long> openBlockerIds;
    /** Bu görevi bekleyen görev sayısı */
    private int blockingCount;

    public TaskDto withExtras(com.enerjistaj.devhub.taskextra.TaskExtrasService.Extras e) {
        if (e == null) e = new com.enerjistaj.devhub.taskextra.TaskExtrasService.Extras(java.util.List.of(), 0, 0, 0, java.util.List.of(), java.util.List.of(), 0);
        labelIds = e.labelIds();
        subtasksDone = e.subtasksDone();
        subtasksTotal = e.subtasksTotal();
        attachmentCount = e.attachmentCount();
        blockerIds = e.blockerIds();
        openBlockerIds = e.openBlockerIds();
        blockingCount = e.blockingCount();
        return this;
    }

    public static TaskDto from(Task t) {
        return from(t, 0);
    }

    public static TaskDto from(Task t, long commentCount) {
        return TaskDto.builder()
            .id(t.getId())
            .userId(t.getUser() != null ? t.getUser().getId() : null)
            .content(t.getContent())
            .createdAt(t.getCreatedAt())
            .status(t.getStatus())
            .priority(t.getPriority())
            .dueDate(t.getDueDate())
            .projectId(t.getProject() != null ? t.getProject().getId() : null)
            .completedAt(t.getCompletedAt())
            .description(t.getDescription())
            .createdById(t.getCreatedBy() != null ? t.getCreatedBy().getId() : null)
            .createdByName(t.getCreatedBy() != null ? t.getCreatedBy().getFullName() : null)
            .commentCount(commentCount)
            .estimatedMinutes(t.getEstimatedMinutes())
            .build();
    }
}
