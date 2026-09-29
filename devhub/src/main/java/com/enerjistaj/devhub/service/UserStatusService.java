package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import com.enerjistaj.devhub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Set;

/**
 * Durum değişikliği tek yerden yapılır: elle değişiklik, izin onayı ve günlük izin kontrolü aynı log kuralını paylaşır.
 * İzinli durumu her zaman bugünü kapsayan onaylı bir izin kaydına dayanır (izin takvimi ve "Bugün izinde" bu kayıtlardan beslenir);
 * İzinli'den çıkınca o kayıt burada kısaltılır/iptal edilir.
 */
@Service
@RequiredArgsConstructor
public class UserStatusService {

    public static final String IZINLI = "IZINLI";
    public static final Set<String> ALL = Set.of("AKTIF", "TOPLANTIDA", "UZAKTAN", IZINLI);
    public static final String TOPLANTIDA = "TOPLANTIDA";
    public static final Set<String> WORK_MODES = Set.of("AKTIF", "UZAKTAN");

    private final UserRepository userRepository;
    private final ActionLogService actionLogService;
    private final LeaveRequestRepository leaveRepository;

    /**
     * Çalışanın kendi seçebileceği durumlar: çalışma şekli (Aktif veya Uzaktan) ile Toplantıda arasında gidip gelir.
     * İzinliyken kendi durumunu değiştiremez.
     */
    public static Set<String> selfServiceOptions(User user) {
        if (IZINLI.equals(user.getStatus())) return Set.of();
        return Set.of(user.getWorkMode(), TOPLANTIDA);
    }

    public User change(User user, String newStatus) {
        String oldStatus = user.getStatus();
        if (newStatus.equals(oldStatus)) return user;

        user.setStatus(newStatus);
        // Aktif/Uzaktan'a geçiş (yalnızca yönetici yapabilir) kişinin çalışma şeklini de belirler.
        if (WORK_MODES.contains(newStatus)) user.setWorkMode(newStatus);
        User saved = userRepository.save(user);
        syncLeaveRecords(saved, oldStatus, newStatus);

        if (IZINLI.equals(oldStatus) || IZINLI.equals(newStatus)) {
            actionLogService.log(user.getFullName() + " durumu '" + (oldStatus != null ? oldStatus : "Belirsiz")
                    + "' -> '" + newStatus + "' olarak güncellendi.");
        }
        return saved;
    }

    private void syncLeaveRecords(User user, String oldStatus, String newStatus) {
        LocalDate today = LocalDate.now(ActionLogService.ZONE);

        // İzinli'den erken çıkarıldıysa bugünü kapsayan izin bugün başladıysa iptal edilir, önce başladıysa dün biter.
        if (IZINLI.equals(oldStatus) && !IZINLI.equals(newStatus)) {
            for (LeaveRequest leave : leaveRepository.findApprovedOn(user.getId(), today)) {
                if (leave.getStartDate().isBefore(today)) {
                    leave.setEndDate(today.minusDays(1));
                } else {
                    leave.setState(LeaveState.IPTAL);
                }
                leaveRepository.save(leave);
            }
        }
    }
}
