package com.enerjistaj.devhub.backup;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Yönetici: veritabanı yedekleri (liste, elle yedek, indirme, yükleme, geri yükleme, silme). */
@RestController
@RequestMapping("/api/admin/backups")
@RequiredArgsConstructor
public class BackupController {

    private static final String ONLY_ADMIN = "Yedekleri yalnızca yöneticiler yönetebilir.";
    /** Geri yükleme bütün veriyi değiştirir; istemci bu ifadeyi kişiye yazdırır ve gönderir. */
    private static final String CONFIRM = "GERİ YÜKLE";

    private final BackupService backups;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        currentUser.requireAdmin(ONLY_ADMIN);
        LocalDateTime last = backups.lastAutomatic();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", backups.list());
        out.put("intervalDays", backups.intervalDays());
        out.put("keepAuto", backups.keepAuto());
        out.put("lastAutomaticAt", last);
        out.put("nextAutomaticAt", last == null ? null : last.plusDays(backups.intervalDays()));
        return ResponseEntity.ok(out);
    }

    @PostMapping
    public ResponseEntity<BackupService.BackupInfo> create() {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        return ResponseEntity.ok(backups.createManual(me));
    }

    @GetMapping("/{name}/download")
    public ResponseEntity<Resource> download(@PathVariable String name) {
        currentUser.requireAdmin(ONLY_ADMIN);
        Path p = backups.file(name);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(new FileSystemResource(p));
    }

    @PostMapping("/upload")
    public ResponseEntity<BackupService.BackupInfo> upload(@RequestParam("file") MultipartFile file) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        if (file.isEmpty()) throw ApiException.badRequest("Dosya boş.");
        try (InputStream in = file.getInputStream()) {
            return ResponseEntity.ok(backups.upload(in, me));
        } catch (IOException e) {
            throw ApiException.badRequest("Dosya okunamadı.");
        }
    }

    @PostMapping("/{name}/restore")
    public ResponseEntity<BackupService.BackupInfo> restore(@PathVariable String name, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        if (!CONFIRM.equals(String.valueOf(body.get("confirm")).trim())) {
            throw ApiException.badRequest("Onaylamak için kutuya " + CONFIRM + " yazın.");
        }
        return ResponseEntity.ok(backups.restore(name, me));
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        backups.delete(name, me);
        return ResponseEntity.noContent().build();
    }
}
