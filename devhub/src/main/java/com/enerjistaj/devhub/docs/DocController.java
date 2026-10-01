package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Düzenlenebilir dokümantasyon. Herkes okur ve düzenler; çalışanın değişikliği öneri olarak yönetici onayına gider,
 * yöneticinin değişikliği doğrudan yayınlanır. Onaylanan her öneri dokümanın sürüm geçmişinde kalır.
 */
@RestController
@RequestMapping("/api/docs")
@RequiredArgsConstructor
public class DocController {

    private static final Set<String> RESERVED_SLUGS = Set.of("yeni", "oneri", "oneriler", "images", "revisions");

    private final DocRepository docs;
    private final DocRevisionRepository revisions;
    private final CurrentUser currentUser;
    private final ActionLogService actionLogService;
    private final NotificationService notifications;
    private final ObjectMapper objectMapper;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<DocDtos.DocSummary>> list() {
        return ResponseEntity.ok(docs.findAllByOrderBySortOrderAscIdAsc().stream().map(DocDtos.DocSummary::from).toList());
    }

    @GetMapping("/{slug}")
    @Transactional(readOnly = true)
    public ResponseEntity<DocDtos.DocDetail> get(@PathVariable String slug) {
        User me = currentUser.get();
        Doc d = docs.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Doküman"));
        long pending = CurrentUser.isAdmin(me) ? revisions.countByDocIdAndStatus(d.getId(), DocRevisionStatus.BEKLIYOR) : 0;
        Long mine = revisions.findByDocIdAndAuthorIdAndStatus(d.getId(), me.getId(), DocRevisionStatus.BEKLIYOR).stream()
            .map(DocRevision::getId).findFirst().orElse(null);
        return ResponseEntity.ok(DocDtos.DocDetail.from(d, pending, mine));
    }

    /** Sürüm geçmişi: yayınlanmış (onaylanmış) sürümler, yeniden eskiye. */
    @GetMapping("/{slug}/history")
    @Transactional(readOnly = true)
    public ResponseEntity<List<DocDtos.Revision>> history(@PathVariable String slug) {
        Doc d = docs.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Doküman"));
        return ResponseEntity.ok(revisions.findByDocIdAndStatusOrderByDecidedAtDesc(d.getId(), DocRevisionStatus.ONAYLANDI).stream()
            .map(r -> DocDtos.Revision.from(r, false)).toList());
    }

    /** scope=pending: onay bekleyenler (yalnızca yönetici). scope=mine: kişinin son önerileri. */
    @GetMapping("/revisions")
    @Transactional(readOnly = true)
    public ResponseEntity<List<DocDtos.Revision>> revisionList(@RequestParam(defaultValue = "mine") String scope) {
        User me = currentUser.get();
        List<DocRevision> found = "pending".equals(scope)
            ? (CurrentUser.isAdmin(me) ? revisions.findByStatusOrderByCreatedAtAsc(DocRevisionStatus.BEKLIYOR) : List.of())
            : revisions.findTop30ByAuthorIdOrderByCreatedAtDesc(me.getId());
        return ResponseEntity.ok(found.stream().map(r -> DocDtos.Revision.from(r, false)).toList());
    }

    @GetMapping("/revisions/pending-count")
    public ResponseEntity<Map<String, Long>> pendingCount() {
        User me = currentUser.get();
        return ResponseEntity.ok(Map.of("count", CurrentUser.isAdmin(me) ? revisions.countByStatus(DocRevisionStatus.BEKLIYOR) : 0L));
    }

    /** Bir öneri/sürümün içeriği: yönetici, önerinin sahibi veya (yayınlanmış sürümse) herkes görebilir. */
    @GetMapping("/revisions/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<DocDtos.Revision> revision(@PathVariable Long id) {
        User me = currentUser.get();
        DocRevision r = revisions.findById(id).orElseThrow(() -> ApiException.notFound("Öneri"));
        boolean mine = r.getAuthor() != null && r.getAuthor().getId().equals(me.getId());
        if (!CurrentUser.isAdmin(me) && !mine && r.getStatus() != DocRevisionStatus.ONAYLANDI) throw ApiException.notFound("Öneri");
        return ResponseEntity.ok(DocDtos.Revision.from(r, true));
    }

