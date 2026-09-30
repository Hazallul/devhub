package com.enerjistaj.devhub.todo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TodoStepRepository extends JpaRepository<TodoStep, Long> {
    List<TodoStep> findByItemIdInOrderByPositionAscIdAsc(Collection<Long> itemIds);

    List<TodoStep> findByItemIdOrderByPositionAscIdAsc(Long itemId);
}
