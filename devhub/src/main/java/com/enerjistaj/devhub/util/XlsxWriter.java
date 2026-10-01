package com.enerjistaj.devhub.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Bağımlılıksız, tek sayfalık .xlsx üretici (Office Open XML). Başlık satırı sabit ve filtreli, sütun genişlikleri ayarlı,
 * uzun metinler kaydırılır, tarihler gerçek Excel tarihi olarak yazılır. Metinler "inline string" olarak yazıldığından
 * hiçbir hücre formül olarak çalışmaz (CSV'deki formül enjeksiyonu riski yoktur).
 */
public final class XlsxWriter {

    /** Hücre biçimleri: styles.xml'deki cellXfs sırası */
    public static final int TEXT = 2, DATE = 3, NUMBER = 4, CRITICAL = 5, WARNING = 6;
    private static final int HEADER = 1;
    private static final LocalDateTime EXCEL_EPOCH = LocalDateTime.of(1899, 12, 30, 0, 0);

    public record Column(String title, double width, boolean wrap) {}

    /** value: String, Number, LocalDateTime veya null */
    public record Cell(Object value, int style) {
        public static Cell text(String v) { return new Cell(v, TEXT); }
    }

    private XlsxWriter() {}

    public static byte[] write(String sheetName, List<Column> columns, List<List<Cell>> rows) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            put(zip, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>""");
            put(zip, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>""");
            String lastCell = col(columns.size() - 1) + (rows.size() + 1);
            String safeName = xml(sheetName);
            put(zip, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheets><sheet name="%s" sheetId="1" r:id="rId1"/></sheets>
                <definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'%s'!$A$1:$%s$%d</definedName></definedNames>
                </workbook>""".formatted(safeName, safeName, col(columns.size() - 1), rows.size() + 1));
            put(zip, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>""");
            put(zip, "xl/styles.xml", STYLES);
            put(zip, "xl/worksheets/sheet1.xml", sheet(columns, rows, lastCell));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    private static String sheet(List<Column> columns, List<List<Cell>> rows, String lastCell) {
        StringBuilder s = new StringBuilder(64 * 1024);
        s.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
            .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">")
            .append("<dimension ref=\"A1:").append(lastCell).append("\"/>")
            .append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>")
            .append("<sheetFormatPr defaultRowHeight=\"15\"/><cols>");
        for (int i = 0; i < columns.size(); i++) {
            s.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"").append(columns.get(i).width()).append("\" customWidth=\"1\"/>");
        }
        s.append("</cols><sheetData>");
        s.append("<row r=\"1\" ht=\"22\" customHeight=\"1\">");
        for (int i = 0; i < columns.size(); i++) inline(s, col(i) + "1", columns.get(i).title(), HEADER);
        s.append("</row>");
        for (int r = 0; r < rows.size(); r++) {
            List<Cell> row = rows.get(r);
            int n = r + 2;
            s.append("<row r=\"").append(n).append("\" ht=\"").append(15 * lines(columns, row)).append("\" customHeight=\"1\">");
            for (int i = 0; i < row.size(); i++) {
                Cell c = row.get(i);
                String ref = col(i) + n;
                if (c == null || c.value() == null) {
                    s.append("<c r=\"").append(ref).append("\" s=\"").append(c != null ? c.style() : TEXT).append("\"/>");
                } else if (c.value() instanceof LocalDateTime t) {
                    double serial = ChronoUnit.SECONDS.between(EXCEL_EPOCH, t) / 86400.0;
                    s.append("<c r=\"").append(ref).append("\" s=\"").append(DATE).append("\"><v>").append(serial).append("</v></c>");
                } else if (c.value() instanceof Number num) {
                    s.append("<c r=\"").append(ref).append("\" s=\"").append(c.style()).append("\"><v>").append(num).append("</v></c>");
                } else {
                    inline(s, ref, c.value().toString(), c.style());
                }
            }
            s.append("</row>");
        }
        s.append("</sheetData><autoFilter ref=\"A1:").append(lastCell).append("\"/>")
            .append("<pageMargins left=\"0.5\" right=\"0.5\" top=\"0.6\" bottom=\"0.6\" header=\"0.3\" footer=\"0.3\"/>")
            .append("<pageSetup orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"0\"/>")
            .append("</worksheet>");
        return s.toString();
    }

    /** Excel kaydırılan metinde satır yüksekliğini her zaman kendisi ayarlamadığı için tahmini satır sayısı (en fazla 10). */
    private static int lines(List<Column> columns, List<Cell> row) {
        int max = 1;
        for (int i = 0; i < row.size() && i < columns.size(); i++) {
            Cell c = row.get(i);
            if (c == null || !(c.value() instanceof String text) || !columns.get(i).wrap()) continue;
            int perLine = Math.max(1, (int) (columns.get(i).width() * 1.1));
            int count = 0;
            for (String part : text.split("\n", -1)) count += Math.max(1, (int) Math.ceil(part.length() / (double) perLine));
            max = Math.max(max, count);
        }
        return Math.min(max, 10);
    }

    private static void inline(StringBuilder s, String ref, String text, int style) {
        String v = text.length() > 32_000 ? text.substring(0, 32_000) + "…" : text;
        s.append("<c r=\"").append(ref).append("\" t=\"inlineStr\" s=\"").append(style).append("\"><is><t xml:space=\"preserve\">")
            .append(xml(v)).append("</t></is></c>");
    }

    private static String col(int i) {
        StringBuilder b = new StringBuilder();
        for (int n = i + 1; n > 0; n = (n - 1) / 26) b.insert(0, (char) ('A' + (n - 1) % 26));
        return b.toString();
    }

    /** XML kaçışı; XML'de izin verilmeyen kontrol karakterleri atılır. */
    private static String xml(String v) {
        StringBuilder b = new StringBuilder(v.length() + 16);
        for (char ch : v.toCharArray()) {
            switch (ch) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                case '\'' -> b.append("&apos;");
                default -> { if (ch >= 0x20 || ch == '\n' || ch == '\t') b.append(ch); }
            }
        }
        return b.toString();
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    /** Uygulamanın paleti: başlık koyu zeytin (#5A6647) üzerine beyaz; kritik/uyarı satırları seviye hücresinde renkli ve kalın. */
    private static final String STYLES = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy hh:mm:ss"/></numFmts>
        <fonts count="5">
        <font><sz val="11"/><name val="Calibri"/></font>
        <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
        <font><sz val="11"/><color rgb="FF2C2638"/><name val="Calibri"/></font>
        <font><b/><sz val="11"/><color rgb="FF9A3B1B"/><name val="Calibri"/></font>
        <font><b/><sz val="11"/><color rgb="FF6E5210"/><name val="Calibri"/></font>
        </fonts>
        <fills count="5">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF5A6647"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFBEDE5"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFF7ECD0"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="2">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border><left/><right/><top/><bottom style="thin"><color rgb="FFC5D89D"/></bottom><diagonal/></border>
        </borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="7">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
        <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
        <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
        <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
        <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
        </cellXfs>
        <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>""";
}
