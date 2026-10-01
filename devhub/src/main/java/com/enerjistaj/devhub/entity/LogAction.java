package com.enerjistaj.devhub.entity;

/** Log kaydındaki işlem türü (filtrelemede ve raporlamada kullanılır). label: Türkçe ad (frontend: LOG_ACTION). */
public enum LogAction {
    GIRIS("Giriş"), GIRIS_BASARISIZ("Başarısız giriş"), CIKIS("Çıkış"), SIFRE_DEGISTIRME("Şifre değişikliği"), SIFRE_SIFIRLAMA("Şifre sıfırlama"),
    OLUSTURMA("Oluşturma"), GUNCELLEME("Güncelleme"), SILME("Silme"), TAMAMLAMA("Tamamlama"), YORUM("Yorum"),
    DURUM_DEGISIKLIGI("Durum değişikliği"), PROJE_ATAMA("Projeye atama"), PROJEDEN_CIKARMA("Projeden çıkarma"), GOREV_AKTARMA("Görev aktarma"),
    AKTIFLESTIRME("Hesap açma"), PASIFLESTIRME("Hesap kapatma"), YETKI_DEGISIKLIGI("Yetki değişikliği"),
    TALEP("Talep"), ONAY("Onay"), RET("Ret"), GERI_ALMA("Karar geri alma"), KESINLESTIRME("Kesinleştirme"), GERI_CEKME("Geri çekme"),
    KAYIT("Yönetici kaydı"), YAYIN("Yayın"), BILGI("Bilgi");

    private final String label;

    LogAction(String label) { this.label = label; }

    public String label() { return label; }
}
