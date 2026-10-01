package com.enerjistaj.devhub.dto;

import lombok.Builder;
import lombok.Data;
import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.entity.UserLinkType;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.LeavePolicy;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class UserDto {
    private Long id;
    private String fullName;
    private String email;
    private Role role;
    private String jobTitle;
    private String currentProject;
    private String status;
    private String workMode;
    private String avatarColor;
    private boolean active;
    private LocalDate hireDate;
    /** Bugünkü kıdeme göre yıllık izin hakkı (iş günü); işe giriş tarihinden hesaplanır */
    private int annualLeaveDays;
    /** Hakkın bir sonraki artışı (ör. 1. yıl dolunca 14 gün); artış kalmadıysa null */
    private LocalDate annualLeaveNextDate;
    private Integer annualLeaveNextDays;
    private boolean mustChangePassword;
    /** Profildeki iletişim bilgileri ve bağlantılar */
    private List<LinkDto> links;

    public record LinkDto(UserLinkType type, String label, String value) {}

    public static UserDto from(User u) {
        return UserDto.builder()
            .id(u.getId())
            .email(u.getEmail())
            .fullName(u.getFullName())
            .role(u.getRole())
            .jobTitle(u.getJobTitle())
            .currentProject(u.getCurrentProject())
            .status(u.getStatus())
            .workMode(u.getWorkMode())
            .avatarColor(u.getAvatarColor())
            .active(u.isActive())
            .hireDate(u.getHireDate())
            .annualLeaveDays(LeavePolicy.entitlement(u.getHireDate(), today()))
            .annualLeaveNextDate(next(u) != null ? next(u).date() : null)
            .annualLeaveNextDays(next(u) != null ? next(u).days() : null)
            .mustChangePassword(u.isMustChangePassword())
            .links(u.getLinks().stream().map(l -> new LinkDto(l.getType(), l.getLabel(), l.getValue())).toList())
            .build();
    }

    private static LeavePolicy.Next next(User u) {
        return LeavePolicy.next(u.getHireDate(), today());
    }

    private static LocalDate today() {
        return LocalDate.now(ActionLogService.ZONE);
    }
}
