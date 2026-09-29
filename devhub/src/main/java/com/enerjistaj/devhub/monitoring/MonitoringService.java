package com.enerjistaj.devhub.monitoring;

import com.enerjistaj.devhub.monitoring.MonitoringDtos.*;
import com.enerjistaj.devhub.monitoring.MonitoringProperties.ServiceDef;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Belirli aralıklarla (varsayılan 10 sn) tüm servisleri örnekler ve son historyMinutes dakikayı bellekte tutar.
 * Geçmiş kalıcı değildir: backend yeniden başlarsa grafikler baştan dolmaya başlar.
 *
 * Servis listesi = ayarlardaki tanımlar + compose projesinde bulunup tanımlanmamış konteynerler (otomatik keşif).
 */
@Slf4j
@Service
public class MonitoringService {

    private final MonitoringProperties props;
    private final DockerClient docker;
    private final Map<String, HealthCheck> checks;
    private final Map<String, MetricProbe> probes;
    private final Map<String, ServiceState> states = new ConcurrentHashMap<>();
    private volatile Host host = new Host(false, "Henüz örnek alınmadı", null, null, null, null, null, null);
    private volatile long sampledAt;
    private boolean dockerErrorLogged;

    public MonitoringService(MonitoringProperties props, DockerClient docker, List<HealthCheck> checks, List<MetricProbe> probes) {
        this.props = props;
        this.docker = docker;
        this.checks = checks.stream().collect(Collectors.toMap(c -> c.type().toUpperCase(Locale.ROOT), Function.identity()));
        this.probes = probes.stream().collect(Collectors.toMap(p -> p.type().toUpperCase(Locale.ROOT), Function.identity()));
    }

    @Scheduled(initialDelay = 3, fixedDelayString = "${devhub.monitoring.sample-seconds:10}", timeUnit = TimeUnit.SECONDS)
    public void sample() {
        long now = System.currentTimeMillis();
        Map<String, Map<String, Object>> containers = new HashMap<>();
        Double hostMemMb = null;
        try {
            Map<String, Object> info = docker.info();
            hostMemMb = Probes.num(info.get("MemTotal")) / 1024 / 1024;
            host = new Host(true, null, (String) info.get("ServerVersion"), (String) info.get("OperatingSystem"),
                (int) Probes.num(info.get("NCPU")), hostMemMb,
                (int) Probes.num(info.get("ContainersRunning")), (int) Probes.num(info.get("Containers")));
            for (Map<String, Object> c : docker.containers(props.composeProject())) {
                containers.put(containerName(c), c);
            }
            dockerErrorLogged = false;
        } catch (Exception e) {
            host = new Host(false, Probes.reason(e), null, null, null, null, null, null);
            if (!dockerErrorLogged) log.warn("Docker izleme vekiline ulaşılamadı ({}): {}", props.dockerUrl(), Probes.reason(e));
            dockerErrorLogged = true;
        }

        Set<String> seen = new HashSet<>();
        for (ServiceDef def : definitions(containers)) {
            seen.add(def.id());
            try {
                sampleService(def, containers.get(def.container()), hostMemMb, now);
            } catch (Exception e) {
                log.debug("{} örneklenemedi: {}", def.id(), Probes.reason(e));
            }
        }
        states.keySet().retainAll(seen);
        sampledAt = now;
    }

    public Overview overview(int minutes) {
        long from = System.currentTimeMillis() - minutes * 60_000L;
        Map<String, Integer> order = new HashMap<>();
        props.services().forEach(d -> order.put(d.id(), order.size()));
        List<MonitoringDtos.Service> list = states.values().stream()
            .sorted(Comparator.comparing((ServiceState s) -> order.getOrDefault(s.def.id(), Integer.MAX_VALUE)).thenComparing(s -> s.def.name()))
            .map(s -> s.snapshot(from))
            .filter(Objects::nonNull)
            .toList();
        return new Overview(sampledAt, props.sampleSeconds(), props.historyMinutes(), props.warnPercent(), host, list);
    }

    // ------------------------------------------------------------------

    private List<ServiceDef> definitions(Map<String, Map<String, Object>> containers) {
        List<ServiceDef> defs = new ArrayList<>(props.services());
        Set<String> configured = defs.stream().map(ServiceDef::container).filter(Objects::nonNull).collect(Collectors.toSet());
        containers.forEach((name, c) -> {
            if (configured.contains(name)) return;
            String service = (String) Probes.map(c.get("Labels")).getOrDefault("com.docker.compose.service", name);
            defs.add(new ServiceDef("auto-" + name, service, "Konteyner", "Compose projesinde bulundu; ayarlarda tanımlı değil.", name, null, null, null));
        });
        return defs;
    }

