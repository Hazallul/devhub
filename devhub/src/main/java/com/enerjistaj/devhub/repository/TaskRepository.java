package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.Task;
import com.enerjistaj.devhub.entity.TaskStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    @EntityGraph(attributePaths = {"user", "project", "createdBy"})
    List<Task> findByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"user", "project", "createdBy"})
    List<Task> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "user")
    List<Task> findByStatusNotAndDueDateBetween(TaskStatus status, LocalDate from, LocalDate to);
}
