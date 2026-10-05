package com.enerjistaj.devhub.ticket;

import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.taskextra.Attachment;
import com.enerjistaj.devhub.taskextra.AttachmentInfo;
import com.enerjistaj.devhub.taskextra.AttachmentRepository;
import com.enerjistaj.devhub.taskextra.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** Şirket içi talepler. Kurallar (görünürlük dahil) TicketService'te. */
@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService tickets;
    private final CurrentUser currentUser;
    private final AttachmentRepository attachments;
    private final AttachmentService attachmentService;

    @GetMapping
    public List<TicketService.TicketDto> list() {
        return tickets.list(currentUser.get());
    }

    @GetMapping("/{id}")
    public TicketService.TicketDto get(@PathVariable Long id) {
        return tickets.get(id, currentUser.get());
    }

    @PostMapping
    public TicketService.TicketDto create(@RequestBody Map<String, Object> body) {
        return tickets.create(body, currentUser.get());
    }

    @PutMapping("/{id}")
    public TicketService.TicketDto update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return tickets.update(id, body, currentUser.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tickets.delete(id, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/activity")
    public List<TicketService.ActivityDto> activity(@PathVariable Long id) {
        return tickets.activity(id, currentUser.get());
    }

    @PostMapping("/{id}/comments")
    public TicketService.ActivityDto comment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return tickets.comment(id, body, currentUser.get());
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id, @PathVariable Long commentId) {
        tickets.deleteComment(id, commentId, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/task")
    public TicketService.TicketDto createTask(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return tickets.createTask(id, body, currentUser.get());
    }

    @GetMapping("/{id}/attachments")
    public List<AttachmentInfo> attachments(@PathVariable Long id) {
        tickets.get(id, currentUser.get());
        return attachments.infoForTicket(id);
    }

    @PostMapping("/{id}/attachments")
    @Transactional
    public List<AttachmentInfo> upload(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        tickets.get(id, currentUser.get());
        Attachment a = attachmentService.build(file, currentUser.get(), attachments.totalSizeForTicket(id));
        a.setTicketId(id);
        attachments.save(a);
        return attachments.infoForTicket(id);
    }
}
