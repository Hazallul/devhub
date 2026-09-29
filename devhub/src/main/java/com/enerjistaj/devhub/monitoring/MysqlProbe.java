package com.enerjistaj.devhub.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** MySQL sunucu metrikleri (SHOW GLOBAL STATUS). Sorgu/sn iki örnek arasındaki farktan hesaplanır. */
@Component
@RequiredArgsConstructor
public class MysqlProbe implements MetricProbe {

    private final JdbcTemplate jdbc;
    private long lastQuestions = -1;
    private long lastAt;

    @Override
    public String type() {
        return "MYSQL";
    }

    @Override
    public synchronized List<Detail> collect(MonitoringProperties.ServiceDef service) {
        List<Detail> out = new ArrayList<>();
        try {
            Map<String, Long> s = new HashMap<>();
            jdbc.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Uptime', 'Questions', 'Slow_queries')",
                rs -> { s.put(rs.getString(1), rs.getLong(2)); });
            Long maxConn = jdbc.queryForObject("SELECT @@max_connections", Long.class);
            String version = jdbc.queryForObject("SELECT VERSION()", String.class);
            Double sizeMb = jdbc.queryForObject(
                "SELECT COALESCE(SUM(data_length + index_length), 0) / 1024 / 1024 FROM information_schema.tables WHERE table_schema = DATABASE()",
                Double.class);

            long now = System.currentTimeMillis();
            long questions = s.getOrDefault("Questions", 0L);
            String qps = lastQuestions < 0 || now == lastAt ? "—"
                : String.format(Locale.ROOT, "%.1f", (questions - lastQuestions) * 1000.0 / (now - lastAt));
            lastQuestions = questions;
            lastAt = now;

            out.add(new Detail("Bağlantı", s.getOrDefault("Threads_connected", 0L) + " / " + maxConn,
                s.getOrDefault("Threads_running", 0L) + " sorgu çalışıyor"));
            out.add(new Detail("Sorgu / sn", qps, "son örnekten beri"));
            out.add(new Detail("Yavaş sorgu", String.valueOf(s.getOrDefault("Slow_queries", 0L)), "başlangıçtan beri"));
            out.add(new Detail("Veritabanı boyutu", String.format(Locale.ROOT, "%.1f MB", sizeMb == null ? 0 : sizeMb), "tablolar + indeksler"));
            out.add(new Detail("Sunucu çalışma süresi", Probes.duration(Duration.ofSeconds(s.getOrDefault("Uptime", 0L))), "MySQL " + version));
        } catch (Exception e) {
            out.add(new Detail("Metrikler alınamadı", "—", Probes.reason(e)));
        }
        return out;
    }
}
