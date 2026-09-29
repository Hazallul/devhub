package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByName(String name);
}
