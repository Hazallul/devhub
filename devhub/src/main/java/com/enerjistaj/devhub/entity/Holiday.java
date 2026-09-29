package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

/** Resmi tatil (tam gün). İzin iş günü hesabında ve takvimde kullanılır. */
@Entity
@Table(name = "holidays")
@Data
public class Holiday {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate date;

    @Column(nullable = false, length = 100)
    private String name;
}
