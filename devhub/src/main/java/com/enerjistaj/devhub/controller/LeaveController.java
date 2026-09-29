package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.LeaveDto;
import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import com.enerjistaj.devhub.service.ActionLogService;
import com.enerjistaj.devhub.service.UserStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leaves")
@RequiredArgsConstructor
public class LeaveController {

    private final LeaveRequestRepository leaveRepository;
    private final UserStatusService userStatusService;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;

    /** Ekip takvimi herkese açıktır; notlar dahil tüm talepler döner. */
    @GetMapping
    public ResponseEntity<List<LeaveDto>> getLeaves() {
        return ResponseEntity.ok(leaveRepository.findAllByOrderByCreatedAtDesc().stream().map(LeaveDto::from).toList());
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
        boolean hasWorkday = start.datesUntil(end.plusDays(1))
                .anyMatch(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY);
        if (!hasWorkday) throw ApiException.badRequest("Seçilen tarihler yalnızca hafta sonuna denk geliyor; en az bir iş günü seçin.");
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
            userStatusService.change(target, UserStatusService.IZINLI);
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

        leave.setState(decision);
        leave.setDecidedBy(me);
        leave.setDecidedAt(LocalDateTime.now());
        leaveRepository.save(leave);

        // Bugünü kapsayan bir izin onaylanırsa kişi hemen İzinli olur; ileri tarihliler LeaveStatusScheduler'a kalır.
        if (decision == LeaveState.ONAYLANDI && leave.covers(LocalDate.now(ActionLogService.ZONE))) {
            userStatusService.change(leave.getUser(), UserStatusService.IZINLI);
        }
        return ResponseEntity.ok(LeaveDto.from(leave));
    }

    /** Yanlışlıkla verilen onay/ret kararı kesinleşmediyse talep tekrar onay beklemeye döner. */
    @PutMapping("/{id}/undo")
    @Transactional
    public ResponseEntity<LeaveDto> undoDecision(@PathVariable Long id) {
        currentUser.requireAdmin("Kararı yalnızca yöneticiler geri alabilir.");
        LeaveRequest leave = findDecidedOpen(id);
        boolean wasApproved = leave.getState() == LeaveState.ONAYLANDI;

        leave.setState(LeaveState.BEKLIYOR);
        leave.setDecidedBy(null);
        leave.setDecidedAt(null);
        leaveRepository.saveAndFlush(leave);

        // Onay geri alındıysa ve kişi yalnızca bu izin yüzünden İzinli ise çalışma şekline döner.
        User user = leave.getUser();
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        if (wasApproved && UserStatusService.IZINLI.equals(user.getStatus()) && !leaveRepository.existsApprovedOn(user.getId(), today)) {
            userStatusService.change(user, user.getWorkMode());
        }
        return ResponseEntity.ok(LeaveDto.from(leave));
    }

    /** Kararı kalıcı hâle getirir; bundan sonra geri alınamaz. */
    @PutMapping("/{id}/finalize")
    @Transactional
    public ResponseEntity<LeaveDto> finalizeDecision(@PathVariable Long id) {
        currentUser.requireAdmin("Kararı yalnızca yöneticiler kesinleştirebilir.");
        LeaveRequest leave = findDecidedOpen(id);
        leave.setFinalized(true);
        leave.setFinalizedAt(LocalDateTime.now());
        return ResponseEntity.ok(LeaveDto.from(leaveRepository.save(leave)));
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
        leaveRepository.delete(leave);
        return ResponseEntity.noContent().build();
    }
}
