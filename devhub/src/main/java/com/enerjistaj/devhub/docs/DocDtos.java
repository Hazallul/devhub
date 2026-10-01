package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.entity.User;
import com.fasterxml.jackson.annotation.JsonRawValue;

import java.time.LocalDateTime;
import java.util.List;

/** Dokümantasyon API'sinin yanıtları. content alanları editörün JSON'udur ve olduğu gibi gönderilir. */
public final class DocDtos {

    private DocDtos() {}

    /** Liste: içerik yok, arama için düz metin var. */
    public record DocSummary(Long id, String slug, String title, String summary, String category, List<String> tags, int sortOrder,
                             int version, String plainText, Long createdById, String createdByName, Long updatedById, String updatedByName,
                             LocalDateTime createdAt, LocalDateTime updatedAt) {
        static DocSummary from(Doc d) {
            return new DocSummary(d.getId(), d.getSlug(), d.getTitle(), d.getSummary(), d.getCategory(), DocContent.tags(d.getTags()),
                d.getSortOrder(), d.getVersion(), d.getPlainText(), userId(d.getCreatedBy()), userName(d.getCreatedBy()), userId(d.getUpdatedBy()),
                userName(d.getUpdatedBy()), d.getCreatedAt(), d.getUpdatedAt());
        }
    }

    /** Tek doküman: içerik + bekleyen öneriler (yöneticiye toplam, çalışana kendi önerisi). */
    public record DocDetail(Long id, String slug, String title, String summary, String category, List<String> tags, int sortOrder,
                            int version, String plainText, Long createdById, String createdByName, Long updatedById, String updatedByName,
                            LocalDateTime createdAt, LocalDateTime updatedAt, @JsonRawValue String content, long pendingCount,
                            Long myPendingRevisionId) {
        static DocDetail from(Doc d, long pendingCount, Long myPending) {
            return new DocDetail(d.getId(), d.getSlug(), d.getTitle(), d.getSummary(), d.getCategory(), DocContent.tags(d.getTags()),
                d.getSortOrder(), d.getVersion(), d.getPlainText(), userId(d.getCreatedBy()), userName(d.getCreatedBy()), userId(d.getUpdatedBy()),
                userName(d.getUpdatedBy()), d.getCreatedAt(), d.getUpdatedAt(), d.getContent(), pendingCount, myPending);
        }
    }

    /**
     * Öneri / sürüm. outdated: öneri hazırlandıktan sonra doküman başka bir değişiklikle güncellendi (onaylanırsa o değişiklik ezilir).
     * content listelerde null'dır.
     */
    public record Revision(Long id, Long docId, String docSlug, String docTitle, Integer docVersion, boolean isNew, String title,
                           String summary, String category, List<String> tags, Integer baseVersion, boolean outdated, String note,
                           DocRevisionStatus status, Long authorId, String authorName, Long decidedById, String decidedByName,
                           String decisionNote, LocalDateTime createdAt, LocalDateTime decidedAt, @JsonRawValue String content) {
        static Revision from(DocRevision r, boolean withContent) {
            Doc d = r.getDoc();
            boolean outdated = r.getStatus() == DocRevisionStatus.BEKLIYOR && d != null && r.getBaseVersion() != null
                && d.getVersion() != r.getBaseVersion();
            return new Revision(r.getId(), d != null ? d.getId() : null, d != null ? d.getSlug() : null, d != null ? d.getTitle() : null,
                d != null ? d.getVersion() : null, d == null, r.getTitle(), r.getSummary(), r.getCategory(), DocContent.tags(r.getTags()),
                r.getBaseVersion(), outdated, r.getNote(), r.getStatus(), userId(r.getAuthor()), userName(r.getAuthor()), userId(r.getDecidedBy()),
                userName(r.getDecidedBy()), r.getDecisionNote(), r.getCreatedAt(), r.getDecidedAt(), withContent ? r.getContent() : null);
        }
    }

    private static Long userId(User u) {
        return u != null ? u.getId() : null;
    }

    private static String userName(User u) {
        return u != null ? u.getFullName() : null;
    }
}
