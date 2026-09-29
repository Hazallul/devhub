package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.UserDto;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ActionLogService actionLogService;
    private final UserStatusService userStatusService;
    private final CurrentUser currentUser;
    private final LeaveRequestRepository leaveRepository;

    @GetMapping
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream().map(UserDto::from).toList());
    }

    @PutMapping("/{id}/project")
    public ResponseEntity<UserDto> updateUserProject(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        currentUser.requireAdmin("Proje ataması yalnızca yöneticiler tarafından yapılabilir.");
        User user = findUser(id);
        String oldProject = user.getCurrentProject();
        String newProject = Payloads.text(payload, "currentProject"); // null → projeden çıkar

        if (newProject != null && !projectRepository.existsByName(newProject)) throw ApiException.notFound("Proje");
        if (Objects.equals(oldProject, newProject)) return ResponseEntity.ok(UserDto.from(user));

        user.setCurrentProject(newProject);
        User saved = userRepository.save(user);

        if (newProject == null) {
            actionLogService.log(user.getFullName() + ", " + (oldProject != null ? oldProject : "Mevcut") + " projesinden çıkarıldı ve boşa alındı.");
        } else {
            actionLogService.log(user.getFullName() + ", " + newProject + " projesine atandı.");
        }
        return ResponseEntity.ok(UserDto.from(saved));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<UserDto> updateUserStatus(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireSelfOrAdmin(id, "Yalnızca kendi durumunuzu değiştirebilirsiniz.");
        String newStatus = Payloads.text(payload, "status");
        if (newStatus == null || !UserStatusService.ALL.contains(newStatus)) throw ApiException.badRequest("Geçersiz durum.");
        User user = findUser(id);
        if (!CurrentUser.isAdmin(me) && !UserStatusService.selfServiceOptions(user).contains(newStatus)) {
            if (UserStatusService.IZINLI.equals(user.getStatus())) {
                throw ApiException.forbidden("İzinliyken durumunuzu yalnızca yönetici değiştirebilir.");
            }
            if (UserStatusService.IZINLI.equals(newStatus)) {
                throw ApiException.forbidden("İzinli durumuna geçmek için İzinler sayfasından talep oluşturun.");
            }
            throw ApiException.forbidden("Aktif/Uzaktan çalışma şeklinizi yalnızca yönetici değiştirebilir; siz Toplantıda ile "
                    + ("UZAKTAN".equals(user.getWorkMode()) ? "Uzaktan" : "Aktif") + " arasında geçiş yapabilirsiniz.");
        }
        // İzinli durumu takvimde görünen gerçek bir izin kaydına dayanmalı; kayıt POST /api/leaves ile (yönetici için userId ile, doğrudan onaylı) açılır.
        if (UserStatusService.IZINLI.equals(newStatus) && !leaveRepository.existsApprovedOn(user.getId(), LocalDate.now(ActionLogService.ZONE))) {
            throw ApiException.badRequest("Kişiyi İzinli yapmak için izin türü ve tarihleriyle bir izin kaydı oluşturun.");
        }
        return ResponseEntity.ok(UserDto.from(userStatusService.change(user, newStatus)));
    }

    @PutMapping("/{id}/profile")
    public ResponseEntity<UserDto> updateProfile(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        currentUser.requireSelfOrAdmin(id, "Yalnızca kendi profilinizi düzenleyebilirsiniz.");
        User user = findUser(id);

        String fullName = Payloads.requiredText(payload, "fullName", "Ad soyad zorunludur.", 255, "Ad soyad");
        if (fullName.length() < 3) throw ApiException.badRequest("Ad soyad en az 3 karakter olmalı.");
        String avatarColor = Payloads.text(payload, "avatarColor");
        if (avatarColor != null && !avatarColor.matches("^#[0-9A-Fa-f]{6}$")) throw ApiException.badRequest("Avatar rengi #RRGGBB biçiminde olmalı.");

        user.setFullName(fullName);
        user.setJobTitle(Payloads.optionalText(payload, "jobTitle", 100, "Unvan"));
        if (avatarColor != null) user.setAvatarColor(avatarColor);
        return ResponseEntity.ok(UserDto.from(userRepository.save(user)));
    }

    private User findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
    }
}
