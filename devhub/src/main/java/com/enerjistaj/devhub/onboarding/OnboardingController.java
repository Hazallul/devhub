package com.enerjistaj.devhub.onboarding;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * İşe başlangıç listesi. /me uçları herkes içindir (kendi listesi); adım şablonu, ilerleme ve
 * birisi için listeyi başlatıp durdurma yalnızca yöneticiye açıktır.
 */
@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private static final String ONLY_ADMIN = "İşe başlangıç adımlarını yalnızca yöneticiler düzenleyebilir.";

    private final OnboardingService onboarding;
    private final OnboardingStepRepository steps;
    private final UserRepository users;
    private final CurrentUser currentUser;
    private final ActionLogService actionLog;

    // ------------------------------------------------------------- kişinin kendisi

    @GetMapping("/me")
    public ResponseEntity<OnboardingService.Status> me() {
        return ResponseEntity.ok(onboarding.status(currentUser.get()));
    }

    @PutMapping("/me/steps/{stepId}")
    public ResponseEntity<OnboardingService.Status> setDone(@PathVariable Long stepId, @RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        onboarding.setDone(me, stepId, Payloads.flag(body, "done"));
        return ResponseEntity.ok(onboarding.status(me));
    }

    @PostMapping("/me/close")
    public ResponseEntity<Void> close() {
        onboarding.close(currentUser.get());
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------- yönetici: şablon

    @GetMapping("/steps")
    public ResponseEntity<List<OnboardingService.StepDto>> list() {
        currentUser.requireAdmin(ONLY_ADMIN);
        return ResponseEntity.ok(steps.findAllByOrderByPositionAscIdAsc().stream().map(OnboardingService.StepDto::from).toList());
    }

    @PostMapping("/steps")
    @Transactional
    public ResponseEntity<OnboardingService.StepDto> create(@RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        OnboardingStep s = new OnboardingStep();
        apply(s, body);
        s.setPosition(steps.maxPosition() + 1);
        OnboardingStep saved = steps.save(s);
        actionLog.record(LogCategory.SISTEM, LogAction.OLUSTURMA, "İşe başlangıç adımı eklendi: " + saved.getTitle()).by(me)
            .target("BASLANGIC_ADIMI", saved.getId(), saved.getTitle())
            .detail(saved.getLink() != null ? "Bağlantı: " + saved.getLink() : null)
            .detail("Tamamlanma: " + ruleLabel(saved.getAutoRule()))
            .save();
        return ResponseEntity.ok(OnboardingService.StepDto.from(saved));
    }

    @PutMapping("/steps/{id}")
    @Transactional
    public ResponseEntity<OnboardingService.StepDto> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        OnboardingStep s = steps.findById(id).orElseThrow(() -> ApiException.notFound("Adım"));
        String oTitle = s.getTitle(), oDesc = s.getDescription(), oLink = s.getLink();
        String oRule = ruleLabel(s.getAutoRule());
        apply(s, body);
        OnboardingStep saved = steps.save(s);
        List<String> changes = java.util.stream.Stream.of(
            ActionLogService.diff("Başlık", oTitle, saved.getTitle()),
            ActionLogService.diff("Açıklama", oDesc, saved.getDescription()),
            ActionLogService.diff("Bağlantı", oLink, saved.getLink()),
            ActionLogService.diff("Tamamlanma", oRule, ruleLabel(saved.getAutoRule()))).filter(Objects::nonNull).toList();
        if (!changes.isEmpty()) {
            actionLog.record(LogCategory.SISTEM, LogAction.GUNCELLEME, "İşe başlangıç adımı güncellendi: " + saved.getTitle()).by(me)
                .target("BASLANGIC_ADIMI", saved.getId(), saved.getTitle()).details(changes).save();
        }
        return ResponseEntity.ok(OnboardingService.StepDto.from(saved));
    }

    @DeleteMapping("/steps/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        OnboardingStep s = steps.findById(id).orElseThrow(() -> ApiException.notFound("Adım"));
        steps.delete(s);
        actionLog.record(LogCategory.SISTEM, LogAction.SILME, "İşe başlangıç adımı silindi: " + s.getTitle()).by(me)
            .target("BASLANGIC_ADIMI", s.getId(), s.getTitle())
            .detail("Kişilerin bu adımdaki ilerlemesi de silindi")
            .level(com.enerjistaj.devhub.entity.LogLevel.UYARI).save();
        return ResponseEntity.noContent().build();
    }

    /** Sıralama: ids yeni sırayla. */
    @PutMapping("/steps/order")
    @Transactional
    public ResponseEntity<List<OnboardingService.StepDto>> reorder(@RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        if (!(body.get("ids") instanceof List<?> raw)) throw ApiException.badRequest("Sıralama listesi gerekli.");
        List<OnboardingStep> all = steps.findAllByOrderByPositionAscIdAsc();
        Map<Long, OnboardingStep> byId = new HashMap<>();
        all.forEach(s -> byId.put(s.getId(), s));
        int pos = 1;
        for (Object o : raw) {
            OnboardingStep s = byId.remove(((Number) o).longValue());
            if (s != null) s.setPosition(pos++);
        }
        for (OnboardingStep rest : byId.values()) rest.setPosition(pos++);
        steps.saveAll(all);
        actionLog.record(LogCategory.SISTEM, LogAction.GUNCELLEME, "İşe başlangıç adımlarının sırası değiştirildi").by(me).save();
        return ResponseEntity.ok(steps.findAllByOrderByPositionAscIdAsc().stream().map(OnboardingService.StepDto::from).toList());
    }

    // ------------------------------------------------------------- yönetici: kişiler

    @GetMapping("/progress")
    public ResponseEntity<List<OnboardingService.UserProgress>> progress() {
        currentUser.requireAdmin(ONLY_ADMIN);
        return ResponseEntity.ok(onboarding.progress());
    }

    /** Var olan biri için listeyi başlatır (active=true) ya da kaldırır (false; ilerlemesi de silinir). */
    @PutMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<Void> setForUser(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin(ONLY_ADMIN);
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
        if (Payloads.flag(body, "active")) {
            onboarding.start(u, me);
            actionLog.record(LogCategory.KULLANICI, LogAction.GUNCELLEME, "İşe başlangıç listesi başlatıldı: " + u.getFullName()).by(me)
                .target("KULLANICI", u.getId(), u.getFullName()).save();
        } else if (onboarding.stop(u)) {
            actionLog.record(LogCategory.KULLANICI, LogAction.GUNCELLEME, "İşe başlangıç listesi kaldırıldı: " + u.getFullName()).by(me)
                .target("KULLANICI", u.getId(), u.getFullName()).detail("Kişinin bu listedeki ilerlemesi silindi").save();
        }
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------- yardımcılar

    private static void apply(OnboardingStep s, Map<String, Object> body) {
        if (body.containsKey("title") || s.getTitle() == null) {
            s.setTitle(Payloads.requiredText(body, "title", "Adım başlığı boş olamaz.", 150, "Başlık"));
        }
        if (body.containsKey("description")) s.setDescription(Payloads.optionalText(body, "description", 500, "Açıklama"));
        if (body.containsKey("link")) {
            String link = Payloads.optionalText(body, "link", 255, "Bağlantı");
            // Yalnızca uygulama içi adresler (/...) ya da https bağlantıları; "//" ile başlayan başka siteye gider, kabul edilmez.
            if (link != null && !(link.matches("/[A-Za-z0-9._~/?=&%-]*") && !link.startsWith("//")) && !link.matches("https://[^\\s]+")) {
                throw ApiException.badRequest("Bağlantı uygulama içi bir adres (/docs/...) ya da https:// ile başlayan bir adres olmalı.");
            }
            s.setLink(link);
        }
        if (body.containsKey("autoRule")) {
            Object raw = body.get("autoRule");
            s.setAutoRule(raw == null || raw.toString().isBlank() ? null : Payloads.enumValue(body, "autoRule", OnboardingRule.class, "Tamamlanma kuralı"));
        }
        if (s.getAutoRule() == OnboardingRule.DOKUMAN && (s.getLink() == null || !s.getLink().matches("/docs/[a-z0-9-]+"))) {
            throw ApiException.badRequest("\"Doküman açılınca\" kuralı için bağlantı bir doküman olmalı (/docs/...).");
        }
    }

    private static String ruleLabel(OnboardingRule r) {
        if (r == null) return "Kişi işaretler";
        return switch (r) {
            case SIFRE -> "Şifresini belirleyince";
            case ILETISIM -> "İletişim bilgisi ekleyince";
            case DOKUMAN -> "Dokümanı açınca";
        };
    }
}