    /**
     * Yeni doküman veya değişiklik. Gövde: docId (yoksa yeni doküman), baseVersion, title, summary, category, tags[], content (editör JSON'u),
     * note (ne değişti), replaces (kişinin yerine geçecek bekleyen önerisi), force (yönetici: arada yapılan değişikliğin üzerine yaz).
     * Yönetici için doğrudan yayınlanır; çalışan için onaya gider.
     */
    @PostMapping("/revisions")
    @Transactional
    public ResponseEntity<DocDtos.Revision> submit(@RequestBody Map<String, Object> body) {
        User me = currentUser.get();
        boolean admin = CurrentUser.isAdmin(me);
        Doc doc = null;
        if (body.get("docId") != null) {
            doc = docs.findById(asLong(body.get("docId"))).orElseThrow(() -> ApiException.notFound("Doküman"));
        }

        DocRevision r = new DocRevision();
        r.setDoc(doc);
        r.setTitle(Payloads.requiredText(body, "title", "Başlık zorunludur.", 200, "Başlık"));
        if (r.getTitle().length() < 3) throw ApiException.badRequest("Başlık en az 3 karakter olmalı.");
        r.setSummary(Payloads.optionalText(body, "summary", 500, "Özet"));
        String category = Payloads.requiredText(body, "category", "Kategori seçin.", 40, "Kategori");
        if (!DocContent.CATEGORIES.contains(category)) throw ApiException.badRequest("Geçersiz kategori.");
        r.setCategory(category);
        r.setTags(tags(body.get("tags")));
        String plain = DocContent.validate(body.get("content"));
        r.setContent(objectMapper.writeValueAsString(body.get("content")));
        if (r.getContent().length() > 2_000_000) throw ApiException.badRequest("Doküman çok büyük; bazı bölümleri ayrı dokümanlara bölün.");
        r.setNote(Payloads.optionalText(body, "note", 500, "Açıklama"));
        r.setAuthor(me);

        if (doc != null) {
            Integer base = body.get("baseVersion") != null ? (int) asLong(body.get("baseVersion")) : doc.getVersion();
            r.setBaseVersion(base);
            if (sameAs(r, doc)) throw ApiException.badRequest("Dokümanda bir değişiklik yok.");
            if (admin && base != doc.getVersion() && !Payloads.flag(body, "force")) {
                throw ApiException.conflict("Siz düzenlerken bu doküman " + (doc.getUpdatedBy() != null ? doc.getUpdatedBy().getFullName() + " tarafından " : "")
                    + "güncellendi. Yayınlarsanız o değişiklik sizinkiyle değişir.");
            }
        }

        // Kişinin aynı doküman için (ya da açıkça belirttiği) bekleyen eski önerisi yenisiyle değişir.
        Set<DocRevision> superseded = new LinkedHashSet<>();
        if (doc != null) superseded.addAll(revisions.findByDocIdAndAuthorIdAndStatus(doc.getId(), me.getId(), DocRevisionStatus.BEKLIYOR));
        if (body.get("replaces") != null) {
            revisions.findById(asLong(body.get("replaces")))
                .filter(old -> old.getStatus() == DocRevisionStatus.BEKLIYOR && old.getAuthor() != null && old.getAuthor().getId().equals(me.getId()))
                .ifPresent(superseded::add);
        }
        superseded.forEach(old -> old.setStatus(DocRevisionStatus.GERI_CEKILDI));

        if (admin) {
            r.setStatus(DocRevisionStatus.ONAYLANDI);
            r.setDecidedBy(me);
            r.setDecidedAt(LocalDateTime.now());
            Doc applied = apply(r, plain);
            DocRevision saved = revisions.save(r);
            actionLogService.record(LogCategory.DOKUMAN, doc == null ? LogAction.OLUSTURMA : LogAction.GUNCELLEME,
                    (doc == null ? "Doküman yayınlandı: " : "Doküman güncellendi: ") + applied.getTitle()).by(me)
                .target("DOKUMAN", applied.getId(), applied.getTitle())
                .detail("Sürüm " + applied.getVersion())
                .detail(r.getNote() != null ? "Açıklama: " + r.getNote() : null)
                .detail(Payloads.flag(body, "force") ? "Arada yapılan bir değişikliğin üzerine yazıldı" : null)
                .save();
            return ResponseEntity.ok(DocDtos.Revision.from(saved, false));
        }

        DocRevision saved = revisions.save(r);
        String what = doc == null ? "yeni doküman önerdi: " + r.getTitle() : "dokümanda değişiklik önerdi: " + doc.getTitle();
        actionLogService.record(LogCategory.DOKUMAN, LogAction.TALEP, "Doküman önerisi gönderildi: " + r.getTitle()).by(me)
            .target("DOKUMAN_ONERISI", saved.getId(), r.getTitle())
            .detail(doc == null ? "Yeni doküman" : "Mevcut doküman, sürüm " + r.getBaseVersion() + " üzerine")
            .detail(r.getNote() != null ? "Açıklama: " + r.getNote() : null)
            .detail("Yönetici onayı bekleniyor").save();
        notifications.notifyAdmins(me, NotificationType.DOC_REVISION_REQUESTED, me.getFullName() + " " + what,
            r.getNote() != null ? r.getNote() : "İncelemek için tıklayın.", "/docs/oneri/" + saved.getId());
        return ResponseEntity.ok(DocDtos.Revision.from(saved, false));
    }

