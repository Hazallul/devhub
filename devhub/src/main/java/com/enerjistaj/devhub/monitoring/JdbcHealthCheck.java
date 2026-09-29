package com.enerjistaj.devhub.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Uygulamanın kendi veritabanı bağlantısıyla SELECT 1 çalıştırır. */
@Component
@RequiredArgsConstructor
public class JdbcHealthCheck implements HealthCheck {

    private final JdbcTemplate jdbc;

    @Override
    public String type() {
        return "JDBC";
    }

    @Override
    public Result check(MonitoringProperties.ServiceDef service) {
        long start = System.nanoTime();
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return new Result(true, Probes.elapsedMs(start), "SELECT 1");
        } catch (Exception e) {
            return new Result(false, Probes.elapsedMs(start), "Sorgu başarısız: " + Probes.reason(e));
        }
    }
}
