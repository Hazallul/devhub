package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.dto.TaskActivityDto;
import com.enerjistaj.devhub.dto.TaskDto;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.Project;
import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskActivity;
import com.enerjistaj.devhub.entity.TaskActivityKind;
import com.enerjistaj.devhub.entity.TaskPriority;
import com.enerjistaj.devhub.entity.TaskStatus;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.TaskActivityRepository;
import com.enerjistaj.devhub.repository.TaskRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private static final String NOT_OWNER = "Yalnızca kendi görevlerinizi yönetebilirsiniz.";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final Map<TaskStatus, String> STATUS_LABEL = Map.of(
        TaskStatus.YAPILACAK, "Yapılacak", TaskStatus.DEVAM, "Devam Ediyor", TaskStatus.TAMAMLANDI, "Tamamlandı");
    private static final Map<TaskPriority, String> PRIORITY_LABEL = Map.of(
        TaskPriority.YUKSEK, "Yüksek", TaskPriority.ORTA, "Orta", TaskPriority.DUSUK, "Düşük");

    private final TaskRepository taskRepository;
    private final TaskActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final ActionLogService actionLogService;
    private final CurrentUser currentUser;
    private final ProjectRepository projectRepository;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks() {
        Map<Long, Long> comments = commentCounts();
        return ResponseEntity.ok(taskRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(t -> TaskDto.from(t, comments.getOrDefault(t.getId(), 0L))).toList());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TaskDto>> getUserTasks(@PathVariable Long userId) {
        Map<Long, Long> comments = commentCounts();
        return ResponseEntity.ok(taskRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(t -> TaskDto.from(t, comments.getOrDefault(t.getId(), 0L))).toList());
    }

    /** Eski uç: tek kişiye görev. */
    @PostMapping("/user/{userId}")
    @Transactional
    public ResponseEntity<TaskDto> createTask(@PathVariable Long userId, @RequestBody Map<String, Object> payload) {
        Map<String, Object> body = new HashMap<>(payload);
        body.put("userIds", List.of(userId));
        return ResponseEntity.ok(create(body).get(0));
    }

    /**
     * Bir veya birden fazla kişiye aynı görevi atar (her kişiye ayrı görev oluşur).
     * Gövde: userIds[], content, description?, priority?, dueDate?, projectId? (yalnızca yönetici; gönderilmezse kişinin projesi).
     */
    @PostMapping
    @Transactional
    public ResponseEntity<List<TaskDto>> createTasks(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(create(payload));
    }

    private List<TaskDto> create(Map<String, Object> payload) {
        User me = currentUser.get();
        boolean admin = CurrentUser.isAdmin(me);
        List<Long> userIds = idList(payload.get("userIds"));
        if (userIds.isEmpty()) throw ApiException.badRequest("En az bir kişi seçin.");
        if (userIds.size() > 50) throw ApiException.badRequest("Tek seferde en fazla 50 kişiye görev atanabilir.");
        if (!admin && (userIds.size() > 1 || !userIds.get(0).equals(me.getId()))) {
            throw ApiException.forbidden("Başkasına görev yalnızca yöneticiler atayabilir.");
        }

        String content = Payloads.requiredText(payload, "content", "Görev içeriği boş olamaz.", 1000, "Görev");
        String description = Payloads.optionalText(payload, "description", 4000, "Açıklama");
        TaskPriority priority = Payloads.enumValue(payload, "priority", TaskPriority.class, "öncelik");
        LocalDate dueDate = Payloads.date(payload, "dueDate", "Son tarih");
        boolean explicitProject = admin && payload.containsKey("projectId");
        Project chosenProject = explicitProject ? projectOrNull(payload.get("projectId")) : null;

        List<TaskDto> created = new ArrayList<>();
        List<String> names = new ArrayList<>();
        for (Long id : userIds) {
            User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
            if (!user.isActive()) throw ApiException.badRequest(user.getFullName() + " pasif bir hesap; görev atanamaz.");

            Task t = new Task();
            t.setUser(user);
            t.setContent(content);
            t.setDescription(description);
            if (priority != null) t.setPriority(priority);
            t.setDueDate(dueDate);
            t.setCreatedBy(me);
            // Görev seçilen projeye, seçilmediyse kişinin o anki projesine bağlanır; kişi sonra proje değiştirse de görev projesinde kalır.
            if (explicitProject) t.setProject(chosenProject);
            else if (user.getCurrentProject() != null) projectRepository.findByName(user.getCurrentProject()).ifPresent(t::setProject);
            Task saved = taskRepository.save(t);

            event(saved, me, user.getId().equals(me.getId()) ? "görevi oluşturdu" : "görevi oluşturdu ve " + user.getFullName() + " kişisine atadı");
            notificationService.notify(user, me, NotificationType.TASK_ASSIGNED, "Size yeni görev atandı", content, link(saved));
            created.add(TaskDto.from(saved));
            names.add(user.getFullName());
        }
        actionLogService.log(me, String.join(", ", names) + " için yeni görev eklendi.");
        return created;
    }

    /** Kısmi güncelleme: yalnızca gövdede gelen alanlar değişir. Her değişiklik görev geçmişine yazılır. */
    @PutMapping("/{taskId}")
    @Transactional
    public ResponseEntity<TaskDto> updateTask(@PathVariable Long taskId, @RequestBody Map<String, Object> payload) {
        Task t = findOwnTask(taskId);
        User me = currentUser.get();
        boolean admin = CurrentUser.isAdmin(me);

        if (payload.containsKey("content")) {
            String content = Payloads.requiredText(payload, "content", "Görev içeriği boş olamaz.", 1000, "Görev");
            if (!content.equals(t.getContent())) {
                t.setContent(content);
                event(t, me, "başlığı düzenledi");
            }
        }
        if (payload.containsKey("description")) {
            String description = Payloads.optionalText(payload, "description", 4000, "Açıklama");
            if (!Objects.equals(description, t.getDescription())) {
                event(t, me, description == null ? "açıklamayı kaldırdı" : t.getDescription() == null ? "açıklama ekledi" : "açıklamayı güncelledi");
                t.setDescription(description);
            }
        }
        if (payload.containsKey("status")) {
            TaskStatus status = Payloads.enumValue(payload, "status", TaskStatus.class, "görev durumu");
            if (status == null) throw ApiException.badRequest("Görev durumu boş olamaz.");
            if (status != t.getStatus()) {
                event(t, me, "durumu değiştirdi: " + STATUS_LABEL.get(t.getStatus()) + " → " + STATUS_LABEL.get(status));
                t.changeStatus(status);
                if (status == TaskStatus.TAMAMLANDI && t.getCreatedBy() != null && !t.getCreatedBy().getId().equals(t.getUser().getId())) {
                    notificationService.notify(t.getCreatedBy(), me, NotificationType.TASK_COMPLETED,
                        t.getUser().getFullName() + " görevi tamamladı", t.getContent(), link(t));
                }
            }
        }
        if (payload.containsKey("priority")) {
            TaskPriority priority = Payloads.enumValue(payload, "priority", TaskPriority.class, "öncelik");
            if (priority == null) throw ApiException.badRequest("Öncelik boş olamaz.");
            if (priority != t.getPriority()) {
                event(t, me, "önceliği değiştirdi: " + PRIORITY_LABEL.get(t.getPriority()) + " → " + PRIORITY_LABEL.get(priority));
                t.setPriority(priority);
            }
        }
        if (payload.containsKey("dueDate")) {
            LocalDate due = Payloads.date(payload, "dueDate", "Son tarih");
            if (!Objects.equals(due, t.getDueDate())) {
                event(t, me, due == null ? "son tarihi kaldırdı" : "son tarihi " + due.format(DAY) + " olarak belirledi");
                t.setDueDate(due);
            }
        }
        if (payload.containsKey("projectId")) {
            if (!admin) throw ApiException.forbidden("Görevin projesini yalnızca yöneticiler değiştirebilir.");
            Project project = projectOrNull(payload.get("projectId"));
            Long oldId = t.getProject() != null ? t.getProject().getId() : null;
            Long newId = project != null ? project.getId() : null;
            if (!Objects.equals(oldId, newId)) {
                event(t, me, "projeyi değiştirdi: " + (t.getProject() != null ? t.getProject().getName() : "Projesiz") + " → "
                    + (project != null ? project.getName() : "Projesiz"));
                t.setProject(project);
            }
        }
        if (payload.containsKey("userId")) {
            if (!admin) throw ApiException.forbidden("Görevi başka birine yalnızca yöneticiler aktarabilir.");
            Long userId = idOrNull(payload.get("userId"));
            if (userId == null) throw ApiException.badRequest("Atanan kişi boş olamaz.");
            if (!userId.equals(t.getUser().getId())) {
                User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
                if (!user.isActive()) throw ApiException.badRequest(user.getFullName() + " pasif bir hesap; görev aktarılamaz.");
                event(t, me, "görevi aktardı: " + t.getUser().getFullName() + " → " + user.getFullName());
                t.setUser(user);
                notificationService.notify(user, me, NotificationType.TASK_ASSIGNED, "Size bir görev aktarıldı", t.getContent(), link(t));
            }
        }
        Task saved = taskRepository.save(t);
        return ResponseEntity.ok(TaskDto.from(saved, activityRepository.countByTaskIdAndKind(saved.getId(), TaskActivityKind.COMMENT)));
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId) {
        taskRepository.delete(findOwnTask(taskId));
        return ResponseEntity.noContent().build();
    }

    /** Görevin geçmişi ve yorumları (eskiden yeniye). Görevleri herkes görebildiği için geçmişi de herkes görebilir. */
    @GetMapping("/{taskId}/activity")
    public ResponseEntity<List<TaskActivityDto>> activity(@PathVariable Long taskId) {
        if (!taskRepository.existsById(taskId)) throw ApiException.notFound("Görev");
        return ResponseEntity.ok(activityRepository.findByTaskIdOrderByCreatedAtAscIdAsc(taskId).stream().map(TaskActivityDto::from).toList());
    }

    /** Ekipteki herkes yorum yazabilir; görevin sahibi ve atayan kişi bildirim alır. */
    @PostMapping("/{taskId}/comments")
    @Transactional
    public ResponseEntity<TaskActivityDto> addComment(@PathVariable Long taskId, @RequestBody Map<String, Object> payload) {
        User me = currentUser.get();
        Task t = taskRepository.findById(taskId).orElseThrow(() -> ApiException.notFound("Görev"));
        String text = Payloads.requiredText(payload, "text", "Yorum boş olamaz.", 1000, "Yorum");

        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(me);
        a.setKind(TaskActivityKind.COMMENT);
        a.setMessage(text);
        TaskActivity saved = activityRepository.save(a);

        Map<Long, User> recipients = new LinkedHashMap<>();
        recipients.put(t.getUser().getId(), t.getUser());
        if (t.getCreatedBy() != null) recipients.putIfAbsent(t.getCreatedBy().getId(), t.getCreatedBy());
        recipients.values().forEach(r -> notificationService.notify(r, me, NotificationType.TASK_COMMENT,
            me.getFullName() + " bir göreve yorum yazdı", t.getContent() + " — " + text, link(t)));
        return ResponseEntity.ok(TaskActivityDto.from(saved));
    }

    /** Yorumu yalnızca yazan kişi veya bir yönetici silebilir; geçmiş kayıtları silinemez. */
    @DeleteMapping("/{taskId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long taskId, @PathVariable Long commentId) {
        TaskActivity a = activityRepository.findById(commentId)
            .filter(x -> x.getTask().getId().equals(taskId) && x.getKind() == TaskActivityKind.COMMENT)
            .orElseThrow(() -> ApiException.notFound("Yorum"));
        currentUser.requireSelfOrAdmin(a.getActor() != null ? a.getActor().getId() : null, "Yalnızca kendi yorumlarınızı silebilirsiniz.");
        activityRepository.delete(a);
        return ResponseEntity.noContent().build();
    }

    private void event(Task t, User actor, String message) {
        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(actor);
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage(message);
        activityRepository.save(a);
    }

    private Map<Long, Long> commentCounts() {
        return activityRepository.countByKindGroupedByTask(TaskActivityKind.COMMENT).stream()
            .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
    }

    private static String link(Task t) {
        return "/tasks?task=" + t.getId();
    }

    private Project projectOrNull(Object raw) {
        Long id = idOrNull(raw);
        return id == null ? null : projectRepository.findById(id).orElseThrow(() -> ApiException.notFound("Proje"));
    }

    private static Long idOrNull(Object raw) {
        if (raw == null || raw.toString().isBlank()) return null;
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Geçersiz kimlik: " + raw);
        }
    }

    private static List<Long> idList(Object raw) {
        if (!(raw instanceof Collection<?> c)) return List.of();
        return c.stream().map(TaskController::idOrNull).filter(Objects::nonNull).distinct().toList();
    }

    private Task findOwnTask(Long taskId) {
        Task t = taskRepository.findById(taskId).orElseThrow(() -> ApiException.notFound("Görev"));
        currentUser.requireSelfOrAdmin(t.getUser().getId(), NOT_OWNER);
        return t;
    }
}
