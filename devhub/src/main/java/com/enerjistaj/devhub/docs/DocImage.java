package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.entity.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Editörde dokümana eklenen görsel. id tahmin edilemeyen bir UUID'dir. */
@Entity
@Table(name = "doc_images")
@Data
public class DocImage {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "content_type", nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
