package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.ActionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActionLogRepository extends JpaRepository<ActionLog, Long> {
    List<ActionLog> findAllByOrderByCreatedAtDesc();
}
