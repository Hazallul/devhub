package com.enerjistaj.devhub.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Kişinin profiline eklediği iletişim bilgisi veya bağlantı (ek e-posta, telefon, LinkedIn...). */
@Entity
@Table(name = "user_links")
@Getter
@Setter
@NoArgsConstructor
public class UserLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserLinkType type;

    /** İsteğe bağlı kısa ad, ör. "Kişisel" */
    @Column(length = 40)
    private String label;

    @Column(nullable = false, length = 300)
    private String value;

    @Column(nullable = false)
    private int position;
}
