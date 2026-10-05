package com.enerjistaj.devhub.taskextra;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubtaskRepository extends JpaRepository<TaskSubtask, Long> {
    List<TaskSubtask> findByTaskIdOrderByPositionAscIdAsc(Long taskId);
}
