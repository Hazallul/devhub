package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByName(String name);

    Optional<Project> findByName(String name);
}
