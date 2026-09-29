package com.enerjistaj.devhub.dto;

import com.enerjistaj.devhub.exception.ApiException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Map olarak alınan istek gövdelerinden alanları doğrulayarak okur.
 * Kısmi güncellemelerde alanın gövdede olup olmadığı (containsKey) ayrıca kontrol edilir.
 */
public final class Payloads {

    private Payloads() {}

    /** Kırpılmış metin; alan yoksa veya boşsa null. */
    public static String text(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }

    public static String requiredText(Map<String, Object> body, String key, String emptyMessage, int maxLength, String label) {
        String s = text(body, key);
        if (s == null) throw ApiException.badRequest(emptyMessage);
        return limit(s, maxLength, label);
    }

    public static String optionalText(Map<String, Object> body, String key, int maxLength, String label) {
        String s = text(body, key);
        return s == null ? null : limit(s, maxLength, label);
    }

    public static LocalDate date(Map<String, Object> body, String key, String label) {
        String s = text(body, key);
        if (s == null) return null;
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(label + " geçerli bir tarih olmalı (yyyy-AA-gg).");
        }
    }

    public static <E extends Enum<E>> E enumValue(Map<String, Object> body, String key, Class<E> type, String label) {
        String s = text(body, key);
        if (s == null) return null;
        try {
            return Enum.valueOf(type, s);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Geçersiz " + label + ": " + s);
        }
    }

    public static boolean flag(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(v));
    }

    private static String limit(String s, int maxLength, String label) {
        if (s.length() > maxLength) throw ApiException.badRequest(label + " en fazla " + maxLength + " karakter olabilir.");
        return s;
    }
}
