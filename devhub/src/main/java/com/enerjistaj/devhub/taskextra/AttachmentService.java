package com.enerjistaj.devhub.taskextra;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * Dosya eki kuralları (görev ve destek talebi aynı kuralı kullanır). Türü istemcinin söylediğine göre değil dosya uzantısına göre
 * belirlenir; yalnızca bilinen uzantılar kabul edilir. Görseller tarayıcıda açılabilir (inline), diğer her şey indirilir ve
 * nosniff başlığı gönderilir: yüklenen bir dosya sayfada kod olarak çalıştırılamaz.
 */
@Service
@RequiredArgsConstructor
public class AttachmentService {

    public static final long MAX_BYTES = 10L * 1024 * 1024;
    /** Bir görevdeki/talepteki eklerin toplam üst sınırı */
    public static final long MAX_TOTAL_BYTES = 50L * 1024 * 1024;

    private static final Map<String, String> TYPES = Map.ofEntries(
        Map.entry("png", "image/png"), Map.entry("jpg", "image/jpeg"), Map.entry("jpeg", "image/jpeg"), Map.entry("gif", "image/gif"),
        Map.entry("webp", "image/webp"), Map.entry("pdf", "application/pdf"), Map.entry("txt", "text/plain"), Map.entry("log", "text/plain"),
        Map.entry("md", "text/plain"), Map.entry("csv", "text/csv"), Map.entry("json", "application/json"), Map.entry("zip", "application/zip"),
        Map.entry("doc", "application/msword"), Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        Map.entry("xls", "application/vnd.ms-excel"), Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        Map.entry("ppt", "application/vnd.ms-powerpoint"), Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"));

    private final AttachmentRepository attachments;

    /** Dosyayı denetler ve kaydedilmeye hazır eki döndürür (görev/talep bağlantısını çağıran kurar). */
    public Attachment build(MultipartFile file, User uploader, long existingTotal) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Dosya boş.");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Dosya çok büyük; en fazla 10 MB yüklenebilir.");
        if (existingTotal + file.getSize() > MAX_TOTAL_BYTES) throw ApiException.badRequest("Bu kayda en fazla 50 MB dosya eklenebilir.");
        String name = cleanName(file.getOriginalFilename());
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String type = TYPES.get(ext);
        if (type == null) {
            throw ApiException.badRequest("Bu dosya türü eklenemez. Görsel, PDF, Office belgesi, metin ya da zip dosyası seçin.");
        }
        Attachment a = new Attachment();
        a.setFileName(name);
        a.setContentType(type);
        a.setUploader(uploader);
        try {
            a.setData(file.getBytes());
        } catch (IOException e) {
            throw ApiException.badRequest("Dosya okunamadı.");
        }
        a.setSizeBytes(a.getData().length);
        return a;
    }

    public ResponseEntity<byte[]> serve(Long id) {
        Attachment a = attachments.findById(id).orElseThrow(() -> ApiException.notFound("Dosya"));
        boolean image = a.getContentType().startsWith("image/");
        ContentDisposition cd = (image ? ContentDisposition.inline() : ContentDisposition.attachment())
            .filename(a.getFileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, cd.toString())
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
            .contentType(MediaType.parseMediaType(a.getContentType()))
            .body(a.getData());
    }

    /** Yol ve denetim karakterleri atılır; ad boşsa "dosya" olur. */
    static String cleanName(String raw) {
        String n = raw == null ? "" : raw.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (n.isEmpty()) n = "dosya";
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }
}
