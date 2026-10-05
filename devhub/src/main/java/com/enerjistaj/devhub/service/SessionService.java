package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.realtime.RealtimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Şifre değişince kişinin bütün açık oturumlarını kapatır: oturum sürümü artar (eski token'lar 401 alır) ve açık anlık bildirim
 * bağlantıları kesilir. Kendi şifresini değiştiren kişiye yeni bir token verilir, o tarayıcıdaki oturum sürer.
 * Çağıran, kullanıcıyı kaydetmekten sorumludur.
 */
@Service
@RequiredArgsConstructor
public class SessionService {

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final RealtimeService realtime;
    private final MailService mail;

    public void revokeAll(User user) {
        user.setSessionVersion(user.getSessionVersion() + 1);
        realtime.disconnect(user.getId());
    }

    /**
     * Şifre değişti: oturumları kapatır ve kişiye bilgilendirme e-postası gönderir (şifrenin kendisi asla yazılmaz).
     * Kişi bu değişikliği kendisi yapmadıysa e-postadan haberi olur ve yöneticisine başvurabilir.
     * byAdmin: yönetici geçici şifre verdiyse true.
     */
    public void passwordChanged(User user, boolean byAdmin) {
        revokeAll(user);
        String when = ZonedDateTime.now(ActionLogService.ZONE).format(WHEN);
        String body = byAdmin
            ? "Merhaba " + user.getFullName() + ",\n\n"
                + "DevHub şifreniz " + when + " tarihinde bir yönetici tarafından sıfırlandı. Geçici şifrenizi yöneticinizden alın; "
                + "ilk girişte kendi şifrenizi belirlemeniz istenecek.\n\n"
                + "Güvenliğiniz için bütün cihazlardaki açık oturumlarınız kapatıldı.\n\nDevHub"
            : "Merhaba " + user.getFullName() + ",\n\n"
                + "DevHub şifreniz " + when + " tarihinde değiştirildi. Bu değişikliği yaptığınız cihaz dışındaki bütün oturumlarınız kapatıldı.\n\n"
                + "Bu değişikliği siz yapmadıysanız giriş ekranındaki \"Şifremi unuttum\" ile yeni şifre belirleyin ve hemen yöneticinize haber verin.\n\nDevHub";
        mail.send(user.getEmail(), byAdmin ? "DevHub şifreniz sıfırlandı" : "DevHub şifreniz değiştirildi", body);
    }
}
