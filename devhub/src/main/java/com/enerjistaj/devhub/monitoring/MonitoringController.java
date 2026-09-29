package com.enerjistaj.devhub.monitoring;

import com.enerjistaj.devhub.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Sistem İzleme: yalnızca yöneticiler. minutes: grafiklerde gösterilecek geçmiş (5–60 dk). */
@RestController
@RequestMapping("/api/admin/monitoring")
@RequiredArgsConstructor
@EnableConfigurationProperties(MonitoringProperties.class)
public class MonitoringController {

    private final MonitoringService monitoringService;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<MonitoringDtos.Overview> overview(@RequestParam(defaultValue = "15") int minutes) {
        currentUser.requireAdmin("Sistem izleme yalnızca yöneticilere açıktır.");
        return ResponseEntity.ok(monitoringService.overview(Math.max(5, Math.min(minutes, 60))));
    }
}
