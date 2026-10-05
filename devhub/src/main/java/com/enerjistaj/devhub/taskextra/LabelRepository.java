package com.enerjistaj.devhub.taskextra;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LabelRepository extends JpaRepository<Label, Long> {
    List<Label> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);
}
