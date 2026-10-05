package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "leave_requests")
@Data
public class LeaveRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LeaveType type;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LeaveState state = LeaveState.BEKLIYOR;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /** Yöneticinin karara eklediği açıklama (ör. ret nedeni); çalışana gösterilir. */
    @Column(name = "decision_note", length = 500)
    private String decisionNote;

    /** Karar verilmeden tarihi geçen talebe sistemin yazdığı not; arayüz bunu "Süresi doldu" olarak gösterir. */
    public static final String EXPIRED_NOTE = "Tarihi geçtiği için karar verilmeden kapandı.";

    /** Kesinleşen karar (onay/ret) geri alınamaz. */
    @Column(nullable = false)
    private boolean finalized;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean covers(LocalDate day) {
        return !day.isBefore(startDate) && !day.isAfter(endDate);
    }
}
