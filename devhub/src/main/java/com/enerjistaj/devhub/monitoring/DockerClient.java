package com.enerjistaj.devhub.monitoring;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Docker Engine API'nin salt okunur kısmı (konteyner listesi, inspect, anlık istatistik, motor bilgisi).
 * docker-socket-proxy üzerinden konuşur; proxy yazma uçlarını kapattığı için buradan konteyner yönetilemez.
 */
@Component
public class DockerClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {};

    private final RestClient http;

    public DockerClient(MonitoringProperties props) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.http = RestClient.builder().baseUrl(props.dockerUrl()).requestFactory(factory).build();
    }

    public Map<String, Object> info() {
        return http.get().uri("/info").retrieve().body(MAP);
    }

    /** Projenin durdurulmuş olanlar dahil tüm konteynerleri */
    public List<Map<String, Object>> containers(String composeProject) {
        String filter = "{\"label\":[\"com.docker.compose.project=" + composeProject + "\"]}";
        return http.get().uri("/containers/json?all=true&filters={f}", filter).retrieve().body(LIST);
    }

    public Map<String, Object> inspect(String id) {
        return http.get().uri("/containers/{id}/json", id).retrieve().body(MAP);
    }

    /** Tek seferlik istatistik (beklemeden döner); CPU yüzdesi ardışık iki örnekten hesaplanır. */
    public Map<String, Object> stats(String id) {
        return http.get().uri("/containers/{id}/stats?stream=false&one-shot=true", id).retrieve().body(MAP);
    }
}
