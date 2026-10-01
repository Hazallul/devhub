package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.ActionLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ActionLogRepository extends JpaRepository<ActionLog, Long>, JpaSpecificationExecutor<ActionLog> {
    @EntityGraph(attributePaths = "actor")
    List<ActionLog> findTop200ByOrderByCreatedAtDescIdDesc();

    @EntityGraph(attributePaths = "actor")
    List<ActionLog> findByCreatedAtGreaterThanEqual(LocalDateTime from);

    @Override
    @EntityGraph(attributePaths = "actor")
    Page<ActionLog> findAll(Specification<ActionLog> spec, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "actor")
    List<ActionLog> findAll(Specification<ActionLog> spec, org.springframework.data.domain.Sort sort);
}
