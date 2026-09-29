package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.TaskDto;
import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskPriority;
import com.enerjistaj.devhub.entity.TaskStatus;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.TaskRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private static final String NOT_OWNER = "Yalnızca kendi görevlerinizi yönetebilirsiniz.";

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ActionLogService actionLogService;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks() {
        return ResponseEntity.ok(taskRepository.findAllByOrderByCreatedAtDesc().stream().map(TaskDto::from).toList());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TaskDto>> getUserTasks(@PathVariable Long userId) {
        return ResponseEntity.ok(taskRepository.findByUserIdOrderByCreatedAtDesc(userId)
            .stream().map(TaskDto::from).toList());
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<TaskDto> createTask(@PathVariable Long userId, @RequestBody Map<String, Object> payload) {
        currentUser.requireSelfOrAdmin(userId, "Başkasına görev yalnızca yöneticiler atayabilir.");
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Kullanıcı"));

        Task t = new Task();
        t.setUser(user);
        t.setContent(Payloads.requiredText(payload, "content", "Görev içeriği boş olamaz.", 1000, "Görev"));
        TaskPriority priority = Payloads.enumValue(payload, "priority", TaskPriority.class, "öncelik");
        if (priority != null) t.setPriority(priority);
        t.setDueDate(Payloads.date(payload, "dueDate", "Son tarih"));
        Task saved = taskRepository.save(t);

        actionLogService.log(user.getFullName() + " için yeni görev eklendi.");
        return ResponseEntity.ok(TaskDto.from(saved));
    }

    /** Kısmi güncelleme: yalnızca gövdede gelen alanlar değişir. */
    @PutMapping("/{taskId}")
    public ResponseEntity<TaskDto> updateTask(@PathVariable Long taskId, @RequestBody Map<String, Object> payload) {
        Task t = findOwnTask(taskId);
        if (payload.containsKey("content")) {
            t.setContent(Payloads.requiredText(payload, "content", "Görev içeriği boş olamaz.", 1000, "Görev"));
        }
        if (payload.containsKey("status")) {
            TaskStatus status = Payloads.enumValue(payload, "status", TaskStatus.class, "görev durumu");
            if (status == null) throw ApiException.badRequest("Görev durumu boş olamaz.");
            t.setStatus(status);
        }
        if (payload.containsKey("priority")) {
            TaskPriority priority = Payloads.enumValue(payload, "priority", TaskPriority.class, "öncelik");
            if (priority == null) throw ApiException.badRequest("Öncelik boş olamaz.");
            t.setPriority(priority);
        }
        if (payload.containsKey("dueDate")) t.setDueDate(Payloads.date(payload, "dueDate", "Son tarih"));
        return ResponseEntity.ok(TaskDto.from(taskRepository.save(t)));
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId) {
        taskRepository.delete(findOwnTask(taskId));
        return ResponseEntity.noContent().build();
    }

    private Task findOwnTask(Long taskId) {
        Task t = taskRepository.findById(taskId).orElseThrow(() -> ApiException.notFound("Görev"));
        currentUser.requireSelfOrAdmin(t.getUser().getId(), NOT_OWNER);
        return t;
    }
}
