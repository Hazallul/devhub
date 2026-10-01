package com.enerjistaj.devhub.docs;

import com.enerjistaj.devhub.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Editörden gelen içeriği (ProseMirror JSON) doğrular ve düz metnini çıkarır. Yalnızca editörün ürettiği düğüm ve biçimlere
 * izin verilir; bağlantılar yalnızca http(s)/mailto/tel ya da site içi adres, görseller yalnızca yüklenen görseller veya https olabilir.
 */
final class DocContent {

    static final Set<String> CATEGORIES = Set.of("baslarken", "surecler", "mimari", "kalite");

    private static final Set<String> NODES = Set.of("doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem",
        "codeBlock", "callout", "table", "tableRow", "tableHeader", "tableCell", "image", "horizontalRule", "hardBreak");
    private static final Set<String> MARKS = Set.of("bold", "italic", "underline", "strike", "code", "link", "highlight");
    private static final Set<String> CALLOUTS = Set.of("NOT", "IPUCU", "UYARI", "ONEMLI");
    private static final Pattern LANG = Pattern.compile("[a-z0-9+#-]{0,20}");
    private static final Pattern HREF = Pattern.compile("^(https?://|mailto:|tel:|/(?!/)|#).*", Pattern.CASE_INSENSITIVE);
    static final String IMAGE_PATH = "/api/docs/images/";
    private static final int MAX_DEPTH = 40, MAX_NODES = 40_000;

    private DocContent() {}

    /** Geçerli içeriğin düz metni (arama için). Geçersizse ApiException. */
    static String validate(Object content) {
        if (!(content instanceof Map<?, ?> root) || !"doc".equals(root.get("type"))) throw invalid("içerik biçimi tanınmadı");
        StringBuilder text = new StringBuilder();
        int[] count = {0};
        boolean[] media = {false};
        walk(root, 0, text, count, media);
        String plain = text.toString().replaceAll("\\s+", " ").trim();
        if (plain.isEmpty() && !media[0]) throw ApiException.badRequest("Doküman içeriği boş olamaz.");
        return plain;
    }

    private static void walk(Map<?, ?> node, int depth, StringBuilder text, int[] count, boolean[] media) {
        if (depth > MAX_DEPTH || ++count[0] > MAX_NODES) throw invalid("içerik çok büyük veya çok iç içe");
        Object type = node.get("type");
        if (!(type instanceof String t) || !NODES.contains(t)) throw invalid("desteklenmeyen öğe: " + type);
        Map<?, ?> attrs = node.get("attrs") instanceof Map<?, ?> a ? a : Map.of();
        switch (t) {
            case "text" -> {
                if (!(node.get("text") instanceof String s)) throw invalid("metin eksik");
                text.append(s);
                if (node.get("marks") instanceof List<?> marks) {
                    for (Object m : marks) checkMark(m);
                } else if (node.get("marks") != null) {
                    throw invalid("biçim listesi bozuk");
                }
            }
            case "heading" -> {
                Object level = attrs.get("level");
                if (!(level instanceof Number n) || n.intValue() < 2 || n.intValue() > 3) throw invalid("başlık düzeyi");
            }
            case "callout" -> {
                if (!CALLOUTS.contains(String.valueOf(attrs.get("kind")))) throw invalid("bilgi kutusu türü");
            }
            case "codeBlock" -> {
                Object lang = attrs.get("language");
                if (lang != null && !LANG.matcher(lang.toString()).matches()) throw invalid("kod dili");
            }
            case "image" -> {
                String src = String.valueOf(attrs.get("src"));
                if (!src.startsWith(IMAGE_PATH) && !src.startsWith("https://")) throw invalid("görsel adresi");
                media[0] = true;
            }
            case "table", "horizontalRule" -> media[0] = true;
            default -> { }
        }
        if (node.get("content") instanceof List<?> children) {
            for (Object c : children) {
                if (!(c instanceof Map<?, ?> child)) throw invalid("içerik bozuk");
                walk(child, depth + 1, text, count, media);
            }
        } else if (node.get("content") != null) {
            throw invalid("içerik bozuk");
        }
        if (!"text".equals(t)) text.append(' ');
    }

    private static void checkMark(Object m) {
        if (!(m instanceof Map<?, ?> mark) || !(mark.get("type") instanceof String t) || !MARKS.contains(t)) throw invalid("desteklenmeyen biçim");
        if ("link".equals(t)) {
            Object href = mark.get("attrs") instanceof Map<?, ?> a ? a.get("href") : null;
            if (!(href instanceof String h) || !HREF.matcher(h.trim()).matches()) {
                throw ApiException.badRequest("Bağlantı adresi http(s)://, mailto: veya / ile başlamalı.");
            }
        }
    }

    private static ApiException invalid(String what) {
        return ApiException.badRequest("Doküman içeriği geçersiz (" + what + ").");
    }

    private static final Map<Character, String> TR = Map.ofEntries(
        Map.entry('ç', "c"), Map.entry('ğ', "g"), Map.entry('ı', "i"), Map.entry('İ', "i"), Map.entry('ö', "o"), Map.entry('ş', "s"),
        Map.entry('ü', "u"), Map.entry('Ç', "c"), Map.entry('Ğ', "g"), Map.entry('Ö', "o"), Map.entry('Ş', "s"), Map.entry('Ü', "u"));

    /** "Git Akışı ve Branch" -> "git-akisi-ve-branch" (frontend'deki slugify ile aynı kural) */
    static String slugify(String text) {
        StringBuilder sb = new StringBuilder();
        for (char ch : text.toCharArray()) sb.append(TR.getOrDefault(ch, String.valueOf(ch)));
        String s = sb.toString().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (s.length() > 100) s = s.substring(0, 100).replaceAll("-+$", "");
        return s.isEmpty() ? "dokuman" : s;
    }

    static List<String> tags(String joined) {
        return joined == null || joined.isBlank() ? List.of() : List.of(joined.split(","));
    }
}
