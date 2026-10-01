package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.LogLevel;
import com.enerjistaj.devhub.dto.LeaveBalanceDto;
import com.enerjistaj.devhub.dto.LeaveDto;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.LeaveBalanceService;
import com.enerjistaj.devhub.service.NotificationService;
import com.enerjistaj.devhub.service.WorkdayService;
import com.enerjistaj.devhub.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/leaves")
@RequiredArgsConstructor
public class LeaveController {

    private final ActionLogService actionLogService;
    private final LeaveRequestRepository leaveRepository;
    private final UserStatusService userStatusService;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final WorkdayService workdayService;
    private final LeaveBalanceService leaveBalanceService;
    private final NotificationService notificationService;

    private static final Map<LeaveType, String> TYPE_LABELS = Map.of(
            LeaveType.YILLIK, "Yıllık izin", LeaveType.HASTALIK, "Hastalık izni", LeaveType.MAZERET, "Mazeret izni");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("tr"));

    /** Yıllık izin bakiyeleri: yönetici herkesinkini, çalışan yalnızca kendisininkini görür. */
    @GetMapping("/balances")
    public ResponseEntity<List<LeaveBalanceDto>> balances(@RequestParam(required = false) Integer year) {
        User me = currentUser.get();
        int y = year != null ? year : LocalDate.now(ActionLogService.ZONE).getYear();
        List<User> users = CurrentUser.isAdmin(me) ? userRepository.findByActiveTrue() : List.of(me);
        return ResponseEntity.ok(leaveBalanceService.balances(users, y));
    }

    /**
     * Yönetici tüm talepleri görür. Çalışan kendi taleplerinin tamamını, başkalarının ise yalnızca onaylanmış
     * izinlerini tür, not ve karar açıklaması olmadan görür; bekleyen, reddedilen ve iptal edilen talepler
     * ve ret nedenleri başkasına gösterilmez.
     */
    @GetMapping
    public ResponseEntity<List<LeaveDto>> getLeaves() {
        User me = currentUser.get();
        boolean admin = CurrentUser.isAdmin(me);
        return ResponseEntity.ok(leaveRepository.findAllByOrderByCreatedAtDesc().stream()
            .filter(l -> admin || l.getUser().getId().equals(me.getId()) || l.getState() == LeaveState.ONAYLANDI)
            .map(l -> admin || l.getUser().getId().equals(me.getId()) ? LeaveDto.from(l) : LeaveDto.from(l).forColleague())
            .toList());
    }

    /**
     * Çalışan kendi adına talep oluşturur (onay bekler). Yönetici gövdede userId verirse o kişi adına
     * doğrudan onaylı kayıt açar (durum menüsünden İzinli yapma akışı); bugünü kapsıyorsa kişi hemen İzinli olur.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<LeaveDto> createLeave(@RequestBody Map<String, Object> payload) {
        User me = currentUser.get();
        Object rawUserId = payload.get("userId");
        User target = me;
        boolean onBehalf = false;
        if (rawUserId != null) {
            if (!CurrentUser.isAdmin(me)) throw ApiException.forbidden("Başkası adına izin kaydını yalnızca yöneticiler oluşturabilir.");
            Long userId;
            try {
                userId = Long.valueOf(rawUserId.toString());
            } catch (NumberFormatException e) {
                throw ApiException.badRequest("Geçersiz kullanıcı.");
            }
            target = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Kullanıcı"));
            onBehalf = true;
        }
        LeaveType type = Payloads.enumValue(payload, "type", LeaveType.class, "izin türü");
        LocalDate start = Payloads.date(payload, "startDate", "Başlangıç tarihi");
        LocalDate end = Payloads.date(payload, "endDate", "Bitiş tarihi");
        if (type == null) throw ApiException.badRequest("İzin türü seçin.");
        if (start == null || end == null) throw ApiException.badRequest("Başlangıç ve bitiş tarihi zorunludur.");
        if (end.isBefore(start)) throw ApiException.badRequest("Bitiş tarihi başlangıçtan önce olamaz.");
        // Çalışan geçmişe dönük yalnızca hastalık izni isteyebilir (rapor sonradan gelir); yönetici kayıt açarken serbesttir.
        if (!onBehalf && type != LeaveType.HASTALIK && start.isBefore(LocalDate.now(ActionLogService.ZONE))) {
            throw ApiException.badRequest("Geçmiş tarihli talep yalnızca hastalık izni için oluşturulabilir.");
        }
        if (workdayService.count(start, end) == 0) {
            throw ApiException.badRequest("Seçilen tarihler hafta sonu veya resmi tatile denk geliyor; en az bir iş günü seçin.");
        }
        if (type == LeaveType.YILLIK) leaveBalanceService.ensureAnnualAllowance(target, start, end, null);
        if (leaveRepository.existsOverlapping(target.getId(), start, end)) {
            throw ApiException.conflict(onBehalf ? target.getFullName() + " için bu tarihlerle çakışan bir izin var." : "Bu tarihlerle çakışan bir izin talebiniz var.");
        }

        LeaveRequest leave = new LeaveRequest();
        leave.setUser(target);
        leave.setType(type);
        leave.setStartDate(start);
        leave.setEndDate(end);
        leave.setNote(Payloads.optionalText(payload, "note", 300, "Not"));
        if (onBehalf) {
            leave.setState(LeaveState.ONAYLANDI);
            leave.setDecidedBy(me);
            leave.setDecidedAt(LocalDateTime.now());
        }
        LeaveRequest saved = leaveRepository.save(leave);
        if (onBehalf && saved.covers(LocalDate.now(ActionLogService.ZONE))) {
            userStatusService.change(target, UserStatusService.IZINLI, me);
        }
        actionLogService.record(LogCategory.IZIN, onBehalf ? LogAction.KAYIT : LogAction.TALEP,
                onBehalf ? target.getFullName() + " adına izin kaydı oluşturuldu" : "İzin talebi oluşturuldu").by(me)
                .target("IZIN", saved.getId(), target.getFullName())
                .detail(summary(saved))
                .detail(saved.getNote() != null ? "Not: " + saved.getNote() : null)
                .detail(onBehalf ? "Yönetici kaydı: doğrudan onaylı" : "Yönetici onayı bekleniyor")
                .detail(!onBehalf && saved.getStartDate().isBefore(LocalDate.now(ActionLogService.ZONE)) ? "Geçmiş tarihli hastalık bildirimi" : null).save();
        if (onBehalf) {
            notificationService.notify(target, me, NotificationType.LEAVE_DECIDED, "Adınıza izin kaydedildi", summary(saved), "/leaves");
        } else {
            notificationService.notifyAdmins(me, NotificationType.LEAVE_REQUESTED, me.getFullName() + " izin talebinde bulundu", summary(saved), "/leaves");
        }
        return ResponseEntity.ok(LeaveDto.from(saved));
    }

    @PutMapping("/{id}/decision")
    @Transactional
    public ResponseEntity<LeaveDto> decide(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User me = currentUser.requireAdmin("İzin onayı yalnızca yöneticiler tarafından verilebilir.");
        LeaveRequest leave = leaveRepository.findById(id).orElseThrow(() -> ApiException.notFound("İzin talebi"));
        LeaveState decision = Payloads.enumValue(payload, "decision", LeaveState.class, "karar");
        if (decision == null || decision == LeaveState.BEKLIYOR) throw ApiException.badRequest("Karar ONAYLANDI veya REDDEDILDI olmalı.");
        if (leave.getState() != LeaveState.BEKLIYOR) throw ApiException.conflict("Bu talep zaten sonuçlandırılmış.");
        // Talep açıldıktan sonra hak değişmiş veya başka izinler onaylanmış olabilir.
        if (decision == LeaveState.ONAYLANDI && leave.getType() == LeaveType.YILLIK) {
            leaveBalanceService.ensureAnnualAllowance(leave.getUser(), leave.getStartDate(), leave.getEndDate(), leave.getId());
        }

        leave.setState(decision);
        leave.setDecidedBy(me);
        leave.setDecidedAt(LocalDateTime.now());
        leave.setDecisionNote(Payloads.optionalText(payload, "note", 500, "Açıklama"));
        leaveRepository.save(leave);

        // Bugünü kapsayan bir izin onaylanırsa kişi hemen İzinli olur; ileri tarihliler LeaveStatusScheduler'a kalır.
        if (decision == LeaveState.ONAYLANDI && leave.covers(LocalDate.now(ActionLogService.ZONE))) {
            userStatusService.change(leave.getUser(), UserStatusService.IZINLI, me);
        }
        actionLogService.record(LogCategory.IZIN, decision == LeaveState.ONAYLANDI ? LogAction.ONAY : LogAction.RET,
                (decision == LeaveState.ONAYLANDI ? "İzin talebi onaylandı: " : "İzin talebi reddedildi: ") + leave.getUser().getFullName()).by(me)
                .target("IZIN", leave.getId(), leave.getUser().getFullName())
                .detail(summary(leave))
                .detail(leave.getDecisionNote() != null ? "Açıklama: " + leave.getDecisionNote() : null)
                .detail("Karar kesinleşene kadar geri alınabilir").save();
        notificationService.notify(leave.getUser(), me, NotificationType.LEAVE_DECIDED,
                decision == LeaveState.ONAYLANDI ? "İzin talebiniz onaylandı" : "İzin talebiniz reddedildi",
                summary(leave) + (leave.getDecisionNote() != null ? " — " + leave.getDecisionNote() : ""), "/leaves");
        return ResponseEntity.ok(LeaveDto.from(leave));
    }

    /** Yanlışlıkla verilen onay/ret kararı kesinleşmediyse talep tekrar onay beklemeye döner. */
    @PutMapping("/{id}/undo")
    @Transactional
    public ResponseEntity<LeaveDto> undoDecision(@PathVariable Long id) {
        User me = currentUser.requireAdmin("Kararı yalnızca yöneticiler geri alabilir.");
        LeaveRequest leave = findDecidedOpen(id);
        boolean wasApproved = leave.getState() == LeaveState.ONAYLANDI;

        leave.setState(LeaveState.BEKLIYOR);
        leave.setDecidedBy(null);
        leave.setDecidedAt(null);
        leave.setDecisionNote(null);
        leaveRepository.saveAndFlush(leave);

        // Onay geri alındıysa ve kişi yalnızca bu izin yüzünden İzinli ise çalışma şekline döner.
        User user = leave.getUser();
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        if (wasApproved && UserStatusService.IZINLI.equals(user.getStatus()) && !leaveRepository.existsApprovedOn(user.getId(), today)) {
            userStatusService.change(user, user.getWorkMode(), me);
        }
        actionLogService.record(LogCategory.IZIN, LogAction.GERI_ALMA, "İzin kararı geri alındı: " + user.getFullName()).by(me)
                .target("IZIN", leave.getId(), user.getFullName())
                .detail("Önceki karar: " + (wasApproved ? "Onaylandı" : "Reddedildi"))
                .detail(summary(leave)).detail("Talep yeniden onay bekliyor").level(LogLevel.UYARI).save();
        notificationService.notify(user, me, NotificationType.LEAVE_REOPENED,
                "İzin kararı geri alındı; talebiniz yeniden değerlendirilecek", summary(leave), "/leaves");
        return ResponseEntity.ok(LeaveDto.from(leave));
    }

    /** Kararı kalıcı hâle getirir; bundan sonra geri alınamaz. */
    @PutMapping("/{id}/finalize")
    @Transactional
    public ResponseEntity<LeaveDto> finalizeDecision(@PathVariable Long id) {
        User me = currentUser.requireAdmin("Kararı yalnızca yöneticiler kesinleştirebilir.");
        LeaveRequest leave = findDecidedOpen(id);
        leave.setFinalized(true);
        leave.setFinalizedAt(LocalDateTime.now());
        LeaveRequest saved = leaveRepository.save(leave);
        actionLogService.record(LogCategory.IZIN, LogAction.KESINLESTIRME, "İzin kararı kesinleştirildi: " + saved.getUser().getFullName()).by(me)
                .target("IZIN", saved.getId(), saved.getUser().getFullName())
                .detail("Karar: " + (saved.getState() == LeaveState.ONAYLANDI ? "Onaylandı" : "Reddedildi"))
                .detail(summary(saved)).detail("Bu karar artık değiştirilemez").save();
        return ResponseEntity.ok(LeaveDto.from(saved));
    }

    /** "Yıllık izin · 1 Eki – 4 Eki · 2 iş günü" */
    private String summary(LeaveRequest l) {
        String range = l.getStartDate().equals(l.getEndDate())
                ? l.getStartDate().format(DAY)
                : l.getStartDate().format(DAY) + " – " + l.getEndDate().format(DAY);
        return TYPE_LABELS.get(l.getType()) + " · " + range + " · " + workdayService.count(l.getStartDate(), l.getEndDate()) + " iş günü";
    }

    private LeaveRequest findDecidedOpen(Long id) {
        LeaveRequest leave = leaveRepository.findById(id).orElseThrow(() -> ApiException.notFound("İzin talebi"));
        if (leave.isFinalized()) throw ApiException.conflict("Bu karar kesinleştirilmiş; değiştirilemez.");
        if (leave.getState() != LeaveState.ONAYLANDI && leave.getState() != LeaveState.REDDEDILDI) {
            throw ApiException.conflict("Bu talep için henüz verilmiş bir karar yok.");
        }
        return leave;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> withdraw(@PathVariable Long id) {
        User me = currentUser.get();
        LeaveRequest leave = leaveRepository.findById(id).orElseThrow(() -> ApiException.notFound("İzin talebi"));
        if (!leave.getUser().getId().equals(me.getId()) || leave.getState() != LeaveState.BEKLIYOR) {
            throw ApiException.forbidden("Yalnızca bekleyen kendi talebinizi geri çekebilirsiniz.");
        }
        actionLogService.record(LogCategory.IZIN, LogAction.GERI_CEKME, "İzin talebi geri çekildi").by(me)
                .target("IZIN", leave.getId(), me.getFullName()).detail(summary(leave)).save();
        leaveRepository.delete(leave);
        return ResponseEntity.noContent().build();
    }
}
