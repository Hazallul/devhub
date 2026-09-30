package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Set;

public interface TodoStarRepository extends JpaRepository<TodoStar, Long> {
    @Query("select s.itemId from TodoStar s where s.userId = :userId")
    Set<Long> itemIdsByUser(Long userId);

    boolean existsByItemIdAndUserId(Long itemId, Long userId);

    List<TodoStar> findByItemId(Long itemId);

    @Modifying
    @Query("delete from TodoStar s where s.itemId = :itemId and s.userId = :userId")
    void remove(Long itemId, Long userId);
}
