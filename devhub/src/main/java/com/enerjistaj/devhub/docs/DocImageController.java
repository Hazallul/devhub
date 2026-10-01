package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Doküman görselleri. Yükleme oturum ister; okuma herkese açıktır çünkü &lt;img&gt; istekleri JWT taşımaz
 * (adres tahmin edilemeyen bir UUID'dir). Yalnızca PNG/JPEG/GIF/WebP kabul edilir ve tür dosyanın ilk baytlarından anlaşılır
 * (SVG kabul edilmez: içine betik gömülebilir).
 */
@RestController
@RequestMapping("/api/docs/images")
@RequiredArgsConstructor
public class DocImageController {

    private static final int MAX_BYTES = 5 * 1024 * 1024;

    private final DocImageRepository images;
    private final CurrentUser currentUser;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        User me = currentUser.get();
        if (file.isEmpty()) throw ApiException.badRequest("Dosya boş.");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Görsel en fazla 5 MB olabilir.");
        byte[] data = file.getBytes();
        String type = sniff(data);
        if (type == null) throw ApiException.badRequest("Yalnızca PNG, JPEG, GIF veya WebP görseller eklenebilir.");

        DocImage img = new DocImage();
        img.setId(UUID.randomUUID().toString());
        img.setContentType(type);
        img.setData(data);
        img.setSizeBytes(data.length);
        img.setUploadedBy(me);
        images.save(img);
        return ResponseEntity.ok(Map.of("url", DocContent.IMAGE_PATH + img.getId()));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> get(@PathVariable String id) {
        DocImage img = images.findById(id).orElseThrow(() -> ApiException.notFound("Görsel"));
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(img.getContentType()))
            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'")
            .body(img.getData());
    }

    private static String sniff(byte[] b) {
        if (b.length < 12) return null;
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "image/gif";
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }
}
