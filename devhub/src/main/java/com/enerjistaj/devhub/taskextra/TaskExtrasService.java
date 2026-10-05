package com.enerjistaj.devhub.taskextra;

import com.enerjistaj.devhub.entity.TaskStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Görev listesindeki her kartın ek bilgileri tek seferde (görev başına ayrı sorgu olmadan) okunur: etiketler, alt görev
 * ilerlemesi, dosya eki sayısı ve bitmemiş bağımlılıklar. Bağımlılık kuralı da buradadır.
 */
@Service
@RequiredArgsConstructor
public class TaskExtrasService {

    private final JdbcTemplate jdbc;

    /** Görev kartındaki ek bilgiler. openBlockerIds: bu görevin beklediği ve henüz tamamlanmamış görevler. */
    public record Extras(List<Long> labelIds, int subtasksDone, int subtasksTotal, int attachmentCount,
                         List<Long> blockerIds, List<Long> openBlockerIds, int blockingCount) {
        static final Extras EMPTY = new Extras(List.of(), 0, 0, 0, List.of(), List.of(), 0);
    }

    /** Görevlerin ek bilgileri; ids boşsa ya da null ise bütün görevler. */
    public Map<Long, Extras> extras(Collection<Long> ids) {
        String where = ids == null ? "" : " WHERE task_id IN (" + placeholders(ids.size()) + ")";
        Object[] args = ids == null ? new Object[0] : ids.toArray();
        if (ids != null && ids.isEmpty()) return Map.of();

        Map<Long, List<Long>> labels = new HashMap<>();
        jdbc.query("SELECT task_id, label_id FROM task_labels" + where, rs -> {
            labels.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getLong(2));
        }, args);

        Map<Long, int[]> subtasks = new HashMap<>();
        jdbc.query("SELECT task_id, SUM(done), COUNT(*) FROM task_subtasks" + where + " GROUP BY task_id", rs -> {
            subtasks.put(rs.getLong(1), new int[] { rs.getInt(2), rs.getInt(3) });
        }, args);

        Map<Long, Integer> files = new HashMap<>();
        jdbc.query("SELECT task_id, COUNT(*) FROM attachments" + (ids == null ? " WHERE task_id IS NOT NULL" : where) + " GROUP BY task_id",
            rs -> { files.put(rs.getLong(1), rs.getInt(2)); }, args);

        Map<Long, List<Long>> blockers = new HashMap<>();
        Map<Long, List<Long>> open = new HashMap<>();
        jdbc.query("SELECT d.task_id, d.blocked_by_id, b.status FROM task_dependencies d JOIN tasks b ON b.id = d.blocked_by_id"
            + (ids == null ? "" : " WHERE d.task_id IN (" + placeholders(ids.size()) + ")"), rs -> {
            long t = rs.getLong(1), b = rs.getLong(2);
            blockers.computeIfAbsent(t, k -> new ArrayList<>()).add(b);
            if (!TaskStatus.TAMAMLANDI.name().equals(rs.getString(3))) open.computeIfAbsent(t, k -> new ArrayList<>()).add(b);
        }, args);

        Map<Long, Integer> blocking = new HashMap<>();
        jdbc.query("SELECT blocked_by_id, COUNT(*) FROM task_dependencies"
            + (ids == null ? "" : " WHERE blocked_by_id IN (" + placeholders(ids.size()) + ")") + " GROUP BY blocked_by_id",
            rs -> { blocking.put(rs.getLong(1), rs.getInt(2)); }, args);

