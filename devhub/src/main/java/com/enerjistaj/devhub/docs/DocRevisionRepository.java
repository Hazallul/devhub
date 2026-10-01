package com.enerjistaj.devhub.docs;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocRevisionRepository extends JpaRepository<DocRevision, Long> {
    @EntityGraph(attributePaths = {"doc", "author", "decidedBy"})
    List<DocRevision> findByStatusOrderByCreatedAtAsc(DocRevisionStatus status);

    @EntityGraph(attributePaths = {"doc", "author", "decidedBy"})
    List<DocRevision> findTop30ByAuthorIdOrderByCreatedAtDesc(Long authorId);

    @EntityGraph(attributePaths = {"doc", "author", "decidedBy"})
    List<DocRevision> findByDocIdAndStatusOrderByDecidedAtDesc(Long docId, DocRevisionStatus status);

    List<DocRevision> findByDocIdAndAuthorIdAndStatus(Long docId, Long authorId, DocRevisionStatus status);

    long countByStatus(DocRevisionStatus status);

    long countByDocIdAndStatus(Long docId, DocRevisionStatus status);
}
