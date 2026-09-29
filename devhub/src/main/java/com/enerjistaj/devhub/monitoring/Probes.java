package com.enerjistaj.devhub.monitoring;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** İzleme sınıflarının ortak küçük yardımcıları. */
final class Probes {

    private Probes() {}

    static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    static String reason(Throwable e) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        String msg = root.getMessage();
        return msg == null || msg.isBlank() ? root.getClass().getSimpleName() : msg;
    }

    static String mb(double bytes) {
        return String.format(Locale.ROOT, "%.0f MB", bytes / 1024 / 1024);
    }

    /** "3 gün 4 sa", "2 sa 5 dk", "12 dk" */
    static String duration(Duration d) {
        long days = d.toDays(), hours = d.toHoursPart(), mins = d.toMinutesPart();
        if (days > 0) return days + " gün " + hours + " sa";
        if (hours > 0) return hours + " sa " + mins + " dk";
        return Math.max(mins, 0) + " dk";
    }

    static double num(Object v) {
        return v instanceof Number n ? n.doubleValue() : 0;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Object v) {
        return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    @SuppressWarnings("unchecked")
    static List<Object> list(Object v) {
        return v instanceof List<?> l ? (List<Object>) l : List.of();
    }
}
