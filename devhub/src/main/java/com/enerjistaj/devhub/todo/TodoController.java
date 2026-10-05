package com.enerjistaj.devhub.todo;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.TaskRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.service.TaskStatusService;
import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Kişisel alan: yapılacaklar. Her uç yalnızca oturumdaki kullanıcının görebildiği kayıtlarla çalışır:
 * "Genel"deki kendi kartları ve üyesi olduğu listeler. Bunların dışındaki bir kayıt istenirse
 * (uygulama yöneticisi bile olsa) "bulunamadı" döner, varlığı sızdırılmaz.
 * Liste oluşturan o listenin yöneticisidir; üye ekleyip çıkarabilir, başkasına da yöneticilik verebilir.
 * "Gönder" ise kartın bir kopyasını seçilen kişinin alanına bırakır.
 */
@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final ActionLogService actionLogService;
    private final TodoListRepository lists;
    private final TodoItemRepository items;
    private final TodoStepRepository steps;
    private final TodoCommentRepository comments;
    private final TodoStarRepository stars;
    private final TaskStatusService taskStatus;
    private final TodoListMemberRepository members;
    private final UserRepository users;
    private final TaskRepository tasks;
    private final CurrentUser currentUser;
    private final NotificationService notifications;

    public record StepDto(Long id, String title, boolean done, int position) {
        static StepDto from(TodoStep s) {
            return new StepDto(s.getId(), s.getTitle(), s.isDone(), s.getPosition());
        }
    }

    public record MemberDto(Long userId, String fullName, TodoListRole role) {
        static MemberDto from(TodoListMember m) {
            return new MemberDto(m.getUser().getId(), m.getUser().getFullName(), m.getRole());
        }
    }

    /** myRole: oturumdaki kişinin listedeki yetkisi; members birden fazlaysa liste ortaktır. */
    public record ListDto(Long id, String name, String color, int position, TodoListRole myRole, List<MemberDto> members) {}

    public record ItemDto(Long id, Long listId, String title, String note, boolean done, LocalDateTime doneAt, Long doneById, String doneByName, boolean important,
                          boolean myDay, LocalDate dueDate, String dueTime, TodoRepeat repeatRule, Long taskId, int position, Long sentById, String sentByName, String sentMessage,
                          boolean seen, Long ownerId, String ownerName, long commentCount, LocalDateTime createdAt, LocalDateTime updatedAt, List<StepDto> steps) {}

    public record CommentDto(Long id, Long userId, String userName, String body, LocalDateTime createdAt) {
        static CommentDto from(TodoComment c) {
            return new CommentDto(c.getId(), c.getUser().getId(), c.getUser().getFullName(), c.getBody(), c.getCreatedAt());
        }
    }

    public record Overview(List<ListDto> lists, List<ItemDto> items) {}

    // ---------------------------------------------------------------- okuma

    @GetMapping
    public ResponseEntity<Overview> all() {
        Long me = currentUser.get().getId();
        List<TodoItem> mine = items.findVisible(me);
        Map<Long, List<StepDto>> stepsByItem = mine.isEmpty() ? Map.of()
            : steps.findByItemIdInOrderByPositionAscIdAsc(mine.stream().map(TodoItem::getId).toList()).stream()
                .collect(Collectors.groupingBy(s -> s.getItem().getId(), Collectors.mapping(StepDto::from, Collectors.toList())));
        Map<Long, Long> commentCounts = mine.isEmpty() ? Map.of()
            : comments.countByItems(mine.stream().map(TodoItem::getId).toList()).stream().collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
        Set<Long> starred = stars.itemIdsByUser(me);
        List<TodoListMember> memberships = members.findByUserId(me);
        Map<Long, List<TodoListMember>> byList = memberships.isEmpty() ? Map.of()
            : members.findByListIdInOrderByJoinedAtAscIdAsc(memberships.stream().map(m -> m.getList().getId()).toList()).stream()
                .collect(Collectors.groupingBy(m -> m.getList().getId()));
        return ResponseEntity.ok(new Overview(
            memberships.stream()
                .sorted(Comparator.comparing((TodoListMember m) -> m.getList().getPosition()).thenComparing(m -> m.getList().getId()))
                .map(m -> listDto(m.getList(), m.getRole(), byList.getOrDefault(m.getList().getId(), List.of()))).toList(),
            mine.stream().map(i -> dto(i, stepsByItem.getOrDefault(i.getId(), List.of()), commentCounts.getOrDefault(i.getId(), 0L), starred.contains(i.getId()))).toList()));
    }

    /** Kenar çubuğundaki rozet: henüz açılmamış gelen kart sayısı. */
    @GetMapping("/unseen-count")
    public ResponseEntity<Map<String, Long>> unseen() {
        return ResponseEntity.ok(Map.of("count", items.countByUserIdAndSeenFalse(currentUser.get().getId())));
    }

    // ---------------------------------------------------------------- listeler

    @PostMapping("/lists")
    @Transactional
    public ResponseEntity<ListDto> createList(@RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        TodoList l = new TodoList();
        l.setUser(me);
        l.setName(Payloads.requiredText(body, "name", "Liste adı boş olamaz.", 80, "Liste adı"));
        l.setColor(Payloads.optionalText(body, "color", 9, "Renk"));
        l.setPosition(lists.maxPosition(me.getId()) + 1);
        TodoList saved = lists.save(l);
        TodoListMember m = new TodoListMember();
        m.setList(saved);
        m.setUser(me);
        m.setRole(TodoListRole.ADMIN);
        members.save(m);
        return ResponseEntity.ok(listDto(saved, TodoListRole.ADMIN, List.of(m)));
    }

    @PutMapping("/lists/{id}")
    public ResponseEntity<ListDto> updateList(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        TodoList l = adminList(id);
        if (body.containsKey("name")) l.setName(Payloads.requiredText(body, "name", "Liste adı boş olamaz.", 80, "Liste adı"));
        if (body.containsKey("color")) l.setColor(Payloads.optionalText(body, "color", 9, "Renk"));
        return ResponseEntity.ok(listDto(lists.save(l)));
    }

    /** Liste silinince içindeki kartlar ve üyelikler de silinir (veritabanı kısıtı). Yalnızca liste yöneticisi silebilir. */
    @DeleteMapping("/lists/{id}")
    @Transactional
    public ResponseEntity<Void> deleteList(@PathVariable Long id) {
        adminList(id);
        lists.purge(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- liste üyeleri

    /** Listeye kişi ekler (liste yöneticisi). Eklenen kişi listeyi ve içindeki tüm kartları görür. */
    @PostMapping("/lists/{id}/members")
    @Transactional
    public ResponseEntity<ListDto> addMembers(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        TodoList l = adminList(id);
        List<Long> userIds = ids(body.get("userIds"));
        if (userIds.isEmpty()) throw ApiException.badRequest("En az bir kişi seçin.");
        Set<Long> existing = members.findByListIdOrderByJoinedAtAscIdAsc(id).stream().map(m -> m.getUser().getId()).collect(Collectors.toSet());
        if (existing.size() + userIds.size() > 50) throw ApiException.badRequest("Bir listede en fazla 50 üye olabilir.");
        for (Long userId : userIds) {
            if (existing.contains(userId)) continue;
            User u = users.findById(userId).filter(User::isActive).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
            TodoListMember m = new TodoListMember();
            m.setList(l);
            m.setUser(u);
            members.save(m);
            notifications.notify(u, me, NotificationType.TODO_LIST_ADDED, me.getFullName() + " sizi bir listeye ekledi", l.getName(), "/todo?list=" + id);
        }
        return ResponseEntity.ok(listDto(l));
    }

    /** Üyenin yetkisini değiştirir (liste yöneticisi). Listede en az bir yönetici kalır. */
    @PutMapping("/lists/{id}/members/{userId}")
    @Transactional
    public ResponseEntity<ListDto> setMemberRole(@PathVariable Long id, @PathVariable Long userId, @RequestBody Map<String, Object> body) {
        TodoList l = adminList(id);
        TodoListRole role = Payloads.enumValue(body, "role", TodoListRole.class, "yetki");
        if (role == null) throw ApiException.badRequest("Yetki seçin.");
        TodoListMember m = members.findByListIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Üye"));
        if (m.getRole() == TodoListRole.ADMIN && role != TodoListRole.ADMIN && members.countByListIdAndRole(id, TodoListRole.ADMIN) <= 1) {
            throw ApiException.badRequest("Listede en az bir yönetici kalmalı.");
        }
        m.setRole(role);
        members.save(m);
        return ResponseEntity.ok(listDto(l));
    }

    /** Üyeyi çıkarır (liste yöneticisi) ya da kişi kendisi listeden ayrılır. Eklediği kartlar listede kalır. */
    @DeleteMapping("/lists/{id}/members/{userId}")
    @Transactional
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        Long me = currentUser.get().getId();
        boolean self = userId.equals(me);
        if (self) ownList(id); else adminList(id);
        TodoListMember m = members.findByListIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Üye"));
        List<TodoListMember> all = members.findByListIdOrderByJoinedAtAscIdAsc(id);
        if (all.size() == 1) throw ApiException.badRequest("Listenin tek üyesisiniz; ayrılmak yerine listeyi silebilirsiniz.");
        if (m.getRole() == TodoListRole.ADMIN && all.stream().filter(x -> x.getRole() == TodoListRole.ADMIN).count() <= 1) {
            throw ApiException.badRequest("Listenin tek yöneticisisiniz; önce başka bir üyeyi yönetici yapın.");
        }
        members.delete(m);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- kartlar

    @PostMapping("/items")
    @Transactional
    public ResponseEntity<ItemDto> createItem(@RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        TodoItem i = new TodoItem();
        i.setUser(me);
        i.setTitle(Payloads.requiredText(body, "title", "Başlık boş olamaz.", 300, "Başlık"));
        i.setNote(Payloads.optionalText(body, "note", 4000, "Not"));
        i.setDueDate(dueDate(body));
        i.setDueTime(time(body));
        i.setRepeatRule(Payloads.enumValue(body, "repeatRule", TodoRepeat.class, "tekrar"));
        boolean important = Payloads.flag(body, "important");
        if (Payloads.flag(body, "myDay")) i.setMyDay(today());
        Long taskId = id(body.get("taskId"));
        if (taskId != null) {
            // Yalnızca kişinin kendi görevi plana eklenebilir; başkasının görevi "yok" sayılır.
            tasks.findById(taskId).filter(t -> t.getUser() != null && t.getUser().getId().equals(me.getId())).orElseThrow(() -> ApiException.notFound("Görev"));
            i.setTaskId(taskId);
        }
        schedule(i);
        Long listId = id(body.get("listId"));
        if (listId != null) i.setList(ownList(listId));
        i.setPosition((listId != null ? items.minPositionInList(listId) : items.minPosition(me.getId())) - 1); // yeni kart en üstte
        TodoItem created = items.save(i);
        if (important) stars.save(new TodoStar(created.getId(), me.getId()));
        return ResponseEntity.ok(dto(created, List.of(), 0, important));
    }

    /** Kısmi güncelleme: yalnızca gövdede gelen alanlar değişir. */
    @PutMapping("/items/{id}")
    @Transactional
    public ResponseEntity<ItemDto> updateItem(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        TodoItem i = ownItem(id);
        if (body.containsKey("title")) i.setTitle(Payloads.requiredText(body, "title", "Başlık boş olamaz.", 300, "Başlık"));
        if (body.containsKey("note")) i.setNote(Payloads.optionalText(body, "note", 4000, "Not"));
        boolean rescheduled = body.containsKey("dueDate") || body.containsKey("dueTime") || body.containsKey("repeatRule");
        if (body.containsKey("dueDate")) i.setDueDate(dueDate(body));
        if (body.containsKey("dueTime")) i.setDueTime(time(body));
        if (body.containsKey("repeatRule")) {
            i.setRepeatRule(Payloads.enumValue(body, "repeatRule", TodoRepeat.class, "tekrar"));
            if (i.getRepeatRule() != null && i.getDueDate() == null) i.setDueDate(today()); // tekrar bir tarihten başlar
        }
        if (rescheduled) schedule(i);
        Long me = currentUser.get().getId();
        if (body.containsKey("important")) {
            // Yıldız kişiye özeldir: ortak listede yalnızca işaretleyenin "Önemli" görünümüne girer.
            boolean want = Payloads.flag(body, "important");
            boolean has = stars.existsByItemIdAndUserId(id, me);
            if (want && !has) stars.save(new TodoStar(id, me));
            if (!want && has) stars.remove(id, me);
        }
        if (body.containsKey("myDay")) i.setMyDay(Payloads.flag(body, "myDay") ? today() : null);
        if (body.containsKey("seen")) i.setSeen(Payloads.flag(body, "seen"));
        if (body.containsKey("done")) {
            boolean done = Payloads.flag(body, "done");
            if (done != i.isDone()) {
                i.setDone(done);
                i.setDoneAt(done ? LocalDateTime.now() : null);
                i.setDoneBy(done ? currentUser.get() : null);
                if (done && i.getRepeatRule() != null) repeat(i);
                if (!done && i.getRepeatCopyId() != null) undoRepeat(i);
                if (done && i.getTaskId() != null) completeLinkedTask(i);
            }
        }
        if (body.containsKey("listId")) {
            Long listId = id(body.get("listId"));
            i.setList(listId == null ? null : ownList(listId));
            // "Genel" kişiye özeldir: ortak listeden oraya taşınan kart, taşıyan kişinin olur.
            if (listId == null) i.setUser(currentUser.get());
        }
        i.setUpdatedAt(LocalDateTime.now());
        TodoItem saved = items.save(i);
        return ResponseEntity.ok(dto(saved, stepsOf(saved.getId()), comments.countByItemId(saved.getId()), stars.existsByItemIdAndUserId(id, me)));
    }

    /** Sürükle-bırak sırası: ids dizisindeki sıraya göre konum verir. */
    @PutMapping("/items/reorder")
    @Transactional
    public ResponseEntity<Void> reorder(@RequestBody Map<String, Object> body) {
        Long me = currentUser.get().getId();
        List<Long> ids = ids(body.get("ids"));
        Map<Long, TodoItem> byId = items.findVisibleByIdIn(me, ids).stream().collect(Collectors.toMap(TodoItem::getId, x -> x));
        int pos = 0;
        for (Long itemId : ids) {
            TodoItem i = byId.get(itemId);
            if (i != null) i.setPosition(pos++);
        }
        items.saveAll(byId.values());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        TodoItem i = ownItem(id);
        if (!canDelete(i)) throw ApiException.forbidden("Bu kartı yalnızca ekleyen kişi veya liste yöneticisi silebilir.");
        items.delete(i);
        return ResponseEntity.noContent().build();
    }

    /** Tamamlananları temizle: kişinin silebildiği (kendi eklediği ya da yöneticisi olduğu listedeki), tamamlanmış ve listelenen kartlar silinir. */
    @DeleteMapping("/items")
    @Transactional
    public ResponseEntity<Map<String, Integer>> deleteCompleted(@RequestParam List<Long> ids) {
        Long me = currentUser.get().getId();
        List<TodoItem> found = items.findVisibleByIdIn(me, ids).stream().filter(TodoItem::isDone).filter(this::canDelete).toList();
        items.deleteAll(found);
        return ResponseEntity.ok(Map.of("deleted", found.size()));
    }

    // ---------------------------------------------------------------- adımlar

    @PostMapping("/items/{id}/steps")
    public ResponseEntity<StepDto> addStep(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        TodoItem i = ownItem(id);
        List<TodoStep> existing = steps.findByItemIdOrderByPositionAscIdAsc(id);
        if (existing.size() >= 50) throw ApiException.badRequest("Bir karta en fazla 50 adım eklenebilir.");
        TodoStep s = new TodoStep();
        s.setItem(i);
        s.setTitle(Payloads.requiredText(body, "title", "Adım boş olamaz.", 300, "Adım"));
        s.setPosition(existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getPosition() + 1);
        return ResponseEntity.ok(StepDto.from(steps.save(s)));
    }

    @PutMapping("/steps/{id}")
    public ResponseEntity<StepDto> updateStep(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        TodoStep s = ownStep(id);
        if (body.containsKey("title")) s.setTitle(Payloads.requiredText(body, "title", "Adım boş olamaz.", 300, "Adım"));
        if (body.containsKey("done")) s.setDone(Payloads.flag(body, "done"));
        return ResponseEntity.ok(StepDto.from(steps.save(s)));
    }

    @DeleteMapping("/steps/{id}")
    public ResponseEntity<Void> deleteStep(@PathVariable Long id) {
        steps.delete(ownStep(id));
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- yorumlar

    @GetMapping("/items/{id}/comments")
    public ResponseEntity<List<CommentDto>> comments(@PathVariable Long id) {
        ownItem(id);
        return ResponseEntity.ok(comments.findByItemIdOrderByCreatedAtAscIdAsc(id).stream().map(CommentDto::from).toList());
    }

    /** Yorum ekler; kart ortak bir listedeyse diğer üyelere bildirim gider. */
    @PostMapping("/items/{id}/comments")
    @Transactional
    public ResponseEntity<CommentDto> addComment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        TodoItem i = ownItem(id);
        TodoComment c = new TodoComment();
        c.setItem(i);
        c.setUser(me);
        c.setBody(Payloads.requiredText(body, "body", "Yorum boş olamaz.", 1000, "Yorum"));
        TodoComment saved = comments.save(c);
        if (i.getList() != null) {
            members.findByListIdOrderByJoinedAtAscIdAsc(i.getList().getId()).forEach(m -> notifications.notify(m.getUser(), me,
                NotificationType.TODO_COMMENT, me.getFullName() + " bir karta yorum yazdı", i.getTitle() + " — " + saved.getBody(), "/todo?item=" + id));
        }
        return ResponseEntity.ok(CommentDto.from(saved));
    }

    /** Kişi yalnızca kendi yorumunu silebilir. */
    @DeleteMapping("/comments/{id}")
    @Transactional
    public ResponseEntity<Void> deleteComment(@PathVariable Long id) {
        TodoComment c = comments.findById(id).orElseThrow(() -> ApiException.notFound("Yorum"));
        ownItem(c.getItem().getId());
        if (!c.getUser().getId().equals(currentUser.get().getId())) throw ApiException.forbidden("Yalnızca kendi yorumunuzu silebilirsiniz.");
        comments.delete(c);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- gönderme

    /**
     * Kartın bir kopyasını (başlık, not, tarih, tamamlanmamış hâliyle adımlar) seçilen kişilerin "Genel" listesine bırakır.
     * Gönderenin kartı yerinde kalır; alıcı kopyayı dilediği gibi değiştirebilir.
     */
    @PostMapping("/items/{id}/send")
    @Transactional
    public ResponseEntity<Map<String, Object>> send(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        TodoItem source = ownItem(id);
        List<Long> recipientIds = ids(body.get("userIds"));
        if (recipientIds.isEmpty()) throw ApiException.badRequest("En az bir kişi seçin.");
        if (recipientIds.size() > 30) throw ApiException.badRequest("Bir kart tek seferde en fazla 30 kişiye gönderilebilir.");
        String message = Payloads.optionalText(body, "message", 500, "Mesaj");
        List<TodoStep> sourceSteps = steps.findByItemIdOrderByPositionAscIdAsc(id);

        List<String> names = new ArrayList<>();
        for (Long userId : recipientIds) {
            if (userId.equals(me.getId())) throw ApiException.badRequest("Kartı kendinize gönderemezsiniz.");
            User to = users.findById(userId).filter(User::isActive).orElseThrow(() -> ApiException.notFound("Kullanıcı"));

            TodoItem copy = new TodoItem();
            copy.setUser(to);
            copy.setTitle(source.getTitle());
            copy.setNote(source.getNote());
            copy.setDueDate(source.getDueDate());
            copy.setDueTime(source.getDueTime());
            schedule(copy);
            copy.setSentBy(me);
            copy.setSentMessage(message);
            copy.setSeen(false);
            copy.setPosition(items.minPosition(to.getId()) - 1);
            TodoItem saved = items.save(copy);
            for (TodoStep s : sourceSteps) {
                TodoStep c = new TodoStep();
                c.setItem(saved);
                c.setTitle(s.getTitle());
                c.setPosition(s.getPosition());
                steps.save(c);
            }
            notifications.notify(to, me, NotificationType.TODO_RECEIVED, me.getFullName() + " size bir yapılacak gönderdi",
                message != null ? source.getTitle() + " — " + message : source.getTitle(), "/todo?item=" + saved.getId());
            names.add(to.getFullName());
        }
        return ResponseEntity.ok(Map.of("sent", names.size(), "names", names));
    }

    // ---------------------------------------------------------------- yardımcılar

    /** Tarih/saat tutarlılığı: tarihsiz kartın saati ve tekrarı olmaz; zamanı geçmiş bir saat için hatırlatma gönderilmez. */
    private static void schedule(TodoItem i) {
        if (i.getDueDate() == null) {
            i.setDueTime(null);
            i.setRepeatRule(null);
        }
        i.setReminded(i.getDueTime() != null && !i.getDueDate().atTime(i.getDueTime()).isAfter(LocalDateTime.now(ActionLogService.ZONE)));
    }

    /**
     * Tekrarlayan kart tamamlandı: aynı kartın (adımları sıfırlanmış) bir kopyası sonraki tarihe açılır.
     * Tekrar kuralı kopyaya geçer; tamamlanan kart sıradan bir tamamlanmış kart olur (geri alınırsa ikinci kopya açılmaz).
     */
    private void repeat(TodoItem i) {
        TodoRepeat rule = i.getRepeatRule();
        TodoItem next = new TodoItem();
        next.setUser(i.getUser());
        next.setList(i.getList());
        next.setTitle(i.getTitle());
        next.setNote(i.getNote());
        next.setDueDate(rule.next(i.getDueDate() != null ? i.getDueDate() : today(), today()));
        next.setDueTime(i.getDueTime());
        next.setRepeatRule(rule);
        next.setPosition(i.getPosition());
        schedule(next);
        TodoItem saved = items.save(next);
        stars.findByItemId(i.getId()).forEach(s -> stars.save(new TodoStar(saved.getId(), s.getUserId())));
        for (TodoStep s : steps.findByItemIdOrderByPositionAscIdAsc(i.getId())) {
            TodoStep c = new TodoStep();
            c.setItem(saved);
            c.setTitle(s.getTitle());
            c.setPosition(s.getPosition());
            steps.save(c);
        }
        i.setRepeatRule(null);
        i.setRepeatCopyId(saved.getId());
    }

    /**
     * Tekrarlayan kartın tamamlanması geri alındı: açılan kopyaya hiç dokunulmadıysa (tamamlanmamış, düzenlenmemiş) silinir ve
     * tekrar kuralı asıl karta döner. Kopya düzenlendiyse ya da tamamlandıysa kişinin emeği kaybolmasın diye olduğu gibi kalır.
     */
    private void undoRepeat(TodoItem i) {
        Long copyId = i.getRepeatCopyId();
        i.setRepeatCopyId(null);
        TodoItem copy = items.findById(copyId).orElse(null);
        if (copy == null || copy.isDone() || copy.getUpdatedAt().isAfter(copy.getCreatedAt().plusSeconds(2))) return;
        i.setRepeatRule(copy.getRepeatRule());
        steps.deleteAll(steps.findByItemIdOrderByPositionAscIdAsc(copyId));
        stars.findByItemId(copyId).forEach(s -> stars.remove(copyId, s.getUserId()));
        comments.deleteAll(comments.findByItemIdOrderByCreatedAtAscIdAsc(copyId));
        items.delete(copy);
    }

    /**
     * Kart bir DevHub görevine bağlıysa kart tamamlanınca görev de tamamlanır (görev sayfasındaki kuralla aynı: geçmiş kaydı
     * ve atayana bildirim). Yalnızca görevin sahibi ya da uygulama yöneticisi tetikler; ortak listede başka bir üye kartı
     * tamamlarsa görev olduğu gibi kalır.
     */
    private void completeLinkedTask(TodoItem i) {
        User me = currentUser.get();
        Task t = tasks.findById(i.getTaskId()).orElse(null);
        if (t == null || t.getStatus() == TaskStatus.TAMAMLANDI) return;
        if ((t.getUser() == null || !t.getUser().getId().equals(me.getId())) && !CurrentUser.isAdmin(me)) return;
        String before = TaskStatusService.STATUS_LABEL.get(t.getStatus());
        taskStatus.change(t, TaskStatus.TAMAMLANDI, me);
        tasks.save(t);
        // Kartın kendisi kişiye özeldir ve loglanmaz; yalnızca etkilediği DevHub görevi kayda geçer.
        actionLogService.record(LogCategory.GOREV, LogAction.TAMAMLAMA, "Görev tamamlandı: " + t.getContent()).by(me)
                .target("GOREV", t.getId(), t.getContent()).change("Durum", before, "Tamamlandı")
                .detail("Kişisel plandaki bağlı kart tamamlanınca").save();
    }

    /** Listesiz kart ve kendi eklediği kart her zaman; ortak listede başkasının kartını yalnızca liste yöneticisi siler. */
    private boolean canDelete(TodoItem i) {
        Long me = currentUser.get().getId();
        if (i.getList() == null || i.getUser().getId().equals(me)) return true;
        return members.findByListIdAndUserId(i.getList().getId(), me).map(m -> m.getRole() == TodoListRole.ADMIN).orElse(false);
    }

    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    /** Yanlış yazılmış yıllar (ör. 0202, 20026) plana ve tekrar hesabına girmesin. */
    private static LocalDate dueDate(Map<String, Object> body) {
        LocalDate d = Payloads.date(body, "dueDate", "Tarih");
        if (d != null && (d.getYear() < 2000 || d.isAfter(today().plusYears(10)))) throw ApiException.badRequest("Tarih 2000 yılı ile 10 yıl sonrası arasında olmalı.");
        return d;
    }

    private static LocalTime time(Map<String, Object> body) {
        String s = Payloads.text(body, "dueTime");
        if (s == null) return null;
        try {
            return LocalTime.parse(s).withSecond(0).withNano(0);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("Saat geçerli olmalı (ss:dd).");
        }
    }

    private TodoItem ownItem(Long id) {
        return items.findVisibleById(id, currentUser.get().getId()).orElseThrow(() -> ApiException.notFound("Kart"));
    }

    private TodoListMember membership(Long listId) {
        return members.findByListIdAndUserId(listId, currentUser.get().getId()).orElseThrow(() -> ApiException.notFound("Liste"));
    }

    /** Kişinin üyesi olduğu liste (kart eklemek/taşımak için üyelik yeter). */
    private TodoList ownList(Long id) {
        return membership(id).getList();
    }

    /** Listeyi yönetme işlemleri (ad, renk, silme, üyeler) liste yöneticisine açıktır. */
    private TodoList adminList(Long id) {
        TodoListMember m = membership(id);
        if (m.getRole() != TodoListRole.ADMIN) throw ApiException.forbidden("Bu işlem için liste yöneticisi olmalısınız.");
        return m.getList();
    }

    private ListDto listDto(TodoList l) {
        List<TodoListMember> all = members.findByListIdOrderByJoinedAtAscIdAsc(l.getId());
        Long me = currentUser.get().getId();
        TodoListRole mine = all.stream().filter(m -> m.getUser().getId().equals(me)).map(TodoListMember::getRole).findFirst().orElse(TodoListRole.MEMBER);
        return listDto(l, mine, all);
    }

    private static ListDto listDto(TodoList l, TodoListRole myRole, List<TodoListMember> all) {
        return new ListDto(l.getId(), l.getName(), l.getColor(), l.getPosition(), myRole, all.stream().map(MemberDto::from).toList());
    }

    private TodoStep ownStep(Long id) {
        TodoStep s = steps.findById(id).orElseThrow(() -> ApiException.notFound("Adım"));
        ownItem(s.getItem().getId()); // adım, kartı görebilen kişiye açıktır
        return s;
    }

    private List<StepDto> stepsOf(Long itemId) {
        return steps.findByItemIdOrderByPositionAscIdAsc(itemId).stream().map(StepDto::from).toList();
    }

    private static ItemDto dto(TodoItem i, List<StepDto> stepDtos, long commentCount, boolean important) {
        return new ItemDto(i.getId(), i.getList() != null ? i.getList().getId() : null, i.getTitle(), i.getNote(), i.isDone(), i.getDoneAt(),
            i.getDoneBy() != null ? i.getDoneBy().getId() : null, i.getDoneBy() != null ? i.getDoneBy().getFullName() : null,
            important, today().equals(i.getMyDay()), i.getDueDate(), i.getDueTime() != null ? i.getDueTime().format(HM) : null,
            i.getRepeatRule(), i.getTaskId(), i.getPosition(),
            i.getSentBy() != null ? i.getSentBy().getId() : null, i.getSentBy() != null ? i.getSentBy().getFullName() : null,
            i.getSentMessage(), i.isSeen(), i.getUser().getId(), i.getUser().getFullName(), commentCount, i.getCreatedAt(), i.getUpdatedAt(), stepDtos);
    }

    /** "Bugün" kullanıcının saat dilimine göredir (sunucu UTC çalışır). */
    private static LocalDate today() {
        return LocalDate.now(ActionLogService.ZONE);
    }

    private static Long id(Object raw) {
        if (raw == null || raw.toString().isBlank()) return null;
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Geçersiz kimlik: " + raw);
        }
    }

    private static List<Long> ids(Object raw) {
        if (!(raw instanceof Collection<?> c)) return List.of();
        return c.stream().map(TodoController::id).filter(Objects::nonNull).distinct().toList();
    }
}