        Set<Long> all = new HashSet<>();
        if (ids != null) all.addAll(ids);
        all.addAll(labels.keySet());
        all.addAll(subtasks.keySet());
        all.addAll(files.keySet());
        all.addAll(blockers.keySet());
        all.addAll(blocking.keySet());
        Map<Long, Extras> out = new HashMap<>();
        for (Long id : all) {
            int[] st = subtasks.getOrDefault(id, new int[] { 0, 0 });
            out.put(id, new Extras(labels.getOrDefault(id, List.of()), st[0], st[1], files.getOrDefault(id, 0),
                blockers.getOrDefault(id, List.of()), open.getOrDefault(id, List.of()), blocking.getOrDefault(id, 0)));
        }
        return out;
    }

    public Extras extras(Long taskId) {
        return extras(List.of(taskId)).getOrDefault(taskId, Extras.EMPTY);
    }

    // ------------------------------------------------------------------ etiketler

    public List<Long> labelIds(Long taskId) {
        return jdbc.queryForList("SELECT label_id FROM task_labels WHERE task_id = ?", Long.class, taskId);
    }

    public void setLabels(Long taskId, Collection<Long> labelIds) {
        jdbc.update("DELETE FROM task_labels WHERE task_id = ?", taskId);
        for (Long l : new LinkedHashSet<>(labelIds)) jdbc.update("INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)", taskId, l);
    }

    // ------------------------------------------------------------------ bağımlılıklar

    /** Bu görevin beklediği, henüz tamamlanmamış görevler: [id, başlık]. */
    public List<Object[]> openBlockers(Long taskId) {
        return jdbc.query("SELECT b.id, b.content FROM task_dependencies d JOIN tasks b ON b.id = d.blocked_by_id "
            + "WHERE d.task_id = ? AND b.status <> 'TAMAMLANDI' ORDER BY b.id", (rs, i) -> new Object[] { rs.getLong(1), rs.getString(2) }, taskId);
    }

    /** Bu görevi bekleyen görevler (görev tamamlanınca kontrol edilir). */
    public List<Long> waitingOn(Long blockerId) {
        return jdbc.queryForList("SELECT task_id FROM task_dependencies WHERE blocked_by_id = ?", Long.class, blockerId);
    }

    public boolean exists(Long taskId, Long blockedById) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM task_dependencies WHERE task_id = ? AND blocked_by_id = ?", Integer.class, taskId, blockedById);
        return n != null && n > 0;
    }

    /**
     * Döngü denetimi: "task, blocker'ı bekler" eklenirse ve blocker zaten (dolaylı olarak) task'ı bekliyorsa ikisi de hiç başlayamaz.
     * blocker'dan başlayıp beklediği görevleri izler; task'a ulaşırsa döngü vardır.
     */
    public boolean wouldCycle(Long taskId, Long blockerId) {
        Deque<Long> stack = new ArrayDeque<>(List.of(blockerId));
        Set<Long> seen = new HashSet<>();
        while (!stack.isEmpty()) {
            Long cur = stack.pop();
            if (cur.equals(taskId)) return true;
            if (!seen.add(cur)) continue;
            stack.addAll(jdbc.queryForList("SELECT blocked_by_id FROM task_dependencies WHERE task_id = ?", Long.class, cur));
        }
        return false;
    }

    public void addDependency(Long taskId, Long blockerId, Long createdById) {
        jdbc.update("INSERT INTO task_dependencies (task_id, blocked_by_id, created_by_id, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
            taskId, blockerId, createdById);
    }

    public void removeDependency(Long taskId, Long blockerId) {
        jdbc.update("DELETE FROM task_dependencies WHERE task_id = ? AND blocked_by_id = ?", taskId, blockerId);
    }

    /** İki yöndeki bağımlılıklar: görevin bekledikleri ve onu bekleyenler (başlık, durum, atanan kişi ile). */
    public Map<String, List<Map<String, Object>>> dependencies(Long taskId) {
        String select = "SELECT t.id, t.content, t.status, t.user_id, u.full_name FROM task_dependencies d ";
        List<Map<String, Object>> blockedBy = jdbc.query(select + "JOIN tasks t ON t.id = d.blocked_by_id LEFT JOIN users u ON u.id = t.user_id WHERE d.task_id = ? ORDER BY t.id",
            (rs, i) -> ref(rs.getLong(1), rs.getString(2), rs.getString(3), (Long) rs.getObject(4, Long.class), rs.getString(5)), taskId);
        List<Map<String, Object>> blocking = jdbc.query(select + "JOIN tasks t ON t.id = d.task_id LEFT JOIN users u ON u.id = t.user_id WHERE d.blocked_by_id = ? ORDER BY t.id",
            (rs, i) -> ref(rs.getLong(1), rs.getString(2), rs.getString(3), (Long) rs.getObject(4, Long.class), rs.getString(5)), taskId);
        return Map.of("blockedBy", blockedBy, "blocking", blocking);
    }

    private static Map<String, Object> ref(long id, String content, String status, Long userId, String userName) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("content", content);
        m.put("status", status);
        m.put("userId", userId);
        m.put("userName", userName);
        return m;
    }

    private static String placeholders(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }
}
