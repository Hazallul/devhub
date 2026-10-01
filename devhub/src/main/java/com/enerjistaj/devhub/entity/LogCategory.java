package com.enerjistaj.devhub.entity;

/** Sistem logu kategorisi: kaydın hangi modülle ilgili olduğu. label: dışa aktarmada görünen Türkçe ad (frontend: LOG_CATEGORY). */
public enum LogCategory {
    OTURUM("Oturum"), KULLANICI("Kullanıcı"), PROFIL("Profil"), PROJE("Proje"), GOREV("Görev"), IZIN("İzin"),
    DUYURU("Duyuru"), DOKUMAN("Doküman"), SISTEM("Sistem");

    private final String label;

    LogCategory(String label) { this.label = label; }

    public String label() { return label; }
}
