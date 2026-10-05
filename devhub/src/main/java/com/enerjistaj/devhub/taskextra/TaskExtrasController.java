package com.enerjistaj.devhub.taskextra;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.TaskActivityRepository;
import com.enerjistaj.devhub.repository.TaskRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Görevin alt görevleri, etiketleri, bağımlılıkları ve dosya ekleri.
 * Yetki: alt görev, etiket ve bağımlılığı görevin sahibi ya da yönetici değiştirir (atanmamış görevde yalnızca yönetici).
 * Dosyayı, yorum gibi, ekipteki herkes ekleyebilir; ekleyen, görevin sahibi ya da yönetici siler.
 * Her değişiklik görevin geçmişine yazılır.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TaskExtrasController {

    /** Etiket renkleri: arayüzdeki LABEL_COLORS ile aynı adlar. */
    public static final List<String> COLORS = List.of("blue", "green", "amber", "red", "violet", "teal", "pink", "gray");
    private static final int MAX_SUBTASKS = 50;
    private static final int MAX_LABELS_PER_TASK = 8;

    private final TaskRepository tasks;
    private final TaskActivityRepository activity;
    private final SubtaskRepository subtasks;
    private final LabelRepository labels;
    private final AttachmentRepository attachments;
    private final AttachmentService attachmentService;
    private final TaskExtrasService extras;
    private final CurrentUser currentUser;
    private final ActionLogService actionLog;

    // ------------------------------------------------------------------ alt görevler

    public record SubtaskDto(Long id, String title, boolean done, int position, String doneByName, LocalDateTime doneAt) {
        static SubtaskDto from(TaskSubtask s) {
            return new SubtaskDto(s.getId(), s.getTitle(), s.isDone(), s.getPosition(), s.getDoneBy() != null ? s.getDoneBy().getFullName() : null, s.getDoneAt());
        }
    }

    @GetMapping("/tasks/{taskId}/subtasks")
    public List<SubtaskDto> subtasks(@PathVariable Long taskId) {
        task(taskId);
        return subtasks.findByTaskIdOrderByPositionAscIdAsc(taskId).stream().map(SubtaskDto::from).toList();
    }

    @PostMapping("/tasks/{taskId}/subtasks")
    @Transactional
    public SubtaskDto addSubtask(@PathVariable Long taskId, @RequestBody Map<String, Object> body) {
        Task t = editable(taskId);
        String title = Payloads.requiredText(body, "title", "Alt görev boş olamaz.", 300, "Alt görev");
        List<TaskSubtask> list = subtasks.findByTaskIdOrderByPositionAscIdAsc(taskId);
        if (list.size() >= MAX_SUBTASKS) throw ApiException.badRequest("Bir göreve en fazla " + MAX_SUBTASKS + " alt görev eklenebilir.");
        TaskSubtask s = new TaskSubtask();
        s.setTaskId(taskId);
        s.setTitle(title);
        s.setPosition(list.isEmpty() ? 0 : list.get(list.size() - 1).getPosition() + 1);
        TaskSubtask saved = subtasks.save(s);
        event(t, "alt görev ekledi: " + title);
        return SubtaskDto.from(saved);
    }

    @PutMapping("/tasks/subtasks/{id}")
    @Transactional
    public SubtaskDto updateSubtask(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        TaskSubtask s = subtasks.findById(id).orElseThrow(() -> ApiException.notFound("Alt görev"));
        Task t = editable(s.getTaskId());
        if (body.containsKey("title")) {
            String title = Payloads.requiredText(body, "title", "Alt görev boş olamaz.", 300, "Alt görev");
            if (!title.equals(s.getTitle())) {
                event(t, "alt görevi yeniden adlandırdı: " + s.getTitle() + " → " + title);
                s.setTitle(title);
            }
        }
        if (body.containsKey("done")) {
            boolean done = Payloads.flag(body, "done");
            if (done != s.isDone()) {
                s.setDone(done);
                s.setDoneAt(done ? LocalDateTime.now() : null);
                s.setDoneBy(done ? currentUser.get() : null);
                event(t, (done ? "alt görevi tamamladı: " : "alt görevi yeniden açtı: ") + s.getTitle());
            }
        }
        return SubtaskDto.from(subtasks.save(s));
    }

    @DeleteMapping("/tasks/subtasks/{id}")
    @Transactional
    public ResponseEntity<Void> deleteSubtask(@PathVariable Long id) {
        TaskSubtask s = subtasks.findById(id).orElseThrow(() -> ApiException.notFound("Alt görev"));
        Task t = editable(s.getTaskId());
        subtasks.delete(s);
        event(t, "alt görevi sildi: " + s.getTitle());
        return ResponseEntity.noContent().build();
    }

    /** Sürükle-bırak sırası: ids dizisindeki sıra. */
    @PutMapping("/tasks/{taskId}/subtasks/order")
    @Transactional
    public ResponseEntity<Void> reorderSubtasks(@PathVariable Long taskId, @RequestBody Map<String, Object> body) {
        editable(taskId);
        List<Long> ids = ids(body.get("ids"));
        Map<Long, TaskSubtask> byId = new HashMap<>();
        subtasks.findByTaskIdOrderByPositionAscIdAsc(taskId).forEach(s -> byId.put(s.getId(), s));
        for (int i = 0; i < ids.size(); i++) {
            TaskSubtask s = byId.get(ids.get(i));
            if (s != null) s.setPosition(i);
        }
        subtasks.saveAll(byId.values());
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ etiketler

    public record LabelDto(Long id, String name, String color) {
        static LabelDto from(Label l) { return new LabelDto(l.getId(), l.getName(), l.getColor()); }
    }

    @GetMapping("/labels")
    public List<LabelDto> labels() {
        return labels.findAllByOrderByNameAsc().stream().map(LabelDto::from).toList();
    }

    /** Herkes yeni etiket oluşturabilir (görevi etiketlerken listede yoksa). */
    @PostMapping("/labels")
    @Transactional
    public LabelDto createLabel(@RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        String name = labelName(body);
        if (labels.existsByNameIgnoreCase(name)) throw ApiException.conflict("\"" + name + "\" adında bir etiket zaten var.");
        Label l = new Label();
        l.setName(name);
        l.setColor(color(body, COLORS.get((int) (labels.count() % COLORS.size()))));
        l.setCreatedBy(me);
        Label saved = labels.save(l);
        actionLog.record(LogCategory.GOREV, LogAction.OLUSTURMA, "Etiket oluşturuldu: " + name).by(me).target("ETIKET", saved.getId(), name).save();
        return LabelDto.from(saved);
    }

    @PutMapping("/labels/{id}")
    @Transactional
    public LabelDto updateLabel(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin("Etiketleri yalnızca yöneticiler düzenleyebilir.");
        Label l = labels.findById(id).orElseThrow(() -> ApiException.notFound("Etiket"));
        String old = l.getName();
        if (body.containsKey("name")) {
            String name = labelName(body);
            if (!name.equalsIgnoreCase(l.getName()) && labels.existsByNameIgnoreCase(name)) throw ApiException.conflict("\"" + name + "\" adında bir etiket zaten var.");
            l.setName(name);
        }
        if (body.containsKey("color")) l.setColor(color(body, l.getColor()));
        Label saved = labels.save(l);
        actionLog.record(LogCategory.GOREV, LogAction.GUNCELLEME, "Etiket düzenlendi: " + saved.getName()).by(me)
            .target("ETIKET", saved.getId(), saved.getName()).change("Ad", old, saved.getName()).save();
        return LabelDto.from(saved);
    }

    @DeleteMapping("/labels/{id}")
    @Transactional
    public ResponseEntity<Void> deleteLabel(@PathVariable Long id) {
        User me = currentUser.requireAdmin("Etiketleri yalnızca yöneticiler silebilir.");
        Label l = labels.findById(id).orElseThrow(() -> ApiException.notFound("Etiket"));
        labels.delete(l);
        actionLog.record(LogCategory.GOREV, LogAction.SILME, "Etiket silindi: " + l.getName()).by(me).target("ETIKET", id, l.getName())
            .detail("Etiket bütün görevlerden kaldırıldı").level(LogLevel.UYARI).save();
        return ResponseEntity.noContent().build();
    }

    /** Görevin etiketlerini verilen listeyle değiştirir. */
    @PutMapping("/tasks/{taskId}/labels")
    @Transactional
    public List<Long> setTaskLabels(@PathVariable Long taskId, @RequestBody Map<String, Object> body) {
        Task t = editable(taskId);
        List<Long> wanted = ids(body.get("labelIds"));
        if (wanted.size() > MAX_LABELS_PER_TASK) throw ApiException.badRequest("Bir görevde en fazla " + MAX_LABELS_PER_TASK + " etiket olabilir.");
        Map<Long, Label> found = new HashMap<>();
        labels.findAllById(wanted).forEach(l -> found.put(l.getId(), l));
        if (found.size() != wanted.size()) throw ApiException.notFound("Etiket");
        Set<Long> before = new HashSet<>(extras.labelIds(taskId));
        extras.setLabels(taskId, wanted);
        List<String> added = wanted.stream().filter(id -> !before.contains(id)).map(id -> found.get(id).getName()).toList();
        List<String> removed = before.stream().filter(id -> !wanted.contains(id)).map(id -> labels.findById(id).map(Label::getName).orElse("?")).toList();
        if (!added.isEmpty()) event(t, "etiket ekledi: " + String.join(", ", added));
        if (!removed.isEmpty()) event(t, "etiket kaldırdı: " + String.join(", ", removed));
        return wanted;
    }

    // ------------------------------------------------------------------ bağımlılıklar

    @GetMapping("/tasks/{taskId}/dependencies")
    public Map<String, List<Map<String, Object>>> dependencies(@PathVariable Long taskId) {
        task(taskId);
        return extras.dependencies(taskId);
    }

    /** "Bu görev, blockedById bitmeden başlayamaz." */
    @PostMapping("/tasks/{taskId}/dependencies")
    @Transactional
    public Map<String, List<Map<String, Object>>> addDependency(@PathVariable Long taskId, @RequestBody Map<String, Object> body) {
        Task t = editable(taskId);
        Long blockerId = ids(List.of(String.valueOf(body.get("blockedById")))).stream().findFirst()
            .orElseThrow(() -> ApiException.badRequest("Beklenecek görevi seçin."));
        if (blockerId.equals(taskId)) throw ApiException.badRequest("Görev kendini bekleyemez.");
        Task blocker = task(blockerId);
        if (extras.exists(taskId, blockerId)) throw ApiException.conflict("Bu bağımlılık zaten var.");
        if (extras.wouldCycle(taskId, blockerId)) {
            throw ApiException.conflict("\"" + blocker.getContent() + "\" zaten bu görevi bekliyor; ikisi birbirini beklerse hiçbiri başlayamaz.");
        }
        extras.addDependency(taskId, blockerId, currentUser.get().getId());
        event(t, "bağımlılık ekledi: \"" + blocker.getContent() + "\" bitmeden başlanamaz");
        event(blocker, "bu görevi bekleyen bir görev eklendi: \"" + t.getContent() + "\"");
        actionLog.record(LogCategory.GOREV, LogAction.GUNCELLEME, "Görev bağımlılığı eklendi: " + t.getContent()).by(currentUser.get())
            .target("GOREV", t.getId(), t.getContent()).detail("Önce bitmesi gereken: " + blocker.getContent()).save();
        return extras.dependencies(taskId);
    }

    @DeleteMapping("/tasks/{taskId}/dependencies/{blockerId}")
    @Transactional
    public Map<String, List<Map<String, Object>>> removeDependency(@PathVariable Long taskId, @PathVariable Long blockerId) {
        Task t = editable(taskId);
        if (!extras.exists(taskId, blockerId)) throw ApiException.notFound("Bağımlılık");
        extras.removeDependency(taskId, blockerId);
        String name = tasks.findById(blockerId).map(Task::getContent).orElse("#" + blockerId);
        event(t, "bağımlılığı kaldırdı: \"" + name + "\"");
        return extras.dependencies(taskId);
    }

    // ------------------------------------------------------------------ dosya ekleri

    @GetMapping("/tasks/{taskId}/attachments")
    public List<AttachmentInfo> attachments(@PathVariable Long taskId) {
        task(taskId);
        return attachments.infoForTask(taskId);
    }

    @PostMapping("/tasks/{taskId}/attachments")
    @Transactional
    public List<AttachmentInfo> upload(@PathVariable Long taskId, @RequestParam("file") MultipartFile file) {
        Task t = task(taskId);
        Attachment a = attachmentService.build(file, currentUser.get(), attachments.totalSizeForTask(taskId));
        a.setTaskId(taskId);
        attachments.save(a);
        event(t, "dosya ekledi: " + a.getFileName());
        return attachments.infoForTask(taskId);
    }

    @GetMapping("/attachments/{id}")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        // Talep dosyaları yalnızca talebi görebilenlere açılır (talepler kişiye özel).
        User me = currentUser.get();
        Long ticketId = attachments.ticketIdOf(id);
        if (ticketId != null && !CurrentUser.isAdmin(me) && !ticketOwner(ticketId, me.getId())) throw ApiException.notFound("Dosya");
        return attachmentService.serve(id);
    }

    /** Ekleyen kişi, görevin/talebin sahibi ya da yönetici silebilir. */
    @DeleteMapping("/attachments/{id}")
    @Transactional
    public ResponseEntity<Void> deleteAttachment(@PathVariable Long id) {
        User me = currentUser.get();
        Attachment a = attachments.findById(id).orElseThrow(() -> ApiException.notFound("Dosya"));
        boolean uploader = a.getUploader() != null && a.getUploader().getId().equals(me.getId());
        Task t = a.getTaskId() != null ? tasks.findById(a.getTaskId()).orElse(null) : null;
        boolean owner = t != null && t.getUser() != null && t.getUser().getId().equals(me.getId());
        if (a.getTicketId() != null) owner = owner || ticketOwner(a.getTicketId(), me.getId());
        if (!uploader && !owner && !CurrentUser.isAdmin(me)) throw ApiException.forbidden("Bu dosyayı yalnızca ekleyen kişi ya da bir yönetici silebilir.");
        attachments.delete(a);
        if (t != null) event(t, "dosyayı sildi: " + a.getFileName());
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ yardımcılar

    /** Talep sahibi/atanan kişi (talep modülü V27). */
    private boolean ticketOwner(Long ticketId, Long userId) {
        return ticketAccess != null && ticketAccess.isAssigneeOrRequester(ticketId, userId);
    }

    /** Talep modülü isteğe bağlı bağımlılık: yoksa yalnızca yükleyen ve yönetici silebilir. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private TicketAccess ticketAccess;

    /** Talep modülünün sağladığı yetki sorgusu (döngüsel bağımlılık olmasın diye arayüz). */
    public interface TicketAccess {
        boolean isAssigneeOrRequester(Long ticketId, Long userId);
    }

    private Task task(Long id) {
        return tasks.findById(id).orElseThrow(() -> ApiException.notFound("Görev"));
    }

    /** Görevin sahibi ya da yönetici; atanmamış görevde yalnızca yönetici. */
    private Task editable(Long id) {
        Task t = task(id);
        User me = currentUser.get();
        boolean owner = t.getUser() != null && t.getUser().getId().equals(me.getId());
        if (!owner && !CurrentUser.isAdmin(me)) {
            throw ApiException.forbidden(t.getUser() == null ? "Atanmamış görevi yalnızca yöneticiler düzenleyebilir." : "Yalnızca kendi görevlerinizi düzenleyebilirsiniz.");
        }
        return t;
    }

    private void event(Task t, String message) {
        TaskActivity a = new TaskActivity();
        a.setTask(t);
        a.setActor(currentUser.get());
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage(message.length() > 1000 ? message.substring(0, 997) + "..." : message);
        activity.save(a);
    }

    private static String labelName(Map<String, Object> body) {
        String n = Payloads.requiredText(body, "name", "Etiket adı boş olamaz.", 40, "Etiket").replaceAll("\\s+", " ");
        return n;
    }

    private static String color(Map<String, Object> body, String fallback) {
        String c = Payloads.text(body, "color");
        if (c == null) return fallback;
        if (!COLORS.contains(c)) throw ApiException.badRequest("Geçersiz etiket rengi.");
        return c;
    }

    private static List<Long> ids(Object raw) {
        if (!(raw instanceof Collection<?> c)) return List.of();
        List<Long> out = new ArrayList<>();
        for (Object o : c) {
            if (o == null || o.toString().isBlank() || "null".equals(o.toString())) continue;
            try {
                Long v = Long.valueOf(o.toString());
                if (!out.contains(v)) out.add(v);
            } catch (NumberFormatException e) {
                throw ApiException.badRequest("Geçersiz kimlik: " + o);
            }
        }
        return out;
    }
}
