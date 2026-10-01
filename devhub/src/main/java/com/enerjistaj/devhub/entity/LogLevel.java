package com.enerjistaj.devhub.entity;

/** Log kaydının önemi. */
public enum LogLevel {
    /** Olağan işlem */
    BILGI,
    /** Dikkat edilmesi gereken: başarısız giriş, silme, kararın geri alınması */
    UYARI,
    /** Güvenlik açısından önemli: yetki değişikliği, hesap pasifleştirme, şifre sıfırlama */
    KRITIK
}
