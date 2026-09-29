package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
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

/**
 * Onaylı izinlerin başladığı gün kişiyi İzinli yapar, bittiği günün ertesinde çalışma şekline (Aktif/Uzaktan) döndürür.
 * Yalnızca izin kaydı olan kişilere dokunur; elle İzinli yapılmış kişiler etkilenmez.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LeaveStatusScheduler {

    private final LeaveRequestRepository leaveRepository;
    private final UserStatusService userStatusService;

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
        log.debug("İzin durumları eşitlendi ({})", today);
    }
}
