package com.enerjistaj.devhub.ticket;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.ProjectRepository;
import com.enerjistaj.devhub.repository.TaskActivityRepository;
import com.enerjistaj.devhub.repository.TaskRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.service.TaskCompletionListener;
import com.enerjistaj.devhub.service.WorkTimeService;
import com.enerjistaj.devhub.taskextra.TaskExtrasController;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Şirket içi talepler: çalışan arıza, erişim, ekipman gibi ihtiyaçlarını kendi adına yönetime iletir.
 * Çözüm hedefi (SLA) önceliğe göre mesai saatiyle hesaplanır: Acil 4 saat, Yüksek 1 iş günü, Normal 3 iş günü, Düşük 5 iş günü.
 * "Yanıt bekleniyor" durumundaki talep hedefi geçse de gecikmiş sayılmaz (top talep edende).
 * Görünürlük: yönetici hepsini, çalışan yalnızca açtığı ya da kendisine atanan talepleri görür (başkasınınki 404).
 * Talebi açan her zaman giriş yapan kişidir; atamayı yalnızca yönetici yapar. Alanları yönetici, atanan ya da açan kişi değiştirir.
 * Talepten DevHub görevi açılabilir (yönetici ya da atanan); görev bitince talebe not düşer.
 */
@Service
@RequiredArgsConstructor
public class TicketService implements TaskCompletionListener, TaskExtrasController.TicketAccess, com.enerjistaj.devhub.service.UserDeactivationListener {

    public enum Type { ARIZA, ERISIM, EKIPMAN, DIGER }
    public enum Priority { DUSUK, NORMAL, YUKSEK, ACIL }
    public enum Status { YENI, INCELENIYOR, YANIT_BEKLENIYOR, COZULDU, KAPANDI }

    static final Map<Type, String> TYPE_LABEL = Map.of(Type.ARIZA, "Arıza", Type.ERISIM, "Erişim / yetki", Type.EKIPMAN, "Ekipman", Type.DIGER, "Diğer");
    static final Map<Priority, String> PRIORITY_LABEL = Map.of(Priority.DUSUK, "Düşük", Priority.NORMAL, "Normal", Priority.YUKSEK, "Yüksek", Priority.ACIL, "Acil");
    static final Map<Status, String> STATUS_LABEL = Map.of(Status.YENI, "Yeni", Status.INCELENIYOR, "İnceleniyor",
        Status.YANIT_BEKLENIYOR, "Yanıt bekleniyor", Status.COZULDU, "Çözüldü", Status.KAPANDI, "Kapandı");
    /** Çözüm hedefi (mesai saati) */
    static final Map<Priority, Integer> SLA_HOURS = Map.of(Priority.ACIL, 4, Priority.YUKSEK, 8, Priority.NORMAL, 24, Priority.DUSUK, 40);

    public record TicketDto(Long id, String number, String title, String description,
                            Type type, Priority priority, Status status, Long assigneeId, String assigneeName, Long requesterId, String requesterName,
                            Long projectId, Long taskId, String taskStatus, LocalDateTime dueAt, boolean overdue,
                            LocalDateTime firstResponseAt, LocalDateTime resolvedAt, LocalDateTime closedAt,
                            LocalDateTime createdAt, LocalDateTime updatedAt, int commentCount, int attachmentCount) {}

    public record ActivityDto(Long id, Long actorId, String actorName, String actorAvatarColor, String kind, String message, LocalDateTime createdAt) {}

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final ProjectRepository projects;
    private final TaskRepository tasks;
    private final TaskActivityRepository taskActivity;
    private final NotificationService notifications;
    private final ActionLogService actionLog;
    private final WorkTimeService workTime;

    // ================================================================== okuma

    private static final String SELECT = "SELECT t.*, a.full_name AS assignee_name, r.full_name AS requester_name, k.status AS task_status, "
        + "(SELECT COUNT(*) FROM ticket_activity x WHERE x.ticket_id = t.id AND x.kind = 'COMMENT') AS comments, "
        + "(SELECT COUNT(*) FROM attachments f WHERE f.ticket_id = t.id) AS files "
        + "FROM tickets t LEFT JOIN users a ON a.id = t.assignee_id LEFT JOIN users r ON r.id = t.requester_id LEFT JOIN tasks k ON k.id = t.task_id";

