package com.enerjistaj.devhub.realtime;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.*;

/**
 * Başarılı her yazma isteğinden (POST/PUT/DELETE) sonra, değişen veri türlerini açık ekranlara duyurur.
 * Hangi adresin hangi ekranları etkilediği {@link #KEYS} tablosundadır; yeni bir modül eklenince buraya da eklenmeli.
 * Kişisel alan (/api/todos) herkese değil, yalnızca kişiyle liste paylaşanlara duyurulur.
 */
@Component
@RequiredArgsConstructor
public class RealtimeInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    public static final String CLIENT_HEADER = "X-Client-Id";
    private static final String BEFORE = RealtimeInterceptor.class.getName() + ".todoPeers";

    /** Adres öneki → istemcideki React Query anahtarları (önek olarak geçersiz kılınır). Uzun önekler önce denenir. */
    private static final Map<String, List<String>> KEYS = new LinkedHashMap<>();
    static {
        KEYS.put("/api/admin/backups", List.of("backups"));
        KEYS.put("/api/admin/users", List.of("users", "admin-users", "tasks", "projects", "leaves", "todos", "onboarding"));
        KEYS.put("/api/profile-requests", List.of("profile-requests", "users", "admin-users"));
        KEYS.put("/api/users", List.of("users", "admin-users", "leaves", "onboarding"));
        KEYS.put("/api/tasks", List.of("tasks", "projects", "todos", "tickets"));
        KEYS.put("/api/surveys", List.of("surveys"));
        KEYS.put("/api/tickets", List.of("tickets", "tasks"));
        KEYS.put("/api/labels", List.of("labels", "tasks"));
        KEYS.put("/api/attachments", List.of("tasks", "tickets"));
        KEYS.put("/api/projects", List.of("projects", "users", "tasks"));
        KEYS.put("/api/leaves", List.of("leaves", "users"));
        KEYS.put("/api/announcements", List.of("announcements"));
        KEYS.put("/api/holidays", List.of("holidays", "leaves"));
        KEYS.put("/api/docs", List.of("docs", "onboarding"));
        KEYS.put("/api/onboarding", List.of("onboarding", "admin-users"));
        KEYS.put("/api/auth", List.of());
    }

    private final RealtimeService realtime;
    private final JdbcTemplate jdbc;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**").excludePathPatterns("/api/events");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // Listeden çıkarılan biri de değişikliği görsün: paylaşanlar işlemden ÖNCE de toplanır.
        if (isWrite(request) && request.getRequestURI().startsWith("/api/todos")) {
            Long me = currentUserId();
            if (me != null) request.setAttribute(BEFORE, todoPeers(me));
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (!isWrite(request) || ex != null || response.getStatus() >= 400) return;
        String path = request.getRequestURI();
        String origin = request.getHeader(CLIENT_HEADER);

        if (path.startsWith("/api/notifications")) {
            // Okundu bilgisi yalnızca kişinin diğer sekmelerini ilgilendirir.
            Long me = currentUserId();
            if (me != null) realtime.invalidateFor(List.of(me), List.of("notifications"), origin);
            return;
        }
        if (path.startsWith("/api/todos")) {
            Long me = currentUserId();
            if (me == null) return;
            Set<Long> peers = new HashSet<>(todoPeers(me));
            if (request.getAttribute(BEFORE) instanceof Collection<?> before) before.forEach(id -> peers.add((Long) id));
            peers.add(me);
            realtime.invalidateFor(peers, List.of("todos"), origin);
            return;
        }

        List<String> keys = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : KEYS.entrySet()) {
            if (path.startsWith(e.getKey())) {
                keys.addAll(e.getValue());
                break;
            }
        }
        keys.add("logs"); // her yazma işlemi loglanır
        realtime.invalidate(keys, origin);
    }

    private static boolean isWrite(HttpServletRequest request) {
        String m = request.getMethod();
        return "POST".equals(m) || "PUT".equals(m) || "DELETE".equals(m) || "PATCH".equals(m);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return null;
        List<Long> ids = jdbc.queryForList("SELECT id FROM users WHERE email = ?", Long.class, auth.getName());
        return ids.isEmpty() ? null : ids.get(0);
    }

    /** Kişiyle en az bir listeyi paylaşanlar. */
    private List<Long> todoPeers(Long userId) {
        return jdbc.queryForList("""
                SELECT DISTINCT m2.user_id FROM todo_list_members m1
                JOIN todo_list_members m2 ON m2.list_id = m1.list_id
                WHERE m1.user_id = ?""", Long.class, userId);
    }
}
