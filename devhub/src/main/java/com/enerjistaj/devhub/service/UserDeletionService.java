package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pasif bir hesabı kalıcı olarak siler. Kişiye ait görevler (geçmiş ve yorumlarıyla), izin kayıtları, bildirimler,
 * profil talepleri ve kişisel yapılacaklar veritabanı kısıtlarıyla birlikte silinir.
 * Başkalarını etkileyen kayıtlar korunur: kişinin oluşturduğu ortak listeler ve bu listelerdeki kartları kalan bir üyeye,
 * yazdığı duyurular silmeyi yapan yöneticiye devredilir; loglarda kişinin adı hedef olarak kalır (yapan alanı boşalır).
 */
@Service
@RequiredArgsConstructor
public class UserDeletionService {

    private final EntityManager em;

    /** Silmeden önce gösterilecek etki: kaç kayıt silinecek / devredilecek. */
    public Map<String, Long> impact(User user) {
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("tasks", count("SELECT COUNT(*) FROM tasks WHERE user_id = ?1", user.getId()));
        m.put("leaves", count("SELECT COUNT(*) FROM leave_requests WHERE user_id = ?1", user.getId()));
        m.put("comments", count("SELECT COUNT(*) FROM task_activity WHERE actor_id = ?1 AND kind = 'COMMENT'", user.getId()));
        m.put("todos", count("SELECT COUNT(*) FROM todo_items i WHERE i.user_id = ?1 AND (i.list_id IS NULL OR NOT EXISTS ("
            + "SELECT 1 FROM todo_list_members m WHERE m.list_id = i.list_id AND m.user_id <> ?1))", user.getId()));
        m.put("sharedListsTransferred", count("SELECT COUNT(*) FROM todo_lists l WHERE l.user_id = ?1 AND EXISTS ("
            + "SELECT 1 FROM todo_list_members m WHERE m.list_id = l.id AND m.user_id <> ?1)", user.getId()));
        m.put("announcements", count("SELECT COUNT(*) FROM announcements WHERE author_id = ?1", user.getId()));
        return m;
    }

    @Transactional
    public void delete(User user, User actor) {
        Long id = user.getId();
        // Ortak listeler: listenin sahibi, kalan üyelerden en eski yöneticiye (yoksa en eski üyeye) geçer;
        // listede yönetici kalmadıysa o kişi yönetici olur. Kişinin bu listelerdeki kartları da ona devredilir.
        em.createNativeQuery("""
            UPDATE todo_lists l SET l.user_id = (
              SELECT m.user_id FROM todo_list_members m WHERE m.list_id = l.id AND m.user_id <> ?1
              ORDER BY m.role = 'ADMIN' DESC, m.joined_at, m.id LIMIT 1)
            WHERE l.user_id = ?1 AND EXISTS (SELECT 1 FROM todo_list_members m WHERE m.list_id = l.id AND m.user_id <> ?1)
            """).setParameter(1, id).executeUpdate();
        em.createNativeQuery("""
            UPDATE todo_list_members m JOIN todo_lists l ON l.id = m.list_id SET m.role = 'ADMIN'
            WHERE m.user_id = l.user_id AND l.user_id <> ?1 AND m.list_id IN (SELECT list_id FROM (
              SELECT x.list_id FROM todo_list_members x WHERE x.user_id = ?1) t)
              AND NOT EXISTS (SELECT 1 FROM (SELECT list_id, user_id, role FROM todo_list_members) y
                              WHERE y.list_id = m.list_id AND y.user_id <> ?1 AND y.role = 'ADMIN')
            """).setParameter(1, id).executeUpdate();
        em.createNativeQuery("""
            UPDATE todo_items i JOIN todo_lists l ON l.id = i.list_id SET i.user_id = l.user_id
            WHERE i.user_id = ?1 AND l.user_id <> ?1
            """).setParameter(1, id).executeUpdate();
        // Bekleyen doküman önerileri kişiyle birlikte gider; yayınlanmış sürümler geçmişte (yazarsız) kalır.
        em.createNativeQuery("DELETE FROM doc_revisions WHERE author_id = ?1 AND status = 'BEKLIYOR'").setParameter(1, id).executeUpdate();
        // Duyurular silinmez, silmeyi yapan yöneticiye geçer.
        em.createNativeQuery("UPDATE announcements SET author_id = ?2 WHERE author_id = ?1")
            .setParameter(1, id).setParameter(2, actor.getId()).executeUpdate();
        // Geri kalanı (görevler, izinler, bildirimler, talepler, kişisel kartlar, bağlantılar) kısıtlarla birlikte gider.
        em.flush();
        em.clear();
        em.createNativeQuery("DELETE FROM users WHERE id = ?1").setParameter(1, id).executeUpdate();
    }

    private long count(String sql, Long id) {
        return ((Number) em.createNativeQuery(sql).setParameter(1, id).getSingleResult()).longValue();
    }
}
