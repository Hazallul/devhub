package com.enerjistaj.devhub.monitoring;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** HTTP GET; 2xx/3xx yanıt ayakta sayılır. */
@Component
public class HttpHealthCheck implements HealthCheck {

    // HTTP/1.1: varsayılan h2c yükseltme isteği bazı sunucularda (ör. Vite) yanıtsız kalıyor.
    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(2)).build();

    @Override
    public String type() {
        return "HTTP";
    }

    @Override
    public Result check(MonitoringProperties.ServiceDef service) {
        long start = System.nanoTime();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(service.target())).timeout(Duration.ofSeconds(3)).GET().build();
            int code = client.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            return new Result(code < 400, Probes.elapsedMs(start), "HTTP " + code);
        } catch (Exception e) {
            return new Result(false, Probes.elapsedMs(start), "Yanıt yok: " + Probes.reason(e));
        }
    }
}
