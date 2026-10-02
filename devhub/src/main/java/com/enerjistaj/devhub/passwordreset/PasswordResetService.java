package com.enerjistaj.devhub.passwordreset;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.realtime.RealtimeService;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.MailService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Şifremi unuttum akışı:
 * 1) request: e-postaya 6 haneli kod gider (kayıtlı olmayan adres için de aynı yanıt döner, hesap varlığı sızmaz),
 * 2) verify: kod denetlenir (5 yanlış denemede talep düşer),
 * 3) complete: kod + yeni şifre; talep yönetici onayına düşer, eski şifre onaya kadar geçerli kalır,
 * 4) decide: yönetici onaylarsa yeni şifre geçerli olur, kişiye e-posta gider.
 * Kod ve şifreler düz metin olarak hiçbir yerde saklanmaz ya da loglanmaz.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    static final int CODE_MINUTES = 15;
    static final int MAX_ATTEMPTS = 5;
    /** Aynı hesap için en fazla bu kadar talep / saat */
    static final int MAX_PER_HOUR = 5;
    private static final List<PasswordResetState> OPEN = List.of(PasswordResetState.KOD_BEKLIYOR, PasswordResetState.ONAY_BEKLIYOR);
    private static final List<PasswordResetState> DECIDED = List.of(PasswordResetState.ONAYLANDI, PasswordResetState.REDDEDILDI);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PasswordResetRepository requests;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final NotificationService notifications;
    private final ActionLogService actionLog;
    private final RealtimeService realtime;
    private final SessionService sessions;

    @Transactional
    public void request(String rawEmail) {
        String email = normalize(rawEmail);
        Optional<User> found = users.findByEmail(email).filter(User::isActive);
        if (found.isEmpty()) {
            // Aynı yanıt ve yaklaşık aynı süre (BCrypt kayıtlı adreste de çalışır): adresin kayıtlı olup olmadığı anlaşılmaz.
            encoder.encode("000000");
            return;
        }
        User user = found.get();
        LocalDateTime now = LocalDateTime.now();
        // Art arda basılırsa yeni kod üretilmez (son kod hâlâ geçerli); saatlik üst sınır da var.
        Optional<PasswordResetRequest> last = requests.findFirstByUserIdOrderByCreatedAtDesc(user.getId());
        if (last.isPresent() && last.get().getState() == PasswordResetState.KOD_BEKLIYOR && last.get().getCreatedAt().isAfter(now.minusSeconds(45))) return;
        if (requests.countByUserIdAndCreatedAtAfter(user.getId(), now.minusHours(1)) >= MAX_PER_HOUR) return;

        requests.findByUserIdAndStateIn(user.getId(), OPEN).forEach(old -> {
            old.setState(PasswordResetState.IPTAL);
            old.setNewPasswordHash(null);
        });

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        PasswordResetRequest r = new PasswordResetRequest();
        r.setUser(user);
        r.setCodeHash(encoder.encode(code));
        r.setCodeExpiresAt(now.plusMinutes(CODE_MINUTES));
        r.setRequestIp(ActionLogService.clientIp());
        requests.save(r);

        actionLog.record(LogCategory.OTURUM, LogAction.SIFRE_SIFIRLAMA, "Şifre sıfırlama kodu istendi")
                .target("KULLANICI", user.getId(), user.getFullName()).detail("Doğrulama kodu e-postayla gönderildi").save();
        mail.send(user.getEmail(), "DevHub doğrulama kodunuz: " + code,
                "Merhaba " + user.getFullName() + ",\n\n"
                + "Şifre sıfırlama doğrulama kodunuz: " + code + "\n\n"
                + "Kod " + CODE_MINUTES + " dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.\n\n"
                + "DevHub");
    }

    /** Kod doğruysa 204; değilse 400 (kayıtlı olmayan adresle aynı mesaj). */
    @Transactional(noRollbackFor = ApiException.class)
    public void verify(String rawEmail, String code) {
        PasswordResetRequest r = checkCode(rawEmail, code);
        if (r.getVerifiedAt() == null) r.setVerifiedAt(LocalDateTime.now());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void complete(String rawEmail, String code, String newPassword) {
        PasswordResetRequest r = checkCode(rawEmail, code);
        User user = r.getUser();
        if (newPassword == null || newPassword.length() < 8 || !newPassword.matches(".*[A-Za-zÇĞİÖŞÜçğıöşü].*") || !newPassword.matches(".*\\d.*")) {
            throw ApiException.badRequest("Yeni şifre en az 8 karakter olmalı ve harf ile rakam içermeli.");
        }
        if (newPassword.length() > 72) throw ApiException.badRequest("Şifre en fazla 72 karakter olabilir.");
        if (encoder.matches(newPassword, user.getPasswordHash())) throw ApiException.badRequest("Yeni şifre mevcut şifreyle aynı olamaz.");

        LocalDateTime now = LocalDateTime.now();
        if (r.getVerifiedAt() == null) r.setVerifiedAt(now);
        r.setNewPasswordHash(encoder.encode(newPassword));
        r.setState(PasswordResetState.ONAY_BEKLIYOR);
        requests.save(r);

        actionLog.record(LogCategory.OTURUM, LogAction.TALEP, "Şifre sıfırlama talep edildi").by(user).level(LogLevel.UYARI)
                .target("SIFRE_TALEBI", r.getId(), user.getFullName())
                .detail("E-posta kodu doğrulandı, yönetici onayı bekleniyor").save();
        notifications.notifyAdmins(user, NotificationType.PASSWORD_RESET_REQUESTED, user.getFullName() + " şifre sıfırlama istedi",
                "E-postasına gelen kodu doğruladı. Onaylarsanız yeni şifresi geçerli olur.", "/users");
        realtime.invalidate(List.of("password-resets"), null);
        mail.send(user.getEmail(), "DevHub şifre sıfırlama talebiniz alındı",
                "Merhaba " + user.getFullName() + ",\n\n"
                + "Şifre sıfırlama talebiniz yöneticiye iletildi. Onaylandığında yeni şifrenizle giriş yapabilirsiniz; "
                + "o zamana kadar eski şifreniz geçerlidir.\n\nDevHub");
    }

    public List<PasswordResetRequest> pending() {
        return requests.findByStateOrderByCreatedAtDesc(PasswordResetState.ONAY_BEKLIYOR);
    }

    public List<PasswordResetRequest> recentDecided() {
        return requests.findTop30ByStateInOrderByDecidedAtDesc(DECIDED);
    }

    public long pendingCount() {
        return requests.countByState(PasswordResetState.ONAY_BEKLIYOR);
    }

    @Transactional
    public PasswordResetRequest decide(User admin, Long id, boolean approve, String note) {
        PasswordResetRequest r = requests.findById(id).orElseThrow(() -> ApiException.notFound("Talep"));
        if (r.getState() != PasswordResetState.ONAY_BEKLIYOR) throw ApiException.conflict("Bu talep zaten sonuçlandırılmış.");
        User user = r.getUser();
        if (user.getId().equals(admin.getId())) throw ApiException.forbidden("Kendi şifre sıfırlama talebinizi başka bir yönetici onaylamalı.");

        r.setState(approve ? PasswordResetState.ONAYLANDI : PasswordResetState.REDDEDILDI);
        r.setDecisionNote(note);
        r.setDecidedBy(admin);
        r.setDecidedAt(LocalDateTime.now());
        if (approve) {
            user.setPasswordHash(r.getNewPasswordHash());
            user.setMustChangePassword(false);
            sessions.revokeAll(user);
            users.save(user);
        }
        r.setNewPasswordHash(null); // karar verildi: bekleyen özet artık tutulmaz
        PasswordResetRequest saved = requests.save(r);

        actionLog.record(LogCategory.KULLANICI, approve ? LogAction.ONAY : LogAction.RET,
                (approve ? "Şifre sıfırlama onaylandı: " : "Şifre sıfırlama reddedildi: ") + user.getFullName()).by(admin)
                .level(approve ? LogLevel.KRITIK : LogLevel.UYARI).target("SIFRE_TALEBI", saved.getId(), user.getFullName())
                .detail(note != null ? "Açıklama: " + note : null)
                .detail(approve ? "Yeni şifre geçerli oldu, açık oturumları kapatıldı" : "Eski şifre geçerli kalmaya devam ediyor").save();
        realtime.invalidate(List.of("password-resets"), null);
        mail.send(user.getEmail(), approve ? "DevHub şifreniz güncellendi" : "DevHub şifre sıfırlama talebiniz reddedildi",
                "Merhaba " + user.getFullName() + ",\n\n"
                + (approve ? "Şifre sıfırlama talebiniz onaylandı. Artık yeni şifrenizle giriş yapabilirsiniz."
                           : "Şifre sıfırlama talebiniz reddedildi. Eski şifreniz geçerli olmaya devam ediyor.")
                + (note != null ? "\n\nYönetici notu: " + note : "") + "\n\nDevHub");
        return saved;
    }

    /** Açık (KOD_BEKLIYOR) talebi bulur ve kodu denetler; yanlış kodda deneme sayısını artırır. */
    private PasswordResetRequest checkCode(String rawEmail, String code) {
        String email = normalize(rawEmail);
        String digits = code == null ? "" : code.replaceAll("\\s", "");
        // Tek mesaj: kayıtlı olmayan adres, süresi dolan kod ve yanlış kod ayırt edilemez (yoksa "kod iste + yanlış kod dene" ile
        // adresin kayıtlı olduğu anlaşılırdı). 5 yanlış denemede talep düşer; kişi yeni kod ister.
        ApiException invalid = ApiException.badRequest("Kod hatalı ya da süresi dolmuş. Tekrar deneyin ya da yeni kod isteyin.");
        User user = users.findByEmail(email).filter(User::isActive).orElseThrow(() -> invalid);
        PasswordResetRequest r = requests.findFirstByUserIdAndStateOrderByCreatedAtDesc(user.getId(), PasswordResetState.KOD_BEKLIYOR)
                .orElseThrow(() -> invalid);
        if (r.getCodeExpiresAt().isBefore(LocalDateTime.now())) {
            r.setState(PasswordResetState.SURESI_DOLDU);
            requests.save(r);
            throw invalid;
        }
        if (!digits.matches("\\d{6}") || !encoder.matches(digits, r.getCodeHash())) {
            r.setAttempts(r.getAttempts() + 1);
            if (r.getAttempts() >= MAX_ATTEMPTS) r.setState(PasswordResetState.SURESI_DOLDU);
            requests.save(r);
            throw invalid;
        }
        return r;
    }

    private static String normalize(String email) {
        String e = email == null ? "" : email.trim();
        if (e.isEmpty() || e.length() > 255 || !e.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw ApiException.badRequest("Geçerli bir e-posta adresi girin.");
        return e;
    }
}
