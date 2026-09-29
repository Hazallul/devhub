package com.enerjistaj.devhub.repository;

import com.enerjistaj.devhub.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface HolidayRepository extends JpaRepository<Holiday, Long> {
    List<Holiday> findAllByOrderByDateAsc();

    List<Holiday> findByDateBetween(LocalDate from, LocalDate to);

    boolean existsByDate(LocalDate date);
}
