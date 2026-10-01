package com.enerjistaj.devhub.realtime;

import com.enerjistaj.devhub.exception.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/** Anlık güncelleme akışı: GET /api/events (text/event-stream, Authorization başlığıyla; tarayıcıda fetch ile okunur). */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class RealtimeController {

    private final RealtimeService realtime;
    private final JdbcTemplate jdbc;

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam String client, HttpServletResponse response) {
        if (!client.matches("[A-Za-z0-9-]{8,64}")) throw ApiException.badRequest("Geçersiz istemci kimliği.");
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        // Kullanıcı JPA yerine doğrudan JDBC ile bulunur: açık kalan akış boyunca veritabanı bağlantısı tutulmasın
        // (open-in-view, istek içinde JPA kullanılırsa bağlantıyı istek bitene kadar elde tutar).
        List<Long> ids = jdbc.queryForList("SELECT id FROM users WHERE email = ? AND active = 1", Long.class, auth.getName());
        if (ids.isEmpty()) throw new ApiException(HttpStatus.UNAUTHORIZED, "Oturum süresi doldu, tekrar giriş yapın.");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        return realtime.connect(ids.get(0), client);
    }
}
