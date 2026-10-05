package com.enerjistaj.devhub.taskextra;

import java.time.LocalDateTime;

/** Dosya ekinin bilgi alanları (listelemede içerik okunmaz). */
public interface AttachmentInfo {
    Long getId();
    String getFileName();
    String getContentType();
    long getSizeBytes();
    LocalDateTime getCreatedAt();
    Long getUploaderId();
    String getUploaderName();
}
