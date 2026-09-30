package com.enerjistaj.devhub.todo;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Tekrarlayan kartın sıklığı. Kart tamamlanınca bir sonraki tarihe yenisi açılır. */
public enum TodoRepeat {
    DAILY, WEEKDAYS, WEEKLY, MONTHLY;

    /** from tarihinden sonraki ilk tekrar; her zaman after'dan sonraki bir güne düşer (gecikmiş kart geçmişe kopya açmaz). */
    public LocalDate next(LocalDate from, LocalDate after) {
        LocalDate d = from;
        do {
            d = switch (this) {
                case DAILY -> d.plusDays(1);
                case WEEKDAYS -> nextWeekday(d);
                case WEEKLY -> d.plusWeeks(1);
                case MONTHLY -> d.plusMonths(1);
            };
        } while (!d.isAfter(after));
        return d;
    }

    private static LocalDate nextWeekday(LocalDate d) {
        LocalDate n = d.plusDays(1);
        while (n.getDayOfWeek() == DayOfWeek.SATURDAY || n.getDayOfWeek() == DayOfWeek.SUNDAY) n = n.plusDays(1);
        return n;
    }
}
