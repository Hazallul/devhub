package com.enerjistaj.devhub.survey;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Anketler: liste, ayrıntı, yanıt; yönetici için taslak, yayın, kapatma, hatırlatma, sonuçlar ve Excel çıktısı. */
@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class SurveyController {

    private final SurveyService surveys;
    private final CurrentUser currentUser;

    @GetMapping
    public List<SurveyService.Summary> list() {
        return surveys.list(currentUser.get());
    }

    @GetMapping("/pending-count")
    public Map<String, Integer> pendingCount() {
        return Map.of("count", surveys.pendingCount(currentUser.get()));
    }

    @GetMapping("/{id}")
    public SurveyService.Detail detail(@PathVariable Long id) {
        return surveys.detail(id, currentUser.get());
    }

    @PostMapping
    public Map<String, Long> create(@RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin("Anketleri yalnızca yöneticiler oluşturabilir.");
        return Map.of("id", surveys.create(body, me));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        surveys.update(id, body, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/settings")
    public ResponseEntity<Void> settings(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        surveys.updateSettings(id, body, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<Void> publish(@PathVariable Long id) {
        surveys.publish(id, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<Void> close(@PathVariable Long id) {
        surveys.close(id, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<Void> reopen(@PathVariable Long id) {
        surveys.reopen(id, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        surveys.delete(id, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/remind")
    public Map<String, Integer> remind(@PathVariable Long id) {
        return Map.of("sent", surveys.remind(id, currentUser.get()));
    }

    @PostMapping("/{id}/responses")
    public ResponseEntity<Void> respond(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        surveys.respond(id, body, currentUser.get());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/results")
    public Map<String, Object> results(@PathVariable Long id) {
        return surveys.results(id, currentUser.get());
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        byte[] file = surveys.export(id, currentUser.get());
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("anket-" + id + "-yanitlar.xlsx").build().toString())
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(file);
    }
}
