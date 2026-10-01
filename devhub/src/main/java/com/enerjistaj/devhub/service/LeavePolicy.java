package com.enerjistaj.devhub.service;

import java.time.LocalDate;
import java.time.Period;

/**
 * Yıllık ücretli izin hakkı (İş Kanunu md. 53), işe giriş tarihinden kendiliğinden hesaplanır:
 * kıdem 1 yıldan azsa 0, 1–5 yıl 14, 5–15 yıl 20, 15 yıl ve üzeri 26 iş günü.
 * Hak, kıdem yıldönümünde kendiliğinden artar; elle girilmez. İşe giriş tarihi yoksa hak 0'dır.
 */
public final class LeavePolicy {

    private static final int[][] STEPS = {{1, 14}, {5, 20}, {15, 26}}; // {kıdem yılı, gün}

    private LeavePolicy() {}

    public static int entitlement(LocalDate hireDate, LocalDate asOf) {
        if (hireDate == null || asOf.isBefore(hireDate)) return 0;
        int years = Period.between(hireDate, asOf).getYears();
        int days = 0;
        for (int[] step : STEPS) if (years >= step[0]) days = step[1];
        return days;
    }

    /** Bir sonraki artış: tarih ve o tarihten itibaren geçerli hak; artış kalmadıysa null. */
    public static Next next(LocalDate hireDate, LocalDate asOf) {
        if (hireDate == null) return null;
        for (int[] step : STEPS) {
            LocalDate at = hireDate.plusYears(step[0]);
            if (at.isAfter(asOf)) return new Next(at, step[1]);
        }
        return null;
    }

    public record Next(LocalDate date, int days) {}
}
