package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.*;
import com.enerjistaj.devhub.repository.ActionLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Sistem logları (denetim kaydı). Kullanım:
 * <pre>
 * actionLogService.record(LogCategory.GOREV, LogAction.SILME, "Görev silindi: " + t.getContent())
 *     .by(me).target("GOREV", t.getId(), t.getContent()).change("Durum", "Yapılacak", "Tamamlandı").level(LogLevel.UYARI).save();
 * </pre>
 * IP adresi istekten kendiliğinden alınır. Kişisel yapılacaklar kişiye özel olduğu için loglanmaz.
 */
@Service
@RequiredArgsConstructor
public class ActionLogService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");

    private final ActionLogRepository actionLogRepository;

    public Entry record(LogCategory category, LogAction action, String message) {
        return new Entry(category, action, message);
    }

    /** "Alan: eski → yeni"; değer değişmediyse null (satır eklenmez). */
    public static String diff(String field, Object before, Object after) {
        if (Objects.equals(before, after)) return null;
        return field + ": " + show(before) + " → " + show(after);
    }

    private static String show(Object v) {
        return v == null || v.toString().isBlank() ? "—" : v.toString();
    }

    public final class Entry {
        private final ActionLog log = new ActionLog();
        private final List<String> lines = new ArrayList<>();

        private Entry(LogCategory category, LogAction action, String message) {
            log.setCategory(category);
            log.setAction(action);
            log.setMessage(message.length() > 500 ? message.substring(0, 497) + "..." : message);
        }

        /** İşlemi yapan kişi; null = sistem. */
        public Entry by(User actor) {
            log.setActor(actor);
            return this;
        }

        public Entry target(String type, Long id, String name) {
            log.setTargetType(type);
            log.setTargetId(id);
            log.setTargetName(name != null && name.length() > 200 ? name.substring(0, 197) + "..." : name);
            return this;
        }

        public Entry level(LogLevel level) {
            log.setLevel(level);
            return this;
        }

        /** Ayrıntı satırı ekler (null veya boşsa yok sayılır). */
        public Entry detail(String line) {
            if (line != null && !line.isBlank()) lines.add(line);
            return this;
        }

        public Entry change(String field, Object before, Object after) {
            return detail(diff(field, before, after));
        }

        public Entry details(List<String> more) {
            more.forEach(this::detail);
            return this;
        }

        public ActionLog save() {
            if (!lines.isEmpty()) {
                String text = String.join("\n", lines);
                log.setDetails(text.length() > 2000 ? text.substring(0, 1997) + "..." : text);
            }
            log.setIpAddress(clientIp());
            return actionLogRepository.save(log);
        }
    }

    /** İsteğin geldiği adres (vekil sunucu arkasındaysa X-Forwarded-For'daki ilk adres); zamanlanmış işlerde null. */
    private static String clientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) return null;
        HttpServletRequest request = attrs.getRequest();
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
        return ip != null && ip.length() > 45 ? ip.substring(0, 45) : ip;
    }
}
