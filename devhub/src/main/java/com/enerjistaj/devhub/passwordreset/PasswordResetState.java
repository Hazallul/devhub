package com.enerjistaj.devhub.passwordreset;

/** KOD_BEKLIYOR → (kod doğru + yeni şifre) ONAY_BEKLIYOR → ONAYLANDI / REDDEDILDI. */
public enum PasswordResetState { KOD_BEKLIYOR, ONAY_BEKLIYOR, ONAYLANDI, REDDEDILDI, IPTAL, SURESI_DOLDU }
