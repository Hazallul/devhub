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

    public static TaskDto from(Task t) {
        return TaskDto.builder()
            .id(t.getId())
            .userId(t.getUser().getId())
            .content(t.getContent())
            .createdAt(t.getCreatedAt())
            .status(t.getStatus())
            .priority(t.getPriority())
            .dueDate(t.getDueDate())
            .build();
    }
}
