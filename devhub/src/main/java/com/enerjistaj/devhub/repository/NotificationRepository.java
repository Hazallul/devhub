package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    @EntityGraph(attributePaths = "actor")
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUserIdAndReadAtIsNull(Long userId);

    boolean existsByUserIdAndRefKey(Long userId, String refKey);

    @Modifying
    @Query("update Notification n set n.readAt = :now where n.user.id = :userId and n.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("now") LocalDateTime now);
}