    private void sampleService(ServiceDef def, Map<String, Object> container, Double hostMemMb, long now) {
        ServiceState st = states.computeIfAbsent(def.id(), id -> new ServiceState(def));
        st.def = def;
        Snapshot snap = new Snapshot();
        snap.configured = !def.id().startsWith("auto-");

        if (container != null) {
            snap.image = (String) container.get("Image");
            snap.state = (String) container.get("State");
            snap.statusText = (String) container.get("Status");
            if ("running".equals(snap.state)) {
                String id = (String) container.get("Id");
                Map<String, Object> inspect = docker.inspect(id);
                Map<String, Object> state = Probes.map(inspect.get("State"));
                snap.restartCount = (int) Probes.num(inspect.get("RestartCount"));
                snap.startedAt = parseTime(state.get("StartedAt"));
                snap.dockerHealth = (String) Probes.map(state.get("Health")).get("Status");
                st.readStats(docker.stats(id), snap, hostMemMb, now);
            } else {
                st.resetCounters();
            }
        }

        if (def.check() != null && !def.check().isBlank()) {
            HealthCheck check = checks.get(def.check().toUpperCase(Locale.ROOT));
            snap.check = check == null
                ? new Check(def.check(), def.target(), false, 0, "Bilinmeyen kontrol türü: " + def.check())
                : toCheck(def, check.check(def));
        }
        if (def.probe() != null && !def.probe().isBlank() && (container == null || "running".equals(snap.state))) {
            MetricProbe probe = probes.get(def.probe().toUpperCase(Locale.ROOT));
            if (probe != null) snap.details = probe.collect(def);
        }

        evaluate(def, container, snap);
        st.latest = snap;
        st.add(new Sample(now, snap.cpuPercent, snap.memUsedMb, snap.memPercent, snap.netRxRate, snap.netTxRate,
            snap.check != null ? snap.check.latencyMs() : null, snap.status), props.historyMinutes());
    }

    /** Durum kuralları: DOWN > WARN > UP. Nedenler kullanıcıya gösterilir. */
    private void evaluate(ServiceDef def, Map<String, Object> container, Snapshot s) {
        List<String> down = new ArrayList<>(), warn = new ArrayList<>();
        boolean dockerKnown = host.dockerAvailable();
        if (def.container() != null && dockerKnown) {
            if (container == null) down.add("Konteyner bulunamadı (" + def.container() + ")");
            else if (!"running".equals(s.state)) down.add("Konteyner çalışmıyor: " + s.statusText);
        }
        if ("unhealthy".equals(s.dockerHealth)) down.add("Docker sağlık kontrolü başarısız");
        if ("starting".equals(s.dockerHealth)) warn.add("Docker sağlık kontrolü henüz tamamlanmadı");
        if (s.check != null && !s.check.up()) down.add("Sağlık kontrolü başarısız: " + s.check.message());
        if (s.check != null && s.check.up() && s.check.latencyMs() > props.slowLatencyMs()) warn.add("Sağlık kontrolü yavaş (" + s.check.latencyMs() + " ms)");
        if (s.cpuPercent != null && s.cpuPercent >= props.warnPercent()) warn.add(String.format(Locale.ROOT, "CPU kullanımı yüksek (%%%.0f)", s.cpuPercent));
        if (s.memPercent != null && s.memLimited && s.memPercent >= props.warnPercent()) warn.add(String.format(Locale.ROOT, "Bellek sınıra yakın (%%%.0f)", s.memPercent));
        if (s.startedAt != null && s.restartCount != null && s.restartCount > 0 && System.currentTimeMillis() - s.startedAt < 10 * 60_000)
            warn.add("Son 10 dakikada yeniden başladı (" + s.restartCount + ". kez)");

        s.reasons = !down.isEmpty() ? down : warn;
        if (!down.isEmpty()) s.status = Status.DOWN;
        else if (!warn.isEmpty()) s.status = Status.WARN;
        else if (s.check == null && (container == null || !dockerKnown)) s.status = Status.UNKNOWN;
        else s.status = Status.UP;
        if (s.status == Status.UNKNOWN) s.reasons = List.of(dockerKnown ? "Bu servis için kontrol tanımlı değil" : "Docker bilgisine ulaşılamıyor");
    }

    private static Check toCheck(ServiceDef def, HealthCheck.Result r) {
        return new Check(def.check().toUpperCase(Locale.ROOT), def.target(), r.up(), r.latencyMs(), r.message());
    }

    private static String containerName(Map<String, Object> c) {
        List<Object> names = Probes.list(c.get("Names"));
        String n = names.isEmpty() ? (String) c.get("Id") : String.valueOf(names.get(0));
        return n.startsWith("/") ? n.substring(1) : n;
    }

    private static Long parseTime(Object v) {
        try {
            return v == null ? null : Instant.parse(v.toString()).toEpochMilli();
        } catch (Exception e) {
            return null;
        }
    }

    // ------------------------------------------------------------------

