package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Yayındaki doküman. İçerik editörün ProseMirror JSON'udur; plainText arama ve okuma süresi içindir. */
@Entity
@Table(name = "docs")
@Data
public class Doc {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120, unique = true)
    private String slug;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String summary;

    @Column(nullable = false, length = 40)
    private String category;

    /** virgülle ayrılmış */
    @Column(length = 300)
    private String tags;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @Column(name = "plain_text", nullable = false, columnDefinition = "LONGTEXT")
    private String plainText;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 99;

    /** Her yayında bir artar; öneriler hangi sürüm üzerinde hazırlandığını tutar. */
    @Column(nullable = false)
    private int version = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    private User updatedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
