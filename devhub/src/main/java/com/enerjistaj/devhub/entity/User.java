package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String jobTitle;

    /** Departman / ekip (ör. Proje, Destek, Test); yönetici girer, gruplama ve filtre için. */
    private String department;
    private String currentProject;
    private String status;

    /** Yöneticinin belirlediği çalışma şekli: AKTIF (ofis) veya UZAKTAN. */
    @Builder.Default
    @Column(nullable = false)
    private String workMode = "AKTIF";
    private String avatarColor;

    /** Pasif hesaplar giriş yapamaz ve ekip listelerinde görünmez. */
    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    private LocalDate hireDate;

    /** Yıllık izin hakkı (iş günü). Varsayılan 14; kıdeme göre yönetici değiştirir. */
    @Builder.Default
    @Column(nullable = false)
    private int annualLeaveDays = 14;

    /** Yönetici şifreyi sıfırladıysa kullanıcı ilk girişte şifresini değiştirmelidir. */
    @Builder.Default
    @Column(nullable = false)
    private boolean mustChangePassword = false;

    /** Şifre değişince artar; eski sürümü taşıyan token'lar geçersiz olur (bkz. SessionService). */
    @Builder.Default
    @Column(name = "session_version", nullable = false)
    private int sessionVersion = 0;

    /** Profildeki iletişim bilgileri ve bağlantılar; kişi kendisi düzenler. */
    @Builder.Default
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position asc, id asc")
    @org.hibernate.annotations.BatchSize(size = 64)
    private List<UserLink> links = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
