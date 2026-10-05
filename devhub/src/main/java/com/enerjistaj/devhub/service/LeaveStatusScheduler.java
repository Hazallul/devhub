package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import com.enerjistaj.devhub.entity.LogAction;
import com.enerjistaj.devhub.entity.LogCategory;
import com.enerjistaj.devhub.entity.NotificationType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Onaylı izinlerin başladığı gün kişiyi İzinli yapar, bittiği günün ertesinde çalışma şekline (Aktif/Uzaktan) döndürür.
 * Yalnızca izin kaydı olan kişilere dokunur; elle İzinli yapılmış kişiler etkilenmez.
 * Karar verilmeden bitiş tarihi geçen yıllık/mazeret talepleri kapatılır (bakiyede ayrılan gün serbest kalır);
 * kişi gerçekten izin kullandıysa yönetici "adına izin kaydı" ile geriye dönük girer. Hastalık talepleri
 * kapatılmaz, çünkü rapor çoğu zaman izin bittikten sonra gelir.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LeaveStatusScheduler {

    private final LeaveRequestRepository leaveRepository;
    private final UserStatusService userStatusService;
    private final ActionLogService actionLogService;
    private final NotificationService notificationService;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("tr"));

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        syncStatuses();
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "Europe/Istanbul")
    @Transactional
    public void syncStatuses() {
        LocalDate today = LocalDate.now(ActionLogService.ZONE);

        for (LeaveRequest leave : leaveRepository.findByStateAndStartDate(LeaveState.ONAYLANDI, today)) {
            userStatusService.change(leave.getUser(), UserStatusService.IZINLI, null);
        }

        for (LeaveRequest leave : leaveRepository.findByStateAndEndDate(LeaveState.ONAYLANDI, today.minusDays(1))) {
            User user = leave.getUser();
            if (UserStatusService.IZINLI.equals(user.getStatus()) && !leaveRepository.existsApprovedOn(user.getId(), today)) {
                userStatusService.change(user, user.getWorkMode(), null);
            }
        }
        expireStalePending(today);
        log.debug("İzin durumları eşitlendi ({})", today);
    }

    private void expireStalePending(LocalDate today) {
        for (LeaveRequest leave : leaveRepository.findByStateAndEndDateBeforeAndTypeNot(LeaveState.BEKLIYOR, today, LeaveType.HASTALIK)) {
            leave.setState(LeaveState.IPTAL);
            leave.setDecidedAt(LocalDateTime.now());
            leave.setDecisionNote(LeaveRequest.EXPIRED_NOTE);
            leaveRepository.save(leave);
            String range = leave.getStartDate().equals(leave.getEndDate())
                    ? leave.getStartDate().format(DAY)
                    : leave.getStartDate().format(DAY) + " – " + leave.getEndDate().format(DAY);
            User user = leave.getUser();
            actionLogService.record(LogCategory.IZIN, LogAction.BILGI, "Süresi dolan izin talebi kapatıldı: " + user.getFullName())
                    .target("IZIN", leave.getId(), user.getFullName())
                    .detail(range).detail("Yönetici karar vermeden izin tarihi geçti").save();
            notificationService.notify(user, null, NotificationType.LEAVE_DECIDED,
                    "İzin talebinizin süresi doldu", range + " talebine karar verilmeden tarihi geçti. İzni kullandıysanız yöneticinize iletin.", "/leaves");
        }
    }
}
