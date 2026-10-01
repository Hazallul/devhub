package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/** Sistem logu (denetim kaydı): kim, ne zaman, hangi kayıt üzerinde, ne yaptı. */
@Entity
@Table(name = "action_logs")
@Data
public class ActionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogCategory category = LogCategory.SISTEM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private LogAction action = LogAction.BILGI;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogLevel level = LogLevel.BILGI;

    /** Okunabilir özet, ör. "Görev silindi: Ödeme ekranı testleri" */
    @Column(nullable = false, length = 500)
    private String message;

    /** İşlemi yapan kişi; null ise sistem (ör. gece çalışan izin zamanlayıcısı) veya tanınmayan biri (başarısız giriş). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    /** Etkilenen kayıt: tür (KULLANICI, PROJE, GOREV, IZIN, DUYURU, TATIL, PROFIL_TALEBI), id ve o anki adı. */
    @Column(name = "target_type", length = 30)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "target_name", length = 200)
    private String targetName;

    /** Değişiklik ayrıntıları; her satır "Alan: eski → yeni" biçiminde. */
    @Column(length = 2000)
    private String details;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
