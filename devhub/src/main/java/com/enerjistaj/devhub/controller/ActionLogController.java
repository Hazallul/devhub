package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.dto.LogDto;
import com.enerjistaj.devhub.repository.ActionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class ActionLogController {

    private final ActionLogRepository actionLogRepository;

    @GetMapping
    public ResponseEntity<List<LogDto>> getLogs() {
        return ResponseEntity.ok(actionLogRepository.findAllByOrderByCreatedAtDesc().stream().map(LogDto::from).toList());
    }
}
