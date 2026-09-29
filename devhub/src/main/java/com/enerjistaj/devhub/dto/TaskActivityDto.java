package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.TaskActivity;
import com.enerjistaj.devhub.entity.TaskActivityKind;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class TaskActivityDto {
    private Long id;
    private TaskActivityKind kind;
    private String message;
    private LocalDateTime createdAt;
    /** İşlemi yapan kişi; null ise sistem */
    private Long actorId;
    private String actorName;
    private String actorAvatarColor;

    public static TaskActivityDto from(TaskActivity a) {
        return TaskActivityDto.builder()
            .id(a.getId())
            .kind(a.getKind())
            .message(a.getMessage())
            .createdAt(a.getCreatedAt())
            .actorId(a.getActor() != null ? a.getActor().getId() : null)
            .actorName(a.getActor() != null ? a.getActor().getFullName() : null)
            .actorAvatarColor(a.getActor() != null ? a.getActor().getAvatarColor() : null)
            .build();
    }
}
