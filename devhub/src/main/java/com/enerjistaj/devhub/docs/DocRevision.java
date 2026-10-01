package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Bir dokümanın önerilen ya da yayınlanmış bir sürümü. doc null ise yeni doküman önerisidir (onaylanınca doküman oluşur).
 * ONAYLANDI kayıtları dokümanın sürüm geçmişidir.
 */
@Entity
@Table(name = "doc_revisions")
@Data
public class DocRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doc_id")
    private Doc doc;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String summary;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(length = 300)
    private String tags;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    /** Önerinin üzerine hazırlandığı doküman sürümü (yeni doküman için null). */
    @Column(name = "base_version")
    private Integer baseVersion;

    /** Öneren kişinin "ne değiştirdim" açıklaması */
    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocRevisionStatus status = DocRevisionStatus.BEKLIYOR;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_id")
    private User decidedBy;

    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}
