package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.ActionLog;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActionLogRepository extends JpaRepository<ActionLog, Long> {
    @EntityGraph(attributePaths = "actor")
    List<ActionLog> findAllByOrderByCreatedAtDesc();
}