    /** decision: ONAYLANDI veya REDDEDILDI; note: öneren kişiye gösterilecek açıklama. */
    @PutMapping("/revisions/{id}/decision")
    @Transactional
    public ResponseEntity<DocDtos.Revision> decide(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User me = currentUser.requireAdmin("Doküman önerilerini yalnızca yöneticiler onaylayabilir.");
        DocRevision r = revisions.findById(id).orElseThrow(() -> ApiException.notFound("Öneri"));
        DocRevisionStatus decision = Payloads.enumValue(body, "decision", DocRevisionStatus.class, "karar");
        if (decision != DocRevisionStatus.ONAYLANDI && decision != DocRevisionStatus.REDDEDILDI) {
            throw ApiException.badRequest("Karar ONAYLANDI veya REDDEDILDI olmalı.");
        }
        if (r.getStatus() != DocRevisionStatus.BEKLIYOR) throw ApiException.conflict("Bu öneri zaten sonuçlandırılmış veya geri çekilmiş.");

        boolean outdated = r.getDoc() != null && r.getBaseVersion() != null && r.getDoc().getVersion() != r.getBaseVersion();
        r.setStatus(decision);
        r.setDecidedBy(me);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecisionNote(Payloads.optionalText(body, "note", 500, "Açıklama"));
        boolean approved = decision == DocRevisionStatus.ONAYLANDI;
        Doc applied = approved ? apply(r, DocContent.validate(objectMapper.readValue(r.getContent(), Map.class))) : r.getDoc();
        DocRevision saved = revisions.save(r);

        actionLogService.record(LogCategory.DOKUMAN, approved ? LogAction.ONAY : LogAction.RET,
                (approved ? "Doküman önerisi onaylandı: " : "Doküman önerisi reddedildi: ") + r.getTitle()).by(me)
            .target("DOKUMAN", applied != null ? applied.getId() : null, r.getTitle())
            .detail("Öneren: " + (r.getAuthor() != null ? r.getAuthor().getFullName() : "silinmiş kullanıcı"))
            .detail(approved && applied != null ? "Yayınlanan sürüm " + applied.getVersion() : null)
            .detail(approved && outdated ? "Öneriden sonra yapılan bir değişikliğin üzerine yazıldı" : null)
            .detail(r.getDecisionNote() != null ? "Açıklama: " + r.getDecisionNote() : null)
            .level(approved ? LogLevel.BILGI : LogLevel.UYARI).save();
        if (r.getAuthor() != null) {
            String title = approved ? "Doküman öneriniz onaylandı: " + r.getTitle() : "Doküman öneriniz reddedildi: " + r.getTitle();
            String link = approved && applied != null ? "/docs/" + applied.getSlug() : "/docs/oneri/" + saved.getId();
            notifications.notify(r.getAuthor(), me, NotificationType.DOC_REVISION_DECIDED, title,
                r.getDecisionNote() != null ? r.getDecisionNote() : (approved ? "Değişiklik yayında." : "Ayrıntılar için tıklayın."), link);
        }
        return ResponseEntity.ok(DocDtos.Revision.from(saved, false));
    }

