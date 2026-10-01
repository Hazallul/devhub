package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
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
import com.enerjistaj.devhub.service.TaskStatusService;
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
    private static final Map<TaskPriority, String> PRIORITY_LABEL = Map.of(
        TaskPriority.YUKSEK, "Yüksek", TaskPriority.ORTA, "Orta", TaskPriority.DUSUK, "Düşük");

    private final TaskRepository taskRepository;
    private final TaskActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final ActionLogService actionLogService;
    private final CurrentUser currentUser;
    private final ProjectRepository projectRepository;
    private final NotificationService notificationService;
    private final TaskStatusService taskStatusService;
    private final com.enerjistaj.devhub.service.TaskTimeService taskTime;
    private final com.enerjistaj.devhub.service.WorkTimeService workTime;

    @GetMapping
    public ResponseEntity<List<TaskDto>> getAllTasks() {
        return ResponseEntity.ok(dtos(taskRepository.findAllByOrderByCreatedAtDesc()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<TaskDto>> getUserTasks(@PathVariable Long userId) {
        return ResponseEntity.ok(dtos(taskRepository.findByUserIdOrderByCreatedAtDesc(userId)));
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
        Integer estimate = estimateMinutes(payload);
        if (estimate == null) throw ApiException.badRequest("Görevin tahmini süresini (iş gücü) girin.");
        boolean explicitProject = admin && payload.containsKey("projectId");
        Project chosenProject = explicitProject ? projectOrNull(payload.get("projectId")) : null;

        List<TaskDto> created = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<Long> ids = new ArrayList<>();
        for (Long id : userIds) {
            User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
            if (!user.isActive()) throw ApiException.badRequest(user.getFullName() + " pasif bir hesap; görev atanamaz.");

            Task t = new Task();
            t.setUser(user);
            t.setContent(content);
            t.setDescription(description);
            if (priority != null) t.setPriority(priority);
            t.setDueDate(dueDate);
            t.setEstimatedMinutes(estimate);
            t.setCreatedBy(me);
            // Görev seçilen projeye, seçilmediyse kişinin o anki projesine bağlanır; kişi sonra proje değiştirse de görev projesinde kalır.
            if (explicitProject) t.setProject(chosenProject);
            else if (user.getCurrentProject() != null) projectRepository.findByName(user.getCurrentProject()).ifPresent(t::setProject);
            Task saved = taskRepository.save(t);
            ids.add(saved.getId());

            event(saved, me, user.getId().equals(me.getId()) ? "görevi oluşturdu" : "görevi oluşturdu ve " + user.getFullName() + " kişisine atadı");
            notificationService.notify(user, me, NotificationType.TASK_ASSIGNED, "Size yeni görev atandı", content, link(saved));
            created.add(TaskDto.from(saved));
            names.add(user.getFullName());
        }
        actionLogService.record(LogCategory.GOREV, LogAction.OLUSTURMA,
                (names.size() == 1 ? names.get(0) + " için yeni görev: " : names.size() + " kişiye görev atandı: ") + content).by(me)
                .target("GOREV", ids.get(0), content)
                .detail("Atanan: " + String.join(", ", names))
                .detail("Öncelik: " + PRIORITY_LABEL.get(priority != null ? priority : TaskPriority.ORTA))
                .detail(dueDate != null ? "Son tarih: " + dueDate.format(DAY) : null)
                .detail("Tahmini süre: " + hours(estimate))
                .detail(explicitProject ? "Proje: " + (chosenProject != null ? chosenProject.getName() : "Projesiz") : null)
                .detail(description != null ? "Açıklama eklendi" : null)
                .detail(ids.size() > 1 ? "Görev kayıtları: #" + ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", #")) : null).save();
        return created;
    }

    /** Kısmi güncelleme: yalnızca gövdede gelen alanlar değişir. Her değişiklik görev geçmişine yazılır. */
    @PutMapping("/{taskId}")
    @Transactional
    public ResponseEntity<TaskDto> updateTask(@PathVariable Long taskId, @RequestBody Map<String, Object> payload) {
        Task t = findOwnTask(taskId);
        User me = currentUser.get();
        boolean admin = CurrentUser.isAdmin(me);
        // Değişiklikler sonunda tek bir log kaydında özetlenir.
        String oContent = t.getContent(), oDescription = t.getDescription();
        TaskStatus oStatus = t.getStatus();
        TaskPriority oPriority = t.getPriority();
        LocalDate oDue = t.getDueDate();
        String oProject = t.getProject() != null ? t.getProject().getName() : null;
        String oUser = t.getUser().getFullName();
        Integer oEstimate = t.getEstimatedMinutes();

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
            taskStatusService.change(t, status, me);
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
        if (payload.containsKey("estimatedMinutes")) {
            // Tahmini süreyi yönetici ya da görevi kendine açan kişi değiştirir; atanan görevin tahminini çalışan değiştiremez.
            boolean selfCreated = t.getCreatedBy() != null && t.getCreatedBy().getId().equals(me.getId());
            if (!admin && !selfCreated) throw ApiException.forbidden("Atanan görevin tahmini süresini yalnızca yöneticiler değiştirebilir.");
            Integer estimate = estimateMinutes(payload);
            if (estimate == null) throw ApiException.badRequest("Tahmini süre boş olamaz.");
            if (!estimate.equals(t.getEstimatedMinutes())) {
                event(t, me, "tahmini süreyi " + (t.getEstimatedMinutes() != null ? hours(t.getEstimatedMinutes()) + " → " : "") + hours(estimate) + " olarak belirledi");
                t.setEstimatedMinutes(estimate);
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
                taskTime.onReassign(t, user);
                t.setUser(user);
                notificationService.notify(user, me, NotificationType.TASK_ASSIGNED, "Size bir görev aktarıldı", t.getContent(), link(t));
            }
        }
        Task saved = taskRepository.save(t);
        logTaskChanges(saved, me, oContent, oDescription, oStatus, oPriority, oDue, oProject, oUser, oEstimate);
        return ResponseEntity.ok(dto(saved, activityRepository.countByTaskIdAndKind(saved.getId(), TaskActivityKind.COMMENT)));
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId) {
        Task t = findOwnTask(taskId);
        actionLogService.record(LogCategory.GOREV, LogAction.SILME, "Görev silindi: " + t.getContent()).by(currentUser.get())
                .target("GOREV", t.getId(), t.getContent())
                .detail("Atanan: " + t.getUser().getFullName())
                .detail("Durum: " + TaskStatusService.STATUS_LABEL.get(t.getStatus()))
                .detail(t.getProject() != null ? "Proje: " + t.getProject().getName() : null)
                .detail(t.getCreatedBy() != null ? "Oluşturan: " + t.getCreatedBy().getFullName() : null)
                .level(LogLevel.UYARI).save();
        taskRepository.delete(t);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------- iş gücü

    /** Görevin çalışma oturumları (Devam Ediyor'da geçen aralıklar ve mesaiye düşen süreleri). */
    @GetMapping("/{taskId}/sessions")
    public ResponseEntity<List<com.enerjistaj.devhub.service.TaskTimeService.SessionDto>> sessions(@PathVariable Long taskId) {
        if (!taskRepository.existsById(taskId)) throw ApiException.notFound("Görev");
        return ResponseEntity.ok(taskTime.sessionsOf(taskId));
    }

    /**
     * Harcanan süreyi düzeltir (ör. görevi Devam'a almayı unuttu). Gövde: spentMinutes = olması gereken toplam.
     * Oturumlar değişmez; aradaki fark düzeltme olarak saklanır ve geçmişe/loga yazılır. Sahibi ya da yönetici yapabilir.
     */
    @PutMapping("/{taskId}/time")
    @Transactional
    public ResponseEntity<TaskDto> correctTime(@PathVariable Long taskId, @RequestBody Map<String, Object> payload) {
        Task t = findOwnTask(taskId);
        User me = currentUser.get();
        int target;
        try {
            target = (int) Math.round(Double.parseDouble(String.valueOf(payload.get("spentMinutes"))));
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Harcanan süre sayı olmalı.");
        }
        if (target < 0 || target > 100_000) throw ApiException.badRequest("Harcanan süre 0 ile 100.000 dakika arasında olmalı.");
        long before = taskTime.summary(t).spentSeconds();
        long raw = taskTime.rawSeconds(t);
        t.setSpentAdjustMinutes((int) Math.round((target * 60.0 - raw) / 60.0));
        Task saved = taskRepository.save(t);
        String from = hours((int) (before / 60)), to = hours(target);
        if (!from.equals(to)) {
            event(saved, me, "harcanan süreyi düzeltti: " + from + " → " + to);
            actionLogService.record(LogCategory.GOREV, LogAction.GUNCELLEME, "Görevin harcanan süresi düzeltildi: " + t.getContent()).by(me)
                .target("GOREV", t.getId(), t.getContent())
                .change("Harcanan süre", from, to)
                .detail("Görevin sahibi: " + t.getUser().getFullName())
                .level(LogLevel.UYARI).save();
        }
        return ResponseEntity.ok(dto(saved, activityRepository.countByTaskIdAndKind(saved.getId(), TaskActivityKind.COMMENT)));
    }

    /** Kişi başına bu haftaki çalışma: çalışılan süre, kapasite (tatil ve izin günleri düşülmüş), bugün çalışılan. */
    @GetMapping("/workload")
    public ResponseEntity<List<Map<String, Object>>> workload() {
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(ActionLogService.ZONE);
        LocalDate monday = now.toLocalDate().with(java.time.DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);
        java.time.LocalDateTime weekStart = monday.atStartOfDay(ActionLogService.ZONE).withZoneSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();
        java.time.LocalDateTime dayStart = now.toLocalDate().atStartOfDay(ActionLogService.ZONE).withZoneSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();
        Map<Long, Long> week = taskTime.workedByUser(weekStart, weekStart.plusDays(7));
        Map<Long, Long> today = taskTime.workedByUser(dayStart, dayStart.plusDays(1));
        com.enerjistaj.devhub.service.WorkTimeService.Calendar cal = workTime.calendar(monday, sunday);
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u : userRepository.findByActiveTrue()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", u.getId());
            m.put("weekWorkedSeconds", week.getOrDefault(u.getId(), 0L));
            m.put("todayWorkedSeconds", today.getOrDefault(u.getId(), 0L));
            m.put("weekCapacitySeconds", cal.capacitySeconds(u.getId(), monday, sunday));
            m.put("weekStart", monday.toString());
            out.add(m);
        }
        return ResponseEntity.ok(out);
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
        actionLogService.record(LogCategory.GOREV, LogAction.YORUM, "Göreve yorum yazıldı: " + t.getContent()).by(me)
                .target("GOREV", t.getId(), t.getContent())
                .detail("Yorum: " + (text.length() > 300 ? text.substring(0, 297) + "..." : text)).save();

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

    /** Görev güncellemesinin özeti: ne değiştiyse "Alan: eski → yeni" satırları; değişiklik yoksa kayıt düşmez. */
    private void logTaskChanges(Task t, User me, String oContent, String oDescription, TaskStatus oStatus, TaskPriority oPriority,
                                LocalDate oDue, String oProject, String oUser, Integer oEstimate) {
        String project = t.getProject() != null ? t.getProject().getName() : null;
        List<String> changes = java.util.stream.Stream.of(
                ActionLogService.diff("Başlık", oContent, t.getContent()),
                Objects.equals(oDescription, t.getDescription()) ? null : "Açıklama güncellendi",
                ActionLogService.diff("Durum", TaskStatusService.STATUS_LABEL.get(oStatus), TaskStatusService.STATUS_LABEL.get(t.getStatus())),
                ActionLogService.diff("Öncelik", PRIORITY_LABEL.get(oPriority), PRIORITY_LABEL.get(t.getPriority())),
                ActionLogService.diff("Son tarih", oDue != null ? oDue.format(DAY) : null, t.getDueDate() != null ? t.getDueDate().format(DAY) : null),
                ActionLogService.diff("Proje", oProject != null ? oProject : "Projesiz", project != null ? project : "Projesiz"),
                ActionLogService.diff("Atanan", oUser, t.getUser().getFullName()),
                ActionLogService.diff("Tahmini süre", oEstimate != null ? hours(oEstimate) : null, t.getEstimatedMinutes() != null ? hours(t.getEstimatedMinutes()) : null)).filter(Objects::nonNull).toList();
        if (changes.isEmpty()) return;
        boolean completed = oStatus != TaskStatus.TAMAMLANDI && t.getStatus() == TaskStatus.TAMAMLANDI;
        boolean moved = !oUser.equals(t.getUser().getFullName());
        LogAction action = completed ? LogAction.TAMAMLAMA : moved ? LogAction.GOREV_AKTARMA : oStatus != t.getStatus() ? LogAction.DURUM_DEGISIKLIGI : LogAction.GUNCELLEME;
        String title = switch (action) {
            case TAMAMLAMA -> "Görev tamamlandı: ";
            case GOREV_AKTARMA -> "Görev başka birine aktarıldı: ";
            case DURUM_DEGISIKLIGI -> "Görev durumu değişti: ";
            default -> "Görev güncellendi: ";
        };
        actionLogService.record(LogCategory.GOREV, action, title + t.getContent()).by(me)
                .target("GOREV", t.getId(), t.getContent()).details(changes)
                .detail(moved || !t.getUser().getId().equals(me.getId()) ? "Görevin sahibi: " + t.getUser().getFullName() : null).save();
    }

    private void event(Task t, User actor, String message) {
        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(actor);
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage(message);
        activityRepository.save(a);
    }

    private List<TaskDto> dtos(List<Task> tasks) {
        Map<Long, Long> comments = commentCounts();
        Map<Long, com.enerjistaj.devhub.service.TaskTimeService.Summary> time = taskTime.summaries(tasks);
        return tasks.stream().map(t -> withTime(TaskDto.from(t, comments.getOrDefault(t.getId(), 0L)), time.get(t.getId()))).toList();
    }

    private TaskDto dto(Task t, long comments) {
        return withTime(TaskDto.from(t, comments), taskTime.summary(t));
    }

    private static TaskDto withTime(TaskDto d, com.enerjistaj.devhub.service.TaskTimeService.Summary s) {
        if (s != null) {
            d.setSpentSeconds(s.spentSeconds());
            d.setRunning(s.running());
            d.setTicking(s.ticking());
            d.setStartedAt(s.firstStartedAt());
        }
        return d;
    }

    /** Gövdedeki tahmini süre (dakika); yoksa null. 15 dakika ile 400 saat arası, 15 dakikanın katına yuvarlanır. */
    private static Integer estimateMinutes(Map<String, Object> payload) {
        Object raw = payload.get("estimatedMinutes");
        if (raw == null || raw.toString().isBlank()) return null;
        double v;
        try {
            v = Double.parseDouble(raw.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Tahmini süre sayı olmalı.");
        }
        int m = (int) (Math.round(v / 15.0) * 15);
        if (m < 15 || m > 400 * 60) throw ApiException.badRequest("Tahmini süre 15 dakika ile 400 saat arasında olmalı.");
        return m;
    }

    /** 510 → "8 sa 30 dk" */
    static String hours(int minutes) {
        int h = minutes / 60, m = minutes % 60;
        if (h == 0) return m + " dk";
        return m == 0 ? h + " sa" : h + " sa " + m + " dk";
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