    public List<TicketDto> list(User me) {
        if (CurrentUser.isAdmin(me)) return jdbc.query(SELECT + " ORDER BY t.created_at DESC", this::dto);
        return jdbc.query(SELECT + " WHERE t.requester_id = ? OR t.assignee_id = ? ORDER BY t.created_at DESC", this::dto, me.getId(), me.getId());
    }

    /** Görme yetkisi yoksa talep "bulunamadı" sayılır (varlığı da sızmasın). */
    public TicketDto get(Long id, User me) {
        TicketDto t = load(id);
        if (!canSee(t.requesterId(), t.assigneeId(), me)) throw ApiException.notFound("Talep");
        return t;
    }

    /** Yetki kontrolsüz okuma: yazma işleminin sonucu (ör. talebi bırakan kişi artık göremese de) döndürülürken. */
    private TicketDto load(Long id) {
        List<TicketDto> found = jdbc.query(SELECT + " WHERE t.id = ?", this::dto, id);
        if (found.isEmpty()) throw ApiException.notFound("Talep");
        return found.get(0);
    }

    public List<ActivityDto> activity(Long id, User me) {
        get(id, me);
        return jdbc.query("SELECT x.*, u.full_name, u.avatar_color FROM ticket_activity x LEFT JOIN users u ON u.id = x.actor_id "
            + "WHERE x.ticket_id = ? ORDER BY x.created_at, x.id", (rs, i) -> new ActivityDto(rs.getLong("id"), (Long) rs.getObject("actor_id", Long.class),
            rs.getString("full_name"), rs.getString("avatar_color"), rs.getString("kind"), rs.getString("message"), ts(rs, "created_at")), id);
    }

    private TicketDto dto(ResultSet rs, int i) throws SQLException {
        Status status = Status.valueOf(rs.getString("status"));
        LocalDateTime due = ts(rs, "due_at");
        boolean open = status == Status.YENI || status == Status.INCELENIYOR;
        boolean overdue = open && due != null && due.isBefore(LocalDateTime.now(ZoneOffset.UTC));
        long id = rs.getLong("id");
        return new TicketDto(id, number(id), rs.getString("title"), rs.getString("description"),
            Type.valueOf(rs.getString("type")), Priority.valueOf(rs.getString("priority")), status,
            (Long) rs.getObject("assignee_id", Long.class), rs.getString("assignee_name"), (Long) rs.getObject("requester_id", Long.class), rs.getString("requester_name"),
            (Long) rs.getObject("project_id", Long.class), (Long) rs.getObject("task_id", Long.class), rs.getString("task_status"),
            due, overdue, ts(rs, "first_response_at"), ts(rs, "resolved_at"), ts(rs, "closed_at"), ts(rs, "created_at"), ts(rs, "updated_at"),
            rs.getInt("comments"), rs.getInt("files"));
    }

    static String number(long id) {
        return String.format("DT-%04d", id);
    }

    // ================================================================== yazma

