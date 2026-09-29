-- Proje detayları
ALTER TABLE projects
    ADD COLUMN description VARCHAR(500) NULL,
    ADD COLUMN status ENUM('PLANLAMA', 'AKTIF', 'BEKLEMEDE', 'TAMAMLANDI') NOT NULL DEFAULT 'AKTIF',
    ADD COLUMN deadline DATE NULL;

-- Görev panosu
ALTER TABLE tasks
    ADD COLUMN status ENUM('YAPILACAK', 'DEVAM', 'TAMAMLANDI') NOT NULL DEFAULT 'YAPILACAK',
    ADD COLUMN priority ENUM('DUSUK', 'ORTA', 'YUKSEK') NOT NULL DEFAULT 'ORTA',
    ADD COLUMN due_date DATE NULL;

-- Durumu hiç atanmamış kullanıcılar (ör. seed'deki admin) aktif sayılır
UPDATE users SET status = 'AKTIF' WHERE status IS NULL;

CREATE TABLE leave_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type ENUM('YILLIK', 'HASTALIK', 'MAZERET') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    note VARCHAR(300) NULL,
    state ENUM('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI') NOT NULL DEFAULT 'BEKLIYOR',
    decided_by BIGINT NULL,
    decided_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_leave_dates (start_date, end_date)
);

CREATE TABLE announcements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    author_id BIGINT NOT NULL,
    pinned BIT(1) NOT NULL DEFAULT b'0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcement_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
