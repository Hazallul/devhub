package com.enerjistaj.devhub.monitoring;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * Sistem İzleme ayarları (application.properties → devhub.monitoring.*).
 * Yeni bir sistemi izlemek için services listesine bir kayıt eklemek yeterlidir:
 * container verilirse Docker kaynak kullanımı, check verilirse sağlık kontrolü, probe verilirse servise özel metrikler toplanır.
 * Compose projesindeki tanımlanmamış konteynerler de otomatik listelenir.
 *
 * @param dockerUrl      Docker Engine API adresi (salt okunur docker-socket-proxy)
 * @param composeProject otomatik keşif: bu compose projesinin konteynerleri listelenir
 * @param warnPercent    CPU veya bellek bu yüzdeyi aşarsa servis "Uyarı" durumuna geçer
 * @param slowLatencyMs  sağlık kontrolü bu süreden yavaşsa "Uyarı"
 */
@ConfigurationProperties(prefix = "devhub.monitoring")
public record MonitoringProperties(
    @DefaultValue("http://localhost:2375") String dockerUrl,
    @DefaultValue("devhub") String composeProject,
    @DefaultValue("10") int sampleSeconds,
    @DefaultValue("60") int historyMinutes,
    @DefaultValue("85") double warnPercent,
    @DefaultValue("1000") long slowLatencyMs,
    @DefaultValue List<ServiceDef> services
) {
    /**
     * @param id        benzersiz kısa ad (geçmişte anahtar)
     * @param container Docker konteyner adı (boşsa yalnızca sağlık kontrolü yapılır, ör. dış servisler)
     * @param check     sağlık kontrolü türü: HTTP, TCP, JDBC veya boş (bkz. HealthCheck uygulamaları)
     * @param target    kontrol hedefi: HTTP için URL, TCP için host:port
     * @param probe     servise özel metrik toplayıcı: JVM, MYSQL veya boş (bkz. MetricProbe uygulamaları)
     */
    public record ServiceDef(String id, String name, String kind, String description, String container,
                             String check, String target, String probe) {}
}