    private static final class Snapshot {
        boolean configured;
        String image, state, statusText, dockerHealth;
        Long startedAt;
        Integer restartCount, pids;
        Double cpuPercent, memUsedMb, memLimitMb, memPercent, netRxRate, netTxRate, diskReadRate, diskWriteRate;
        boolean memLimited;
        Check check;
        List<MetricProbe.Detail> details = List.of();
        Status status = Status.UNKNOWN;
        List<String> reasons = List.of();
    }

    /** Servis başına son örnek, sayaçlar (CPU/ağ/disk farkları için) ve halka tampon geçmiş. */
    private static final class ServiceState {
        volatile ServiceDef def;
        volatile Snapshot latest;
        private final Deque<Sample> history = new ArrayDeque<>();
        private double lastCpuTotal = -1, lastSystemCpu = -1, lastRx = -1, lastTx = -1, lastRead = -1, lastWrite = -1;
        private long lastAt;

        ServiceState(ServiceDef def) {
            this.def = def;
        }

        void resetCounters() {
            lastCpuTotal = lastSystemCpu = lastRx = lastTx = lastRead = lastWrite = -1;
        }

        void readStats(Map<String, Object> stats, Snapshot s, Double hostMemMb, long now) {
            Map<String, Object> cpu = Probes.map(stats.get("cpu_stats"));
            double total = Probes.num(Probes.map(cpu.get("cpu_usage")).get("total_usage"));
            double system = Probes.num(cpu.get("system_cpu_usage"));
            double cpus = Math.max(1, Probes.num(cpu.get("online_cpus")));
            if (lastCpuTotal >= 0 && system > lastSystemCpu && total >= lastCpuTotal) {
                s.cpuPercent = round((total - lastCpuTotal) / (system - lastSystemCpu) * cpus * 100);
            }

            Map<String, Object> mem = Probes.map(stats.get("memory_stats"));
            Map<String, Object> memStats = Probes.map(mem.get("stats"));
            // Sayfa önbelleği (inactive_file) kullanılan bellekten düşülür; docker stats ile aynı hesap.
            double cache = memStats.containsKey("inactive_file") ? Probes.num(memStats.get("inactive_file")) : Probes.num(memStats.get("total_inactive_file"));
            double usage = Math.max(0, Probes.num(mem.get("usage")) - cache);
            double limit = Probes.num(mem.get("limit"));
            if (limit > 0) {
                s.memUsedMb = round(usage / 1024 / 1024);
                s.memLimitMb = round(limit / 1024 / 1024);
                s.memPercent = round(usage / limit * 100);
                s.memLimited = hostMemMb == null || s.memLimitMb < hostMemMb - 1;
            }

            double rx = 0, tx = 0;
            for (Object n : Probes.map(stats.get("networks")).values()) {
                rx += Probes.num(Probes.map(n).get("rx_bytes"));
                tx += Probes.num(Probes.map(n).get("tx_bytes"));
            }
            double read = 0, write = 0;
            for (Object e : Probes.list(Probes.map(stats.get("blkio_stats")).get("io_service_bytes_recursive"))) {
                Map<String, Object> entry = Probes.map(e);
                String op = String.valueOf(entry.get("op")).toLowerCase(Locale.ROOT);
                if (op.equals("read")) read += Probes.num(entry.get("value"));
                if (op.equals("write")) write += Probes.num(entry.get("value"));
            }
            double secs = (now - lastAt) / 1000.0;
            if (lastRx >= 0 && secs > 0) {
                s.netRxRate = round(Math.max(0, rx - lastRx) / secs);
                s.netTxRate = round(Math.max(0, tx - lastTx) / secs);
                s.diskReadRate = round(Math.max(0, read - lastRead) / secs);
                s.diskWriteRate = round(Math.max(0, write - lastWrite) / secs);
            }
            s.pids = (int) Probes.num(Probes.map(stats.get("pids_stats")).get("current"));

            lastCpuTotal = total;
            lastSystemCpu = system;
            lastRx = rx;
            lastTx = tx;
            lastRead = read;
            lastWrite = write;
            lastAt = now;
        }

        synchronized void add(Sample sample, int historyMinutes) {
            history.addLast(sample);
            long cutoff = sample.t() - historyMinutes * 60_000L;
            while (!history.isEmpty() && history.peekFirst().t() < cutoff) history.removeFirst();
        }

        synchronized MonitoringDtos.Service snapshot(long from) {
            Snapshot s = latest;
            if (s == null) return null;
            List<Sample> h = history.stream().filter(x -> x.t() >= from).toList();
            return new MonitoringDtos.Service(def.id(), def.name(), def.kind(), def.description(), s.configured,
                def.container(), s.image, s.state, s.statusText, s.startedAt, s.restartCount, s.dockerHealth,
                s.status, s.reasons, s.cpuPercent, s.memUsedMb, s.memLimitMb, s.memPercent, s.memLimited,
                s.netRxRate, s.netTxRate, s.diskReadRate, s.diskWriteRate, s.pids, s.check, s.details, h);
        }

        private static double round(double v) {
            return Math.round(v * 100) / 100.0;
        }
    }
}
