-- ---------------------------------------------------------------------
-- İzin kararına açıklama + tarih aralığı güvencesi
-- ---------------------------------------------------------------------
-- Sunum verisi betiğinin hafta sonu düzeltmesi bitişi başlangıcın önüne çekebiliyordu; var olan kayıtlar onarılır.
UPDATE leave_requests SET end_date = start_date WHERE end_date < start_date;

ALTER TABLE leave_requests
    ADD COLUMN decision_note VARCHAR(500) NULL,
    ADD CONSTRAINT chk_leave_range CHECK (end_date >= start_date);

-- ---------------------------------------------------------------------
-- Profildeki iletişim bilgileri ve bağlantılar (ek e-posta, telefon, LinkedIn, GitHub...).
-- Kişi kendisi, onay gerekmeden düzenler; ekipteki herkes görebilir.
-- ---------------------------------------------------------------------
CREATE TABLE user_links (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type ENUM('EMAIL', 'PHONE', 'LINKEDIN', 'GITHUB', 'WEBSITE', 'OTHER') NOT NULL,
    label VARCHAR(40) NULL,
    value VARCHAR(300) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_user_link_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_link_user (user_id, position)
);

-- ---------------------------------------------------------------------
-- Ad soyad / unvan değişikliği talepleri: çalışan ister, yönetici onaylar (izinlerdeki akışın benzeri).
-- previous_* talep anındaki değerlerdir; geçmişte neyin neye değiştiği görülebilsin diye saklanır.
-- ---------------------------------------------------------------------
CREATE TABLE profile_change_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(100) NULL,
    previous_full_name VARCHAR(255) NOT NULL,
    previous_job_title VARCHAR(100) NULL,
    state ENUM('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI', 'IPTAL') NOT NULL DEFAULT 'BEKLIYOR',
    decision_note VARCHAR(500) NULL,
    decided_by BIGINT NULL,
    decided_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_request_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_profile_request_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_profile_request_state (state, created_at)
);

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT', 'TODO_RECEIVED',
                     'PROFILE_REQUESTED', 'PROFILE_DECIDED') NOT NULL;