    @Transactional
    public TicketDto create(Map<String, Object> body, User me) {
        String title = Payloads.requiredText(body, "title", "Talebin konusunu yazın.", 300, "Konu");
        String description = Payloads.optionalText(body, "description", 8000, "Açıklama");
        Type type = Optional.ofNullable(Payloads.enumValue(body, "type", Type.class, "tür")).orElse(Type.DIGER);
        Priority priority = Optional.ofNullable(Payloads.enumValue(body, "priority", Priority.class, "öncelik")).orElse(Priority.NORMAL);
        // Çalışanın talebi yönetime gider; kime verileceğine yönetici karar verir.
        Long assigneeId = CurrentUser.isAdmin(me) ? id(body.get("assigneeId")) : null;
        User assignee = assigneeId == null ? null : activeUser(assigneeId);
        Long projectId = id(body.get("projectId"));
        if (projectId != null && !projects.existsById(projectId)) throw ApiException.notFound("Proje");
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime due = workTime.addWorkSeconds(now, SLA_HOURS.get(priority) * 3600L);

        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(c -> {
            PreparedStatement ps = c.prepareStatement("INSERT INTO tickets (title, description, type, priority, status, assignee_id, requester_id, "
                + "project_id, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'YENI', ?, ?, ?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, title);
            ps.setString(2, description);
            ps.setString(3, type.name());
            ps.setString(4, priority.name());
            ps.setObject(5, assignee == null ? null : assignee.getId());
            ps.setLong(6, me.getId());
            ps.setObject(7, projectId);
            ps.setTimestamp(8, Timestamp.valueOf(due));
            ps.setTimestamp(9, Timestamp.valueOf(now));
            ps.setTimestamp(10, Timestamp.valueOf(now));
            return ps;
        }, key);
        long id = Objects.requireNonNull(key.getKey()).longValue();
        event(id, me, "talebi açtı");
        if (assignee != null) event(id, me, assignee.getId().equals(me.getId()) ? "talebi üstlendi" : "talebi " + assignee.getFullName() + " kişisine atadı");
        actionLog.record(LogCategory.DESTEK, LogAction.OLUSTURMA, "Talep açıldı: " + number(id) + " " + title).by(me).target("TALEP", id, title)
            .detail("Tür: " + TYPE_LABEL.get(type) + " · Öncelik: " + PRIORITY_LABEL.get(priority))
            .detail(assignee != null ? "Atanan: " + assignee.getFullName() : "Atanmadı").save();
        String link = "/tickets?talep=" + id;
        if (assignee != null) notifications.notify(assignee, me, NotificationType.TICKET_ASSIGNED, "Size talep atandı: " + number(id), title, link);
        else notifications.notifyAdmins(me, NotificationType.TICKET_ASSIGNED, me.getFullName() + " talep açtı: " + number(id) + (priority == Priority.ACIL ? " (Acil)" : ""),
            TYPE_LABEL.get(type) + " · " + title, link);
        return get(id, me);
    }

    @Transactional
    public TicketDto update(Long id, Map<String, Object> body, User me) {
        Map<String, Object> t = row(id, me);
        requireEditor(t, me);
        boolean admin = CurrentUser.isAdmin(me);
        List<String> changes = new ArrayList<>();
        Map<String, Object> set = new LinkedHashMap<>();

        if (body.containsKey("title")) text(t, set, changes, "title", "Konu", Payloads.requiredText(body, "title", "Talebin konusunu yazın.", 300, "Konu"));
        if (body.containsKey("description")) {
            String d = Payloads.optionalText(body, "description", 8000, "Açıklama");
            if (!Objects.equals(d, t.get("description"))) { set.put("description", d); changes.add("açıklamayı güncelledi"); }
        }
        if (body.containsKey("type")) {
            Type v = Payloads.enumValue(body, "type", Type.class, "tür");
            if (v != null && !v.name().equals(t.get("type"))) {
                set.put("type", v.name());
                changes.add("türü değiştirdi: " + TYPE_LABEL.get(Type.valueOf((String) t.get("type"))) + " → " + TYPE_LABEL.get(v));
            }
        }
        if (body.containsKey("priority")) {
            Priority v = Payloads.enumValue(body, "priority", Priority.class, "öncelik");
            if (v != null && !v.name().equals(t.get("priority"))) {
                set.put("priority", v.name());
                // Hedef, talebin açıldığı andan yeni önceliğe göre yeniden hesaplanır.
                set.put("due_at", Timestamp.valueOf(workTime.addWorkSeconds(ldt(t.get("created_at")), SLA_HOURS.get(v) * 3600L)));
                changes.add("önceliği değiştirdi: " + PRIORITY_LABEL.get(Priority.valueOf((String) t.get("priority"))) + " → " + PRIORITY_LABEL.get(v));
            }
        }
        if (body.containsKey("projectId")) {
            Long p = id(body.get("projectId"));
            if (p != null && !projects.existsById(p)) throw ApiException.notFound("Proje");
            if (!Objects.equals(p, toLong(t.get("project_id")))) { set.put("project_id", p); changes.add("projeyi değiştirdi"); }
        }
        User newAssignee = null;
        if (body.containsKey("assigneeId")) {
            Long a = id(body.get("assigneeId"));
            Long cur = toLong(t.get("assignee_id"));
            if (!Objects.equals(a, cur)) {
                // Atanan kişi talebi bırakabilir (yönetime geri döner); atamayı yalnızca yönetici yapar.
                boolean selfDrop = a == null && me.getId().equals(cur);
                if (!admin && !selfDrop) throw ApiException.forbidden("Talepleri yalnızca yöneticiler atayabilir.");
                newAssignee = a == null ? null : activeUser(a);
                set.put("assignee_id", a);
                changes.add(a == null ? (selfDrop ? "talebi bıraktı" : "atamayı kaldırdı") : a.equals(me.getId()) ? "talebi üstlendi" : "talebi " + newAssignee.getFullName() + " kişisine atadı");
            }
        }
        Status oldStatus = Status.valueOf((String) t.get("status"));
        Status newStatus = oldStatus;
        if (body.containsKey("status")) {
            Status v = Payloads.enumValue(body, "status", Status.class, "durum");
            if (v != null && v != oldStatus) {
                newStatus = v;
                set.put("status", v.name());
                LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
                if (v == Status.COZULDU) set.put("resolved_at", Timestamp.valueOf(now));
                if (v == Status.KAPANDI) { set.put("closed_at", Timestamp.valueOf(now)); if (t.get("resolved_at") == null) set.put("resolved_at", Timestamp.valueOf(now)); }
                if (v == Status.YENI || v == Status.INCELENIYOR || v == Status.YANIT_BEKLENIYOR) { set.put("resolved_at", null); set.put("closed_at", null); }
                if (t.get("first_response_at") == null && oldStatus == Status.YENI) set.put("first_response_at", Timestamp.valueOf(now));
                changes.add("durumu değiştirdi: " + STATUS_LABEL.get(oldStatus) + " → " + STATUS_LABEL.get(v));
            }
        }
        if (set.isEmpty()) return get(id, me);
        set.put("updated_at", Timestamp.valueOf(LocalDateTime.now(ZoneOffset.UTC)));
        StringBuilder sql = new StringBuilder("UPDATE tickets SET ");
        set.keySet().forEach(k -> sql.append(k).append(" = ?, "));
        sql.setLength(sql.length() - 2);
        sql.append(" WHERE id = ?");
        List<Object> args = new ArrayList<>(set.values());
        args.add(id);
        jdbc.update(sql.toString(), args.toArray());
        changes.forEach(c -> event(id, me, c));

        String title = (String) t.get("title");
        String link = "/tickets?talep=" + id;
        actionLog.record(LogCategory.DESTEK, newAssignee != null ? LogAction.ATAMA : newStatus != oldStatus ? LogAction.DURUM_DEGISIKLIGI : LogAction.GUNCELLEME,
            "Talep güncellendi: " + number(id) + " " + title).by(me).target("TALEP", id, title).details(changes).save();
        if (newAssignee != null && !newAssignee.getId().equals(me.getId())) {
            notifications.notify(newAssignee, me, NotificationType.TICKET_ASSIGNED, "Size talep atandı: " + number(id), title, link);
            User requester = userOrNull(toLong(t.get("requester_id")));
            if (requester != null && !requester.getId().equals(newAssignee.getId())) {
                notifications.notify(requester, me, NotificationType.TICKET_UPDATED, number(id) + " talebiniz " + newAssignee.getFullName() + " kişisine atandı", title, link);
            }
        }
        if (newStatus != oldStatus && newStatus == Status.YANIT_BEKLENIYOR) {
            notifications.notify(userOrNull(toLong(t.get("requester_id"))), me, NotificationType.TICKET_UPDATED, number(id) + ": sizden yanıt bekleniyor", title, link);
        }
        if (newStatus != oldStatus && (newStatus == Status.COZULDU || newStatus == Status.KAPANDI)) {
            User requester = userOrNull(toLong(t.get("requester_id")));
            notifications.notify(requester, me, NotificationType.TICKET_UPDATED, number(id) + " " + STATUS_LABEL.get(newStatus).toLowerCase(new Locale("tr")), title, link);
        }
        return load(id);
    }

    @Transactional
    public ActivityDto comment(Long id, Map<String, Object> body, User me) {
        Map<String, Object> t = row(id, me);
        String text = Payloads.requiredText(body, "text", "Yorum boş olamaz.", 4000, "Yorum");
        long cid = insertActivity(id, me, "COMMENT", text);
        if (t.get("first_response_at") == null && !me.getId().equals(toLong(t.get("requester_id")))) {
            jdbc.update("UPDATE tickets SET first_response_at = UTC_TIMESTAMP() WHERE id = ?", id);
        }
        jdbc.update("UPDATE tickets SET updated_at = UTC_TIMESTAMP() WHERE id = ?", id);
        String title = (String) t.get("title");
        actionLog.record(LogCategory.DESTEK, LogAction.YORUM, "Talebe yorum yazıldı: " + number(id) + " " + title).by(me).target("TALEP", id, title)
            .detail("Yorum: " + (text.length() > 300 ? text.substring(0, 297) + "..." : text)).save();
        Map<Long, User> to = new LinkedHashMap<>();
        Optional.ofNullable(userOrNull(toLong(t.get("assignee_id")))).ifPresent(u -> to.put(u.getId(), u));
        Optional.ofNullable(userOrNull(toLong(t.get("requester_id")))).ifPresent(u -> to.putIfAbsent(u.getId(), u));
        to.values().forEach(u -> notifications.notify(u, me, NotificationType.TICKET_COMMENT, me.getFullName() + " " + number(id) + " talebine yorum yazdı",
            title + " — " + text, "/tickets?talep=" + id));
        return activity(id, me).stream().filter(a -> a.id() == cid).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteComment(Long id, Long commentId, User me) {
        row(id, me);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT actor_id FROM ticket_activity WHERE id = ? AND ticket_id = ? AND kind = 'COMMENT'", commentId, id);
        if (rows.isEmpty()) throw ApiException.notFound("Yorum");
        Long author = toLong(rows.get(0).get("actor_id"));
        if (!CurrentUser.isAdmin(me) && !me.getId().equals(author)) throw ApiException.forbidden("Yalnızca kendi yorumlarınızı silebilirsiniz.");
        jdbc.update("DELETE FROM ticket_activity WHERE id = ?", commentId);
    }

    /** Talepten DevHub görevi açar (iş planına girsin diye). Yönetici herkese, talebe atanan kişi kendine açabilir. */
    @Transactional
    public TicketDto createTask(Long id, Map<String, Object> body, User me) {
        Map<String, Object> t = row(id, me);
        if (!CurrentUser.isAdmin(me) && !me.getId().equals(toLong(t.get("assignee_id")))) {
            throw ApiException.forbidden("Talepten görevi yalnızca yönetici ya da talebe atanan kişi oluşturabilir.");
        }
        if (t.get("task_id") != null && tasks.existsById(toLong(t.get("task_id")))) throw ApiException.conflict("Bu talebe bağlı bir görev zaten var.");
        Long userId = id(body.get("userId"));
        if (userId == null) userId = Optional.ofNullable(toLong(t.get("assignee_id"))).orElse(me.getId());
        if (!CurrentUser.isAdmin(me) && !userId.equals(me.getId())) throw ApiException.forbidden("Başkasına görev yalnızca yöneticiler açabilir.");
        User owner = activeUser(userId);
        Object est = body.get("estimatedMinutes");
        int minutes;
        try {
            minutes = (int) (Math.round(Double.parseDouble(String.valueOf(est)) / 15.0) * 15);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Görevin tahmini süresini girin.");
        }
        if (minutes < 15 || minutes > 400 * 60) throw ApiException.badRequest("Tahmini süre 15 dakika ile 400 saat arasında olmalı.");

        String title = (String) t.get("title");
        Task task = new Task();
        task.setUser(owner);
        task.setContent(truncate(number(id) + ": " + title, 1000));
        task.setDescription(truncate("Talep " + number(id) + " · Talep eden: " + Objects.toString(userName(toLong(t.get("requester_id"))), "-") + "\n\n"
            + Objects.toString(t.get("description"), ""), 4000).trim());
        Priority p = Priority.valueOf((String) t.get("priority"));
        task.setPriority(p == Priority.ACIL || p == Priority.YUKSEK ? TaskPriority.YUKSEK : p == Priority.DUSUK ? TaskPriority.DUSUK : TaskPriority.ORTA);
        if (t.get("due_at") != null) {
            task.setDueDate(ldt(t.get("due_at")).atZone(ZoneOffset.UTC).withZoneSameInstant(ActionLogService.ZONE).toLocalDate());
        }
        task.setEstimatedMinutes(minutes);
        task.setCreatedBy(me);
        Long projectId = toLong(t.get("project_id"));
        if (projectId != null) projects.findById(projectId).ifPresent(task::setProject);
        else if (owner.getCurrentProject() != null) projects.findByName(owner.getCurrentProject()).ifPresent(task::setProject);
        Task saved = tasks.save(task);
        TaskActivity a = new TaskActivity();
        a.setTask(saved);
        a.setActor(me);
        a.setKind(TaskActivityKind.EVENT);
        a.setMessage("görevi " + number(id) + " talebinden oluşturdu");
        taskActivity.save(a);

        jdbc.update("UPDATE tickets SET task_id = ?, status = CASE WHEN status = 'YENI' THEN 'INCELENIYOR' ELSE status END, "
            + "first_response_at = COALESCE(first_response_at, UTC_TIMESTAMP()), updated_at = UTC_TIMESTAMP() WHERE id = ?", saved.getId(), id);
        event(id, me, "görev oluşturdu ve " + owner.getFullName() + " kişisine atadı");
        actionLog.record(LogCategory.GOREV, LogAction.OLUSTURMA, owner.getFullName() + " için yeni görev: " + saved.getContent()).by(me)
            .target("GOREV", saved.getId(), saved.getContent()).detail("Talepten: " + number(id)).save();
        notifications.notify(owner, me, NotificationType.TASK_ASSIGNED, "Size yeni görev atandı", saved.getContent(), "/tasks?task=" + saved.getId());
        return get(id, me);
    }

    @Transactional
    public void delete(Long id, User me) {
        currentAdmin(me);
        Map<String, Object> t = row(id, me);
        jdbc.update("DELETE FROM tickets WHERE id = ?", id);
        actionLog.record(LogCategory.DESTEK, LogAction.SILME, "Talep silindi: " + number(id) + " " + t.get("title")).by(me)
            .target("TALEP", id, (String) t.get("title")).level(LogLevel.UYARI).save();
    }

    /** Bağlı görev bitti: talebe not düşer, talebi takip edenlere "çözüldü olarak işaretlenebilir" bildirimi gider. */
    @Override
    public void taskCompleted(Task task, User actor) {
        List<Map<String, Object>> linked = jdbc.queryForList("SELECT id, title, assignee_id, requester_id FROM tickets WHERE task_id = ? AND status NOT IN ('COZULDU','KAPANDI')", task.getId());
        for (Map<String, Object> t : linked) {
            long id = toLong(t.get("id"));
            event(id, actor, "bağlı görevi tamamladı; talep çözüldü olarak işaretlenebilir");
            Set<Long> to = new LinkedHashSet<>();
            Optional.ofNullable(toLong(t.get("assignee_id"))).ifPresent(to::add);
            Optional.ofNullable(toLong(t.get("requester_id"))).ifPresent(to::add);
            users.findAllById(to).forEach(u -> notifications.notify(u, actor, NotificationType.TICKET_UPDATED, number(id) + ": bağlı görev tamamlandı",
                t.get("title") + " — talep edene dönüş yapıp talebi çözüldü olarak işaretleyebilirsiniz.", "/tickets?talep=" + id));
        }
    }

    /** Hesabı kapatılan kişiye atanmış açık talepler yönetime (atanmamış) döner. */
    @Override
    public List<String> userDeactivated(User user, User actor) {
        List<Long> ids = jdbc.queryForList("SELECT id FROM tickets WHERE assignee_id = ? AND status IN ('YENI','INCELENIYOR','YANIT_BEKLENIYOR')", Long.class, user.getId());
        for (Long id : ids) {
            jdbc.update("UPDATE tickets SET assignee_id = NULL, updated_at = UTC_TIMESTAMP() WHERE id = ?", id);
            event(id, actor, user.getFullName() + " kişisinin hesabı kapatıldığı için talep yönetime döndü");
        }
        return ids.isEmpty() ? List.of() : List.of(ids.size() + " açık talep yönetime döndü");
    }

    @Override
    public boolean isAssigneeOrRequester(Long ticketId, Long userId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM tickets WHERE id = ? AND (assignee_id = ? OR requester_id = ?)", Integer.class, ticketId, userId, userId);
        return n != null && n > 0;
    }

    // ================================================================== yardımcılar

    /** Talep satırı; görme yetkisi yoksa "bulunamadı". */
    Map<String, Object> row(Long id, User me) {
        List<Map<String, Object>> r = jdbc.queryForList("SELECT * FROM tickets WHERE id = ?", id);
        if (r.isEmpty() || !canSee(toLong(r.get(0).get("requester_id")), toLong(r.get(0).get("assignee_id")), me)) throw ApiException.notFound("Talep");
        return r.get(0);
    }

    private static boolean canSee(Long requesterId, Long assigneeId, User me) {
        return CurrentUser.isAdmin(me) || me.getId().equals(requesterId) || me.getId().equals(assigneeId);
    }

    /** Görebilen herkes (yönetici, açan, atanan) talebi düzenleyebilir. */
    void requireEditor(Map<String, Object> t, User me) {
        if (!canSee(toLong(t.get("requester_id")), toLong(t.get("assignee_id")), me)) {
            throw ApiException.forbidden("Bu talebi yalnızca açan kişi, atanan kişi ya da bir yönetici düzenleyebilir.");
        }
    }

    private void currentAdmin(User me) {
        if (!CurrentUser.isAdmin(me)) throw ApiException.forbidden("Talepleri yalnızca yöneticiler silebilir.");
    }

    private void text(Map<String, Object> t, Map<String, Object> set, List<String> changes, String col, String label, String v) {
        if (Objects.equals(v, t.get(col))) return;
        set.put(col, v);
        Object old = t.get(col);
        changes.add(label.toLowerCase(new Locale("tr")) + " alanını değiştirdi" + (old != null && v != null && v.length() < 60 && old.toString().length() < 60 ? ": " + old + " → " + v : ""));
    }

    private void event(long ticketId, User actor, String message) {
        insertActivity(ticketId, actor, "EVENT", message);
    }

    private long insertActivity(long ticketId, User actor, String kind, String message) {
        GeneratedKeyHolder key = new GeneratedKeyHolder();
        jdbc.update(c -> {
            PreparedStatement ps = c.prepareStatement("INSERT INTO ticket_activity (ticket_id, actor_id, kind, message, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
                Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, ticketId);
            ps.setObject(2, actor == null ? null : actor.getId());
            ps.setString(3, kind);
            ps.setString(4, message);
            return ps;
        }, key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }

    private User activeUser(Long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
        if (!u.isActive()) throw ApiException.badRequest(u.getFullName() + " pasif bir hesap.");
        return u;
    }

    private User userOrNull(Long id) {
        return id == null ? null : users.findById(id).orElse(null);
    }

    private String userName(Long id) {
        User u = userOrNull(id);
        return u == null ? null : u.getFullName();
    }

    private static String truncate(String s, int n) {
        return s.length() > n ? s.substring(0, n - 3) + "..." : s;
    }

    private static Long id(Object raw) {
        if (raw == null || raw.toString().isBlank() || "null".equals(raw.toString())) return null;
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Geçersiz kimlik: " + raw);
        }
    }

    /** JDBC sürücüsü DATETIME'ı LocalDateTime ya da Timestamp olarak verebilir. */
    private static LocalDateTime ldt(Object o) {
        return o instanceof Timestamp ts ? ts.toLocalDateTime() : (LocalDateTime) o;
    }

    private static Long toLong(Object o) {
        return o == null ? null : ((Number) o).longValue();
    }

    private static LocalDateTime ts(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toLocalDateTime();
    }
}
