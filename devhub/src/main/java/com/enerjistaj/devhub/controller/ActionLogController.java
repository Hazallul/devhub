package com.enerjistaj.devhub.controller;

import com.enerjistaj.devhub.entity.ActionLog;
import com.enerjistaj.devhub.repository.ActionLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
public class ActionLogController {

    @Autowired
    private ActionLogRepository actionLogRepository;

    @GetMapping
    public ResponseEntity<List<ActionLog>> getLogs() {
        return ResponseEntity.ok(actionLogRepository.findAllByOrderByCreatedAtDesc());
    }
}
