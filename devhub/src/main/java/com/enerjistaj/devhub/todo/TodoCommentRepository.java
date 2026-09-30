package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface TodoCommentRepository extends JpaRepository<TodoComment, Long> {
    @EntityGraph(attributePaths = {"user"})
    List<TodoComment> findByItemIdOrderByCreatedAtAscIdAsc(Long itemId);

    /** Kart başına yorum sayısı: [itemId, adet] */
    @Query("select c.item.id, count(c) from TodoComment c where c.item.id in :itemIds group by c.item.id")
    List<Object[]> countByItems(Collection<Long> itemIds);

    long countByItemId(Long itemId);
}
