package com.enerjistaj.devhub.service;

import com.enerjistaj.devhub.entity.ActionLog;
import com.enerjistaj.devhub.entity.User;
import com.enerjistaj.devhub.repository.ActionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Sistem geçmişi. Yalnızca proje ataması, İzinli durumuna geçiş, yeni görev ve yeni proje loglanır;
 * başka olaylar için çağırmayın.
 */
@Service
@RequiredArgsConstructor
public class ActionLogService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final ActionLogRepository actionLogRepository;

    /** actor: işlemi yapan kişi; sistem tarafından yapılan işlemlerde null. */
    public void log(User actor, String message) {
        ActionLog log = new ActionLog();
        log.setActor(actor);
        log.setMessage("[" + ZonedDateTime.now(ZONE).format(STAMP) + "] " + message);
        actionLogRepository.save(log);
    }
}
