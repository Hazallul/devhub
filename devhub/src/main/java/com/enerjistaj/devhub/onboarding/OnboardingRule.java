package com.enerjistaj.devhub.onboarding;

/** Adımın kendiliğinden tamamlanma kuralı. */
public enum OnboardingRule {
    /** Kişi geçici şifresini kendi şifresiyle değiştirdi */
    SIFRE,
    /** Profiline en az bir iletişim bilgisi ekledi */
    ILETISIM,
    /** Adımın bağlantısındaki dokümanı (/docs/{slug}) açtı */
    DOKUMAN
}
