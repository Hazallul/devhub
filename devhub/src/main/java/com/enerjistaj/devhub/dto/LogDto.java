package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.ActionLog;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class LogDto {
    private Long id;
    private LogCategory category;
    private LogAction action;
    private LogLevel level;
    private String message;
    private LocalDateTime createdAt;
    /** İşlemi yapan kişi; null ise sistem */
    private Long actorId;
    private String actorName;
    private String targetType;
    private Long targetId;
    private String targetName;
    /** Değişiklik ayrıntıları (satır satır); yalnızca yöneticiye ve herkese açık kategorilerde döner */
    private String details;
    /** Yalnızca yöneticiye döner */
    private String ipAddress;

    public static LogDto from(ActionLog l) {
        return LogDto.builder()
            .id(l.getId())
            .category(l.getCategory())
            .action(l.getAction())
            .level(l.getLevel())
            .message(l.getMessage())
            .createdAt(l.getCreatedAt())
            .actorId(l.getActor() != null ? l.getActor().getId() : null)
            .actorName(l.getActor() != null ? l.getActor().getFullName() : null)
            .targetType(l.getTargetType())
            .targetId(l.getTargetId())
            .targetName(l.getTargetName())
            .details(l.getDetails())
            .ipAddress(l.getIpAddress())
            .build();
    }

    /** Çalışanlara giden akış: IP adresi gizlenir. */
    public LogDto withoutIp() {
        ipAddress = null;
        return this;
    }
}
