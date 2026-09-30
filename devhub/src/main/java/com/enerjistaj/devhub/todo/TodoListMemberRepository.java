package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TodoListMemberRepository extends JpaRepository<TodoListMember, Long> {
    /** Kişinin üyesi olduğu listeler (kendi oluşturdukları dahil). */
    @EntityGraph(attributePaths = {"list"})
    List<TodoListMember> findByUserId(Long userId);

    @EntityGraph(attributePaths = {"user"})
    List<TodoListMember> findByListIdInOrderByJoinedAtAscIdAsc(Collection<Long> listIds);

    @EntityGraph(attributePaths = {"user"})
    List<TodoListMember> findByListIdOrderByJoinedAtAscIdAsc(Long listId);

    @EntityGraph(attributePaths = {"list"})
    Optional<TodoListMember> findByListIdAndUserId(Long listId, Long userId);

    long countByListIdAndRole(Long listId, TodoListRole role);
}
