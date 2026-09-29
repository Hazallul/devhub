package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.Notification;
import com.enerjistaj.devhub.entity.NotificationType;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class NotificationDto {
    private Long id;
    private NotificationType type;
    private String title;
    private String body;
    private String link;
    private boolean read;
    private LocalDateTime createdAt;
    private Long actorId;
    private String actorName;

    public static NotificationDto from(Notification n) {
        return NotificationDto.builder()
            .id(n.getId())
            .type(n.getType())
            .title(n.getTitle())
            .body(n.getBody())
            .link(n.getLink())
            .read(n.getReadAt() != null)
            .createdAt(n.getCreatedAt())
            .actorId(n.getActor() != null ? n.getActor().getId() : null)
            .actorName(n.getActor() != null ? n.getActor().getFullName() : null)
            .build();
    }
}
