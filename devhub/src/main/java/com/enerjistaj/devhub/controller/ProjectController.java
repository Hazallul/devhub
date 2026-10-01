package com.enerjistaj.devhub.controller;

import java.time.LocalDate;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.Project;
import com.enerjistaj.devhub.entity.ProjectStatus;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private static final java.util.Map<ProjectStatus, String> STATUS = java.util.Map.of(
            ProjectStatus.PLANLAMA, "Planlama", ProjectStatus.AKTIF, "Aktif", ProjectStatus.BEKLEMEDE, "Beklemede", ProjectStatus.TAMAMLANDI, "Tamamlandı");
    private static final java.time.format.DateTimeFormatter DAY = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ActionLogService actionLogService;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects() {
        return ResponseEntity.ok(projectRepository.findAll(Sort.by("name")));
    }

    @PostMapping
    public ResponseEntity<Project> createProject(@RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin("Proje yalnızca yöneticiler tarafından oluşturulabilir.");
        String name = Payloads.requiredText(payload, "name", "Proje adı zorunludur.", 255, "Proje adı");
        if (projectRepository.existsByNameIgnoreCase(name)) throw ApiException.conflict("Bu isimde bir proje zaten var.");

        Project p = new Project();
        p.setName(name);
        p.setDescription(Payloads.optionalText(payload, "description", 500, "Açıklama"));
        p.setDeadline(Payloads.date(payload, "deadline", "Teslim tarihi"));
        ProjectStatus status = Payloads.enumValue(payload, "status", ProjectStatus.class, "proje aşaması");
        p.setStatus(status != null ? status : ProjectStatus.PLANLAMA);
        Project saved = projectRepository.save(p);

        actionLogService.record(LogCategory.PROJE, LogAction.OLUSTURMA, "Yeni proje oluşturuldu: " + name).by(me)
                .target("PROJE", saved.getId(), name)
                .detail("Aşama: " + STATUS.get(saved.getStatus()))
                .detail(saved.getDeadline() != null ? "Teslim tarihi: " + saved.getDeadline().format(DAY) : null)
                .detail(saved.getDescription() != null ? "Açıklama: " + saved.getDescription() : null).save();
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Project> updateProject(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin("Projeyi yalnızca yöneticiler düzenleyebilir.");
        Project p = projectRepository.findById(id).orElseThrow(() -> ApiException.notFound("Proje"));
        String oName = p.getName(), oDesc = p.getDescription();
        LocalDate oDeadline = p.getDeadline();
        ProjectStatus oStatus = p.getStatus();

        String name = Payloads.text(payload, "name");
        if (name != null && !name.equals(p.getName())) {
            if (name.length() > 255) throw ApiException.badRequest("Proje adı en fazla 255 karakter olabilir.");
            if (projectRepository.existsByNameIgnoreCase(name) && !name.equalsIgnoreCase(p.getName())) {
                throw ApiException.conflict("Bu isimde bir proje zaten var.");
            }
            userRepository.renameProject(p.getName(), name);
            p.setName(name);
        }
        if (payload.containsKey("description")) p.setDescription(Payloads.optionalText(payload, "description", 500, "Açıklama"));
        if (payload.containsKey("deadline")) p.setDeadline(Payloads.date(payload, "deadline", "Teslim tarihi"));
        if (payload.containsKey("status")) {
            ProjectStatus status = Payloads.enumValue(payload, "status", ProjectStatus.class, "proje aşaması");
            if (status == null) throw ApiException.badRequest("Proje aşaması boş olamaz.");
            p.setStatus(status);
        }
        Project saved = projectRepository.save(p);
        List<String> changes = java.util.stream.Stream.of(
                ActionLogService.diff("Ad", oName, saved.getName()),
                ActionLogService.diff("Aşama", STATUS.get(oStatus), STATUS.get(saved.getStatus())),
                ActionLogService.diff("Teslim tarihi", oDeadline != null ? oDeadline.format(DAY) : null, saved.getDeadline() != null ? saved.getDeadline().format(DAY) : null),
                java.util.Objects.equals(oDesc, saved.getDescription()) ? null : "Açıklama güncellendi").filter(java.util.Objects::nonNull).toList();
        if (!changes.isEmpty()) {
            actionLogService.record(LogCategory.PROJE, LogAction.GUNCELLEME, "Proje güncellendi: " + saved.getName()).by(me)
                    .target("PROJE", saved.getId(), saved.getName()).details(changes)
                    .detail(!oName.equals(saved.getName()) ? "Proje üyelerinin proje adı da güncellendi" : null).save();
        }
        return ResponseEntity.ok(saved);
    }
}
