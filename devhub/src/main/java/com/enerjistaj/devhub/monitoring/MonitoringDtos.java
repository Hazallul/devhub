package com.enerjistaj.devhub.monitoring;

import java.util.List;

/** Sistem İzleme API yanıtları. Zamanlar epoch milisaniye; boyutlar MB, hızlar bayt/sn. */
public final class MonitoringDtos {

    private MonitoringDtos() {}

    public enum Status { UP, WARN, DOWN, UNKNOWN }

    public record Overview(long sampledAt, int sampleSeconds, int historyMinutes, double warnPercent, Host host, List<Service> services) {}

    /** Docker motoru (Kubernetes'teki düğüm karşılığı). dockerError doluysa kaynak metrikleri yoktur. */
    public record Host(boolean dockerAvailable, String dockerError, String serverVersion, String operatingSystem,
                       Integer cpus, Double memTotalMb, Integer containersRunning, Integer containersTotal) {}

    public record Service(
        String id, String name, String kind, String description, boolean configured,
        String container, String image, String state, String statusText, Long startedAt, Integer restartCount, String dockerHealth,
        Status status, List<String> reasons,
        Double cpuPercent, Double memUsedMb, Double memLimitMb, Double memPercent, boolean memLimited,
        Double netRxRate, Double netTxRate, Double diskReadRate, Double diskWriteRate, Integer pids,
        Check check, List<MetricProbe.Detail> details, List<Sample> history) {}

    public record Check(String type, String target, boolean up, long latencyMs, String message) {}

    /** Geçmiş noktası; konteyner çalışmıyorsa değerler null (grafikte boşluk). */
    public record Sample(long t, Double cpu, Double memMb, Double memPct, Double rx, Double tx, Long latency, Status status) {}
}
