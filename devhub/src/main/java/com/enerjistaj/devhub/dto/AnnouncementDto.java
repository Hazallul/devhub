package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.Announcement;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class AnnouncementDto {
    private Long id;
    private String title;
    private String content;
    private Long authorId;
    private LocalDateTime createdAt;
    private boolean pinned;

    public static AnnouncementDto from(Announcement a) {
        return AnnouncementDto.builder()
            .id(a.getId())
            .title(a.getTitle())
            .content(a.getContent())
            .authorId(a.getAuthor().getId())
            .createdAt(a.getCreatedAt())
            .pinned(a.isPinned())
            .build();
    }
}
