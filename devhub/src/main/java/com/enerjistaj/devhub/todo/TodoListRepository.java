package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/** Listeye erişim üyelik üzerinden denetlenir (TodoListMemberRepository). */
public interface TodoListRepository extends JpaRepository<TodoList, Long> {
    List<TodoList> findByUserIdOrderByPositionAscIdAsc(Long userId);

    Optional<TodoList> findByIdAndUserId(Long id, Long userId);

    /** Listeyi doğrudan veritabanından siler; kartlar ve üyelikler veritabanı kısıtıyla birlikte gider. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TodoList l where l.id = :id")
    void purge(Long id);

    @Query("select coalesce(max(l.position), -1) from TodoList l where l.user.id = :userId")
    int maxPosition(Long userId);
}
