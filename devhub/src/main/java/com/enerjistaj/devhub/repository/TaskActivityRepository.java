package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.TaskActivity;
import com.enerjistaj.devhub.entity.TaskActivityKind;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskActivityRepository extends JpaRepository<TaskActivity, Long> {
    @EntityGraph(attributePaths = "actor")
    List<TaskActivity> findByTaskIdOrderByCreatedAtAscIdAsc(Long taskId);

    /** Görev başına yorum sayısı: [taskId, count] */
    @Query("select a.task.id, count(a) from TaskActivity a where a.kind = :kind group by a.task.id")
    List<Object[]> countByKindGroupedByTask(TaskActivityKind kind);

    long countByTaskIdAndKind(Long taskId, TaskActivityKind kind);
}
