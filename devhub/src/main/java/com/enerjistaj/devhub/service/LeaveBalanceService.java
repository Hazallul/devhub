package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.dto.LeaveBalanceDto;
import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.entity.LeaveState;
import com.enerjistaj.devhub.entity.LeaveType;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Yıllık izin bakiyesi. Hak işe giriş tarihinden kendiliğinden hesaplanır (LeavePolicy).
 * Yalnızca YILLIK türü hakkından düşer; hastalık ve mazeret izinleri bakiyeyi etkilemez.
 * İzin yıl sınırını aşıyorsa her yıl kendi payını kullanır.
 */
@Service
@RequiredArgsConstructor
public class LeaveBalanceService {

    private final LeaveRequestRepository leaveRepository;
    private final WorkdayService workdayService;

    public List<LeaveBalanceDto> balances(List<User> users, int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);
        List<LeaveRequest> annual = leaveRepository.findByTypeAndStatesBetween(
                LeaveType.YILLIK, List.of(LeaveState.ONAYLANDI, LeaveState.BEKLIYOR), from, to);
        Map<Long, List<LeaveRequest>> byUser = annual.stream().collect(Collectors.groupingBy(l -> l.getUser().getId()));

        // Hak, o yılın hangi anına göre? Geçmiş yıl: yıl sonundaki kıdem; bu yıl: bugünkü; gelecek yıl: yıl başındaki.
        LocalDate today = LocalDate.now(ActionLogService.ZONE);
        LocalDate asOf = year < today.getYear() ? to : year > today.getYear() ? from : today;
        return users.stream().map(u -> {
            List<LeaveRequest> own = byUser.getOrDefault(u.getId(), List.of());
            int used = sum(own, LeaveState.ONAYLANDI, from, to, null);
            int pending = sum(own, LeaveState.BEKLIYOR, from, to, null);
            int entitlement = LeavePolicy.entitlement(u.getHireDate(), asOf);
            return LeaveBalanceDto.builder()
                    .userId(u.getId()).year(year).entitlement(entitlement)
                    .used(used).pending(pending).remaining(entitlement - used)
                    .build();
        }).toList();
    }

    /**
     * Yeni (veya onaylanacak) bir yıllık iznin hakkı aşıp aşmadığını kontrol eder.
     * Onaylı ve bekleyen diğer talepler de hesaba katılır; excludeId verilen talep (ör. onaylanan) çift sayılmaz.
     */
    public void ensureAnnualAllowance(User user, LocalDate start, LocalDate end, Long excludeId) {
        for (int year = start.getYear(); year <= end.getYear(); year++) {
            LocalDate from = LocalDate.of(year, 1, 1);
            LocalDate to = LocalDate.of(year, 12, 31);
            int requested = workdayService.countWithin(start, end, from, to);
            if (requested == 0) continue;
            List<LeaveRequest> own = leaveRepository.findByTypeAndStatesBetween(
                    LeaveType.YILLIK, List.of(LeaveState.ONAYLANDI, LeaveState.BEKLIYOR), from, to).stream()
                    .filter(l -> l.getUser().getId().equals(user.getId()))
                    .toList();
            int committed = sum(own, LeaveState.ONAYLANDI, from, to, excludeId) + sum(own, LeaveState.BEKLIYOR, from, to, excludeId);
            // Hak, iznin o yıl içindeki ilk gününde geçerli kıdeme göre (yıldönümünden sonraki izin yeni hakkı kullanır).
            LocalDate firstDay = start.isAfter(from) ? start : from;
            int entitlement = LeavePolicy.entitlement(user.getHireDate(), firstDay);
            if (entitlement == 0) {
                LeavePolicy.Next next = LeavePolicy.next(user.getHireDate(), firstDay);
                throw ApiException.badRequest(user.getHireDate() == null
                        ? "İşe giriş tarihi kayıtlı olmadığı için yıllık izin hakkı hesaplanamıyor; yöneticinize başvurun."
                        : "Yıllık izin hakkı, işe girişin 1. yılı dolunca başlar"
                          + (next != null ? " (" + next.date().format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")) + " itibarıyla " + next.days() + " gün)" : "")
                          + ". Bu süre içinde mazeret veya hastalık izni kullanılabilir.");
            }
            int available = entitlement - committed;
            if (requested > available) {
                throw ApiException.badRequest(String.format(
                        "%d yılı için yıllık izin bakiyesi yetersiz: talep %d iş günü, kullanılabilir %d iş günü (hak %d, kullanılan/bekleyen %d).",
                        year, requested, Math.max(available, 0), entitlement, committed));
            }
        }
    }

    private int sum(List<LeaveRequest> leaves, LeaveState state, LocalDate from, LocalDate to, Long excludeId) {
        return leaves.stream()
                .filter(l -> l.getState() == state && !l.getId().equals(excludeId))
                .mapToInt(l -> workdayService.countWithin(l.getStartDate(), l.getEndDate(), from, to))
                .sum();
    }
}
