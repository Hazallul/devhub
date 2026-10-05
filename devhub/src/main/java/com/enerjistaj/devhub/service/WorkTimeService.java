package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.Holiday;
import com.enerjistaj.devhub.entity.LeaveRequest;
import com.enerjistaj.devhub.repository.HolidayRepository;
import com.enerjistaj.devhub.repository.LeaveRequestRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Mesai saati hesabı (iş gücü takibi için). Bir zaman aralığının yalnızca mesaiye düşen kısmı sayılır:
 * hafta içi, resmi tatil olmayan, kişinin onaylı izninde olmadığı günlerde, tanımlı çalışma dilimleri içinde
 * (varsayılan 09:00–12:00 ve 13:00–18:00, Türkiye saati; günde 8 saat, haftada 40 saat).
 * Böylece akşam "Devam Ediyor"da unutulan bir görev gece boyunca süre yazmaz.
 */
@Service
public class WorkTimeService {

    private static final ZoneId UTC = ZoneOffset.UTC;

    private final HolidayRepository holidays;
    private final LeaveRequestRepository leaves;
    /** Günün çalışma dilimleri [başlangıç, bitiş) */
    private final List<LocalTime[]> periods;

    public WorkTimeService(HolidayRepository holidays, LeaveRequestRepository leaves,
                           @Value("${devhub.work.periods:09:00-12:00,13:00-18:00}") String periodSpec) {
        this.holidays = holidays;
        this.leaves = leaves;
        this.periods = Arrays.stream(periodSpec.split(",")).map(String::trim).map(p -> {
            String[] parts = p.split("-");
            return new LocalTime[]{LocalTime.parse(parts[0].trim()), LocalTime.parse(parts[1].trim())};
        }).toList();
    }

    /** Bir günün tam mesai süresi (saniye). */
    public long dayCapacitySeconds() {
        return periods.stream().mapToLong(p -> Duration.between(p[0], p[1]).getSeconds()).sum();
    }

    /**
     * startUtc'den itibaren seconds kadar mesai süresi geçtiği an (UTC). Hafta sonu ve resmi tatiller atlanır (kişinin izni sayılmaz).
     * Destek taleplerinin çözüm hedefi (SLA) için: ör. Cuma 17:00'de açılan 4 saatlik talebin hedefi Pazartesi 12:00 olur.
     */
    public LocalDateTime addWorkSeconds(LocalDateTime startUtc, long seconds) {
        ZonedDateTime s = startUtc.atZone(UTC).withZoneSameInstant(ActionLogService.ZONE);
        Calendar cal = calendar(s.toLocalDate(), s.toLocalDate().plusDays(400));
        long left = seconds;
        for (LocalDate d = s.toLocalDate(); ; d = d.plusDays(1)) {
            if (!cal.isWorkday(null, d)) continue;
            for (LocalTime[] p : periods) {
                ZonedDateTime ps = d.atTime(p[0]).atZone(ActionLogService.ZONE);
                ZonedDateTime pe = d.atTime(p[1]).atZone(ActionLogService.ZONE);
                ZonedDateTime from = s.isAfter(ps) ? s : ps;
                if (!pe.isAfter(from)) continue;
                long avail = Duration.between(from, pe).getSeconds();
                if (avail >= left) return from.plusSeconds(left).withZoneSameInstant(UTC).toLocalDateTime();
                left -= avail;
            }
        }
    }

    /** Tatil ve izin bilgisini bir kez yükleyip birçok hesapta kullanmak için. */
    public Calendar calendar(LocalDate from, LocalDate to) {
        Set<LocalDate> h = holidays.findByDateBetween(from, to).stream().map(Holiday::getDate).collect(Collectors.toSet());
        Map<Long, Set<LocalDate>> leaveDays = new HashMap<>();
        for (LeaveRequest l : leaves.findApprovedBetween(from, to)) {
            Set<LocalDate> days = leaveDays.computeIfAbsent(l.getUser().getId(), k -> new HashSet<>());
            l.getStartDate().datesUntil(l.getEndDate().plusDays(1)).forEach(days::add);
        }
        return new Calendar(h, leaveDays);
    }

    public final class Calendar {
        private final Set<LocalDate> holidayDays;
        private final Map<Long, Set<LocalDate>> leaveDays;

        private Calendar(Set<LocalDate> holidayDays, Map<Long, Set<LocalDate>> leaveDays) {
            this.holidayDays = holidayDays;
            this.leaveDays = leaveDays;
        }

        public boolean isWorkday(Long userId, LocalDate d) {
            DayOfWeek w = d.getDayOfWeek();
            return w != DayOfWeek.SATURDAY && w != DayOfWeek.SUNDAY && !holidayDays.contains(d)
                && !leaveDays.getOrDefault(userId, Set.of()).contains(d);
        }

        /** [startUtc, endUtc) aralığının mesaiye düşen kısmı (saniye). endUtc null = şimdi. */
        public long workSeconds(Long userId, LocalDateTime startUtc, LocalDateTime endUtc) {
            ZonedDateTime s = startUtc.atZone(UTC).withZoneSameInstant(ActionLogService.ZONE);
            ZonedDateTime e = (endUtc != null ? endUtc.atZone(UTC) : ZonedDateTime.now(UTC)).withZoneSameInstant(ActionLogService.ZONE);
            if (!e.isAfter(s)) return 0;
            long total = 0;
            for (LocalDate d = s.toLocalDate(); !d.isAfter(e.toLocalDate()); d = d.plusDays(1)) {
                if (!isWorkday(userId, d)) continue;
                for (LocalTime[] p : periods) {
                    ZonedDateTime ps = d.atTime(p[0]).atZone(ActionLogService.ZONE);
                    ZonedDateTime pe = d.atTime(p[1]).atZone(ActionLogService.ZONE);
                    ZonedDateTime from = s.isAfter(ps) ? s : ps;
                    ZonedDateTime to = e.isBefore(pe) ? e : pe;
                    if (to.isAfter(from)) total += Duration.between(from, to).getSeconds();
                }
            }
            return total;
        }

        /** Şu an kişi için mesai saati mi (açık oturumun süresi şu an artıyor mu). */
        public boolean isWorkingNow(Long userId) {
            ZonedDateTime now = ZonedDateTime.now(ActionLogService.ZONE);
            if (!isWorkday(userId, now.toLocalDate())) return false;
            LocalTime t = now.toLocalTime();
            return periods.stream().anyMatch(p -> !t.isBefore(p[0]) && t.isBefore(p[1]));
        }

        /** Kişinin [from, to] günlerindeki mesai kapasitesi (saniye): tatil ve izin günleri düşülür. */
        public long capacitySeconds(Long userId, LocalDate from, LocalDate to) {
            long days = from.datesUntil(to.plusDays(1)).filter(d -> isWorkday(userId, d)).count();
            return days * dayCapacitySeconds();
        }
    }
}