    /** Öneren kişi bekleyen önerisini geri çeker. */
    @DeleteMapping("/revisions/{id}")
    @Transactional
    public ResponseEntity<Void> withdraw(@PathVariable Long id) {
        User me = currentUser.get();
        DocRevision r = revisions.findById(id).orElseThrow(() -> ApiException.notFound("Öneri"));
        if (r.getAuthor() == null || !r.getAuthor().getId().equals(me.getId())) throw ApiException.forbidden("Yalnızca kendi önerinizi geri çekebilirsiniz.");
        if (r.getStatus() != DocRevisionStatus.BEKLIYOR) throw ApiException.conflict("Yalnızca bekleyen öneriler geri çekilebilir.");
        r.setStatus(DocRevisionStatus.GERI_CEKILDI);
        actionLogService.record(LogCategory.DOKUMAN, LogAction.GERI_CEKME, "Doküman önerisi geri çekildi: " + r.getTitle()).by(me)
            .target("DOKUMAN_ONERISI", r.getId(), r.getTitle()).save();
        return ResponseEntity.noContent().build();
    }

    /** Dokümanı (geçmişi ve bekleyen önerileriyle) siler. */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        User me = currentUser.requireAdmin("Dokümanları yalnızca yöneticiler silebilir.");
        Doc d = docs.findById(id).orElseThrow(() -> ApiException.notFound("Doküman"));
        actionLogService.record(LogCategory.DOKUMAN, LogAction.SILME, "Doküman silindi: " + d.getTitle()).by(me)
            .target("DOKUMAN", d.getId(), d.getTitle())
            .detail("Son sürüm: " + d.getVersion())
            .level(LogLevel.UYARI).save();
        docs.delete(d);
        return ResponseEntity.noContent().build();
    }

    /** Onaylanan sürümü dokümana uygular (yeni doküman önerisiyse dokümanı oluşturur). */
    private Doc apply(DocRevision r, String plain) {
        Doc d = r.getDoc();
        LocalDateTime now = LocalDateTime.now();
        if (d == null) {
            d = new Doc();
            d.setSlug(uniqueSlug(r.getTitle()));
            d.setSortOrder(docs.maxSortOrder(r.getCategory()) + 1);
            d.setCreatedBy(r.getAuthor());
            d.setCreatedAt(now);
            d.setVersion(1);
        } else {
            if (!d.getCategory().equals(r.getCategory())) d.setSortOrder(docs.maxSortOrder(r.getCategory()) + 1);
            d.setVersion(d.getVersion() + 1);
        }
        d.setTitle(r.getTitle());
        d.setSummary(r.getSummary());
        d.setCategory(r.getCategory());
        d.setTags(r.getTags());
        d.setContent(r.getContent());
        d.setPlainText(plain);
        d.setUpdatedBy(r.getAuthor());
        d.setUpdatedAt(now);
        Doc saved = docs.save(d);
        r.setDoc(saved);
        return saved;
    }

    private boolean sameAs(DocRevision r, Doc d) {
        return r.getTitle().equals(d.getTitle()) && Objects.equals(r.getSummary(), d.getSummary()) && r.getCategory().equals(d.getCategory())
            && Objects.equals(r.getTags(), d.getTags())
            && objectMapper.readTree(r.getContent()).equals(objectMapper.readTree(d.getContent()));
    }

    private String uniqueSlug(String title) {
        String base = DocContent.slugify(title);
        if (RESERVED_SLUGS.contains(base)) base = base + "-dokumani";
        String slug = base;
        for (int i = 2; docs.existsBySlug(slug); i++) slug = base + "-" + i;
        return slug;
    }

    /** Etiketler: dizi veya virgüllü metin; en fazla 8, her biri en fazla 30 karakter, tekrarsız. */
    private static String tags(Object raw) {
        List<String> in = raw instanceof List<?> l ? l.stream().map(String::valueOf).toList()
            : raw == null ? List.of() : List.of(raw.toString().split(","));
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String t : in) {
            String s = t.trim().replace(",", " ").replaceFirst("^#", "");
            if (s.isEmpty()) continue;
            if (s.length() > 30) throw ApiException.badRequest("Etiketler en fazla 30 karakter olabilir.");
            out.add(s);
        }
        if (out.size() > 8) throw ApiException.badRequest("En fazla 8 etiket eklenebilir.");
        return out.isEmpty() ? null : String.join(",", out);
    }

    private static long asLong(Object v) {
        try {
            return v instanceof Number n ? n.longValue() : Long.parseLong(v.toString());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Geçersiz numara: " + v);
        }
    }
}
