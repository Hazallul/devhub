package com.enerjistaj.devhub.monitoring;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Bu uygulamanın (backend) kendi JVM metrikleri; yalnızca backend servisine bağlanmalıdır. */
@Component
@RequiredArgsConstructor
public class JvmProbe implements MetricProbe {

    private final DataSource dataSource;

    @Override
    public String type() {
        return "JVM";
    }

    @Override
    public List<Detail> collect(MonitoringProperties.ServiceDef service) {
        List<Detail> out = new ArrayList<>();
        MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        long max = heap.getMax() > 0 ? heap.getMax() : heap.getCommitted();
        out.add(new Detail("Heap bellek", Probes.mb(heap.getUsed()) + " / " + Probes.mb(max),
            "%" + Math.round(heap.getUsed() * 100.0 / max) + " dolu"));
        var threads = ManagementFactory.getThreadMXBean();
        out.add(new Detail("Thread", String.valueOf(threads.getThreadCount()), "tepe " + threads.getPeakThreadCount()));
        long gcCount = 0, gcMs = 0;
        for (GarbageCollectorMXBean gc : ManagementFactory.getGarbageCollectorMXBeans()) {
            gcCount += Math.max(gc.getCollectionCount(), 0);
            gcMs += Math.max(gc.getCollectionTime(), 0);
        }
        out.add(new Detail("Çöp toplama", gcCount + " kez", "toplam " + gcMs + " ms"));
        out.add(new Detail("JVM çalışma süresi", Probes.duration(Duration.ofMillis(ManagementFactory.getRuntimeMXBean().getUptime())),
            "Java " + Runtime.version().feature()));
        if (dataSource instanceof HikariDataSource hikari && hikari.getHikariPoolMXBean() != null) {
            HikariPoolMXBean pool = hikari.getHikariPoolMXBean();
            out.add(new Detail("Bağlantı havuzu", pool.getActiveConnections() + " aktif · " + pool.getIdleConnections() + " boşta",
                pool.getThreadsAwaitingConnection() > 0 ? pool.getThreadsAwaitingConnection() + " istek bekliyor" : "bekleyen istek yok"));
        }
        return out;
    }
}
