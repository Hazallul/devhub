package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.Holiday;
import com.enerjistaj.devhub.repository.HolidayRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;

/** İş günü hesabı: hafta sonları (Cmt/Paz) ve resmi tatiller sayılmaz. */
@Service
@RequiredArgsConstructor
public class WorkdayService {

    private final HolidayRepository holidayRepository;

    public Set<LocalDate> holidaysBetween(LocalDate from, LocalDate to) {
        return holidayRepository.findByDateBetween(from, to).stream().map(Holiday::getDate).collect(Collectors.toSet());
    }

    /** [start, end] aralığındaki iş günü sayısı. */
    public int count(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) return 0;
        Set<LocalDate> holidays = holidaysBetween(start, end);
        return (int) start.datesUntil(end.plusDays(1)).filter(d -> isWorkday(d, holidays)).count();
    }

    /** [start, end] ile [from, to] kesişimindeki iş günü sayısı (ör. bir iznin belirli bir yıla düşen kısmı). */
    public int countWithin(LocalDate start, LocalDate end, LocalDate from, LocalDate to) {
        LocalDate s = start.isBefore(from) ? from : start;
        LocalDate e = end.isAfter(to) ? to : end;
        return count(s, e);
    }

    private static boolean isWorkday(LocalDate d, Set<LocalDate> holidays) {
        return d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY && !holidays.contains(d);
    }
}
