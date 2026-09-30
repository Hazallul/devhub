package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class LeaveDto {
    private Long id;
    private Long userId;
    private LeaveType type;
    private LocalDate startDate;
    private LocalDate endDate;
    private String note;
    private LeaveState state;
    private LocalDateTime createdAt;
    private boolean finalized;
    /** Yöneticinin karara eklediği açıklama */
    private String decisionNote;
    private String decidedByName;

    /** Başkasının izni: takvim için yalnızca tarihler yeter; izin türü (ör. hastalık), talep notu ve karar açıklaması kişiye özeldir. */
    public LeaveDto forColleague() {
        type = null;
        note = null;
        decisionNote = null;
        decidedByName = null;
        return this;
    }

    public static LeaveDto from(LeaveRequest l) {
        return LeaveDto.builder()
            .id(l.getId())
            .userId(l.getUser().getId())
            .type(l.getType())
            .startDate(l.getStartDate())
            .endDate(l.getEndDate())
            .note(l.getNote())
            .state(l.getState())
            .createdAt(l.getCreatedAt())
            .finalized(l.isFinalized())
            .decisionNote(l.getDecisionNote())
            .decidedByName(l.getDecidedBy() != null ? l.getDecidedBy().getFullName() : null)
            .build();
    }
}
