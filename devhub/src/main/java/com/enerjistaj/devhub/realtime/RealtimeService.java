package com.enerjistaj.devhub.realtime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Anlık güncellemeler (Server-Sent Events). Her açık sekme bir bağlantıdır; sunucu iki tür olay yollar:
 * <ul>
 *   <li>{@code notification}: kişiye yeni bir bildirim düştü (içeriğiyle birlikte),</li>
 *   <li>{@code invalidate}: şu veri türleri değişti ({@code keys}, ör. tasks, leaves) — istemci yalnızca o ekranları yeniden çeker.</li>
 * </ul>
 * invalidate olayları veri taşımaz, yalnızca "şu değişti" der; herkes kendi yetkisiyle yeniden ister. Değişikliği yapan sekme
 * ({@code X-Client-Id}) olayı almaz, çünkü kendi ekranını zaten güncelledi. Gönderimler tek bir arka plan iş parçacığında yapılır,
 * yavaş bir bağlantı isteği bekletmez; işlem içindeyse kayıt veritabanına yazıldıktan (commit) sonra gönderilir.
 */
@Slf4j
@Service
public class RealtimeService {

    /** Bağlantı en fazla bu kadar açık kalır; istemci sonra kendiliğinden yeniden bağlanır (süresi dolmuş token da böylece elenir). */
    private static final long TIMEOUT_MS = 30 * 60_000L;

    private record Client(Long userId, String clientId, SseEmitter emitter) {}

    private final Map<Long, Set<Client>> byUser = new ConcurrentHashMap<>();
    private final ExecutorService sender = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "realtime-sender");
        t.setDaemon(true);
        return t;
    });
    private final ObjectMapper json;

    public RealtimeService(ObjectMapper json) {
        this.json = json;
    }

    public SseEmitter connect(Long userId, String clientId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Client c = new Client(userId, clientId, emitter);
        byUser.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>()).add(c);
        emitter.onCompletion(() -> remove(c));
        emitter.onTimeout(() -> remove(c));
        emitter.onError(e -> remove(c));
        sender.execute(() -> send(c, "ready", Map.of("clientId", clientId)));
        return emitter;
    }

    /** Herkese: bu veri türleri değişti. */
    public void invalidate(Collection<String> keys, String exceptClientId) {
        afterCommit(() -> byUser.values().forEach(set -> set.forEach(c -> {
            if (!c.clientId().equals(exceptClientId)) send(c, "invalidate", Map.of("keys", keys));
        })));
    }

    /** Yalnızca belirli kişilere (ör. ortak listenin üyeleri). */
    public void invalidateFor(Collection<Long> userIds, Collection<String> keys, String exceptClientId) {
        Set<Long> ids = new HashSet<>(userIds);
        afterCommit(() -> ids.forEach(id -> byUser.getOrDefault(id, Set.of()).forEach(c -> {
            if (!c.clientId().equals(exceptClientId)) send(c, "invalidate", Map.of("keys", keys));
        })));
    }

    public void notification(Long userId, Object payload) {
        afterCommit(() -> byUser.getOrDefault(userId, Set.of()).forEach(c -> send(c, "notification", payload)));
    }

    /** Hesap pasifleştirilince açık bağlantıları kapatır. */
    public void disconnect(Long userId) {
        afterCommit(() -> {
            Set<Client> set = byUser.remove(userId);
            if (set != null) set.forEach(c -> c.emitter().complete());
        });
    }

    public int connectionCount() {
        return byUser.values().stream().mapToInt(Set::size).sum();
    }

    /** Ara sunucular boşta kalan bağlantıyı kesmesin ve kopmuş bağlantılar temizlensin diye. */
    @Scheduled(fixedRate = 20_000)
    void heartbeat() {
        sender.execute(() -> byUser.values().forEach(set -> set.forEach(c -> {
            try {
                c.emitter().send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException e) {
                remove(c);
            }
        })));
    }

    private void send(Client c, String event, Object data) {
        try {
            c.emitter().send(SseEmitter.event().name(event).data(json.writeValueAsString(data)));
        } catch (IOException | IllegalStateException e) {
            remove(c);
        } catch (RuntimeException e) {
            log.warn("Anlık olay gönderilemedi: {}", e.getMessage());
        }
    }

    private void remove(Client c) {
        // Boşalan küme silinmez: aynı anda eklenen yeni bir bağlantı kaybolmasın (kişi başına tek küçük nesne).
        Set<Client> set = byUser.get(c.userId());
        if (set != null) set.remove(c);
    }

    private void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sender.execute(task);
                }
            });
        } else {
            sender.execute(task);
        }
    }
}
