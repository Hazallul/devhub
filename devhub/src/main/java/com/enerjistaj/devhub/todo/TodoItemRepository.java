package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Kişinin görebildiği kartlar: "Genel"deki (listesiz) kendi kartları ve üyesi olduğu listelerdeki kartlar.
 * Tüm sorgular buna göre süzülür; başkasının özel kartı hiçbir zaman dönmez.
 */
public interface TodoItemRepository extends JpaRepository<TodoItem, Long> {
    @EntityGraph(attributePaths = {"list", "sentBy", "user", "doneBy"})
    @Query("select i from TodoItem i where ((i.list is null and i.user.id = :me) or i.list.id in (select m.list.id from TodoListMember m where m.user.id = :me)) order by i.position asc, i.id desc")
    List<TodoItem> findVisible(Long me);

    @EntityGraph(attributePaths = {"list", "sentBy", "user", "doneBy"})
    @Query("select i from TodoItem i where i.id = :id and ((i.list is null and i.user.id = :me) or i.list.id in (select m.list.id from TodoListMember m where m.user.id = :me))")
    Optional<TodoItem> findVisibleById(Long id, Long me);

    @Query("select i from TodoItem i where i.id in :ids and ((i.list is null and i.user.id = :me) or i.list.id in (select m.list.id from TodoListMember m where m.user.id = :me))")
    List<TodoItem> findVisibleByIdIn(Long me, Collection<Long> ids);

    @Query("select coalesce(min(i.position), 1) from TodoItem i where i.list.id = :listId")
    int minPositionInList(Long listId);

    List<TodoItem> findByUserIdAndDoneTrue(Long userId);

    @Query("select coalesce(min(i.position), 1) from TodoItem i where i.user.id = :userId")
    int minPosition(Long userId);

    long countByUserIdAndSeenFalse(Long userId);

    /** Bir DevHub görevine bağlı açık kartlar (görev tamamlanınca onlar da tamamlanır). */
    List<TodoItem> findByTaskIdAndDoneFalse(Long taskId);

    /** Saati verilmiş, henüz hatırlatılmamış açık kartlar (saat karşılaştırması çağıranda yapılır). */
    @EntityGraph(attributePaths = {"user", "list"})
    @Query("select i from TodoItem i where i.done = false and i.reminded = false and i.dueTime is not null and i.dueDate <= :today")
    List<TodoItem> findDueReminders(LocalDate today);
}
