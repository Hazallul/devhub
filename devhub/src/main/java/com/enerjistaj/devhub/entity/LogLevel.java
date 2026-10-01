package com.enerjistaj.devhub.entity;

/** Log kaydının önemi. */
public enum LogLevel {
    BILGI("Bilgi"), UYARI("Uyarı"), KRITIK("Kritik");

    private final String label;

    LogLevel(String label) { this.label = label; }

    public String label() { return label; }
}
