package com.enerjistaj.devhub.dto;

import lombok.Builder;
import lombok.Data;
import com.enerjistaj.devhub.entity.Role;
import com.enerjistaj.devhub.entity.User;

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
            .build();
    }
}
