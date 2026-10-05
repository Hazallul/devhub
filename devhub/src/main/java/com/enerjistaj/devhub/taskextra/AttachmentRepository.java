package com.enerjistaj.devhub.taskextra;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    @Query("select a.id as id, a.fileName as fileName, a.contentType as contentType, a.sizeBytes as sizeBytes, a.createdAt as createdAt, "
        + "u.id as uploaderId, u.fullName as uploaderName from Attachment a left join a.uploader u where a.taskId = :taskId order by a.createdAt desc")
    List<AttachmentInfo> infoForTask(Long taskId);

    @Query("select a.id as id, a.fileName as fileName, a.contentType as contentType, a.sizeBytes as sizeBytes, a.createdAt as createdAt, "
        + "u.id as uploaderId, u.fullName as uploaderName from Attachment a left join a.uploader u where a.ticketId = :ticketId order by a.createdAt desc")
    List<AttachmentInfo> infoForTicket(Long ticketId);

    /** Dosyanın bağlı olduğu talep (yoksa null); içerik yüklenmeden yetki kontrolü için. */
    @Query("select a.ticketId from Attachment a where a.id = :id")
    Long ticketIdOf(Long id);

    @Query("select coalesce(sum(a.sizeBytes), 0) from Attachment a where a.taskId = :taskId")
    long totalSizeForTask(Long taskId);

    @Query("select coalesce(sum(a.sizeBytes), 0) from Attachment a where a.ticketId = :ticketId")
    long totalSizeForTicket(Long ticketId);
}
