package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.Payloads;
import com.enerjistaj.devhub.entity.Holiday;
import com.enerjistaj.devhub.exception.ApiException;
import com.enerjistaj.devhub.repository.HolidayRepository;
import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Resmi tatiller: herkes görür, yönetici ekler/siler. */
@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
public class HolidayController {

    private final HolidayRepository holidayRepository;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<List<Holiday>> list() {
        return ResponseEntity.ok(holidayRepository.findAllByOrderByDateAsc());
    }

    @PostMapping
    public ResponseEntity<Holiday> create(@RequestBody Map<String, Object> payload) {
        currentUser.requireAdmin("Resmi tatilleri yalnızca yöneticiler düzenleyebilir.");
        LocalDate date = Payloads.date(payload, "date", "Tarih");
        if (date == null) throw ApiException.badRequest("Tarih zorunludur.");
        if (holidayRepository.existsByDate(date)) throw ApiException.conflict("Bu tarih zaten resmi tatil olarak kayıtlı.");
        Holiday h = new Holiday();
        h.setDate(date);
        h.setName(Payloads.requiredText(payload, "name", "Tatil adı zorunludur.", 100, "Tatil adı"));
        return ResponseEntity.ok(holidayRepository.save(h));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        currentUser.requireAdmin("Resmi tatilleri yalnızca yöneticiler düzenleyebilir.");
        Holiday h = holidayRepository.findById(id).orElseThrow(() -> ApiException.notFound("Resmi tatil"));
        holidayRepository.delete(h);
        return ResponseEntity.noContent().build();
    }
}
