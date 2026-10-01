package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.TaskWorkSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskWorkSessionRepository extends JpaRepository<TaskWorkSession, Long> {

    List<TaskWorkSession> findByTaskIdAndEndedAtIsNull(Long taskId);

    Optional<TaskWorkSession> findFirstByTaskIdOrderByStartedAtDescIdDesc(Long taskId);

    List<TaskWorkSession> findByTaskIdOrderByStartedAtAscIdAsc(Long taskId);

    List<TaskWorkSession> findByTaskIdIn(Collection<Long> taskIds);

    List<TaskWorkSession> findByUserIdAndEndedAtIsNull(Long userId);

    /** [from, to) aralığına değen oturumlar (açık olanlar dahil) */
    @Query("select s from TaskWorkSession s where s.startedAt < :to and (s.endedAt is null or s.endedAt > :from)")
    List<TaskWorkSession> findOverlapping(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
