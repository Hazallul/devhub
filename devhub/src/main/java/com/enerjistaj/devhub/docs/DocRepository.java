package com.enerjistaj.devhub.docs;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DocRepository extends JpaRepository<Doc, Long> {
    @EntityGraph(attributePaths = {"createdBy", "updatedBy"})
    List<Doc> findAllByOrderBySortOrderAscIdAsc();

    @EntityGraph(attributePaths = {"createdBy", "updatedBy"})
    Optional<Doc> findBySlug(String slug);

    boolean existsBySlug(String slug);

    @Query("SELECT COALESCE(MAX(d.sortOrder), 0) FROM Doc d WHERE d.category = ?1")
    int maxSortOrder(String category);
}
