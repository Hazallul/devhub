package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.ActionLog;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class LogDto {
    private Long id;
    private String message;
    private LocalDateTime createdAt;
    /** İşlemi yapan kişi; null ise sistem */
    private Long actorId;
    private String actorName;

    public static LogDto from(ActionLog l) {
        return LogDto.builder()
            .id(l.getId())
            .message(l.getMessage())
            .createdAt(l.getCreatedAt())
            .actorId(l.getActor() != null ? l.getActor().getId() : null)
            .actorName(l.getActor() != null ? l.getActor().getFullName() : null)
            .build();
    }
}
