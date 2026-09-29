-- ---------------------------------------------------------------------
-- Kullanıcı yönetimi ve yıllık izin hakkı
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN active BIT(1) NOT NULL DEFAULT b'1',
    ADD COLUMN hire_date DATE NULL,
    ADD COLUMN annual_leave_days INT NOT NULL DEFAULT 14,
    ADD COLUMN must_change_password BIT(1) NOT NULL DEFAULT b'0';

-- ---------------------------------------------------------------------
-- Loglarda işlemi yapan kişi (NULL = sistem, ör. gece çalışan izin zamanlayıcısı)
-- ---------------------------------------------------------------------
ALTER TABLE action_logs
    ADD COLUMN actor_id BIGINT NULL,
    ADD CONSTRAINT fk_log_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Görevler projeye bağlanır (proje ilerlemesi kişinin o anki projesinden değil, görevin kendi projesinden hesaplanır)
-- ---------------------------------------------------------------------
ALTER TABLE tasks
    ADD COLUMN project_id BIGINT NULL,
    ADD COLUMN completed_at TIMESTAMP NULL,
    ADD CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

UPDATE tasks t JOIN users u ON u.id = t.user_id JOIN projects p ON p.name = u.current_project
SET t.project_id = p.id;
UPDATE tasks SET completed_at = created_at WHERE status = 'TAMAMLANDI';

-- ---------------------------------------------------------------------
-- Resmi tatiller (tam gün). Arife yarım günleri iş günü sayılır. Yönetici Ayarlar'dan ekleyip silebilir.
-- ---------------------------------------------------------------------
CREATE TABLE holidays (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

INSERT INTO holidays (date, name) VALUES
('2026-01-01', 'Yılbaşı'),
('2026-03-20', 'Ramazan Bayramı 1. gün'),
('2026-03-21', 'Ramazan Bayramı 2. gün'),
('2026-03-22', 'Ramazan Bayramı 3. gün'),
('2026-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'),
('2026-05-01', 'Emek ve Dayanışma Günü'),
('2026-05-19', 'Atatürk''ü Anma, Gençlik ve Spor Bayramı'),
('2026-05-27', 'Kurban Bayramı 1. gün'),
('2026-05-28', 'Kurban Bayramı 2. gün'),
('2026-05-29', 'Kurban Bayramı 3. gün'),
('2026-05-30', 'Kurban Bayramı 4. gün'),
('2026-07-15', 'Demokrasi ve Milli Birlik Günü'),
('2026-08-30', 'Zafer Bayramı'),
('2026-10-29', 'Cumhuriyet Bayramı'),
('2027-01-01', 'Yılbaşı'),
('2027-04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'),
('2027-05-01', 'Emek ve Dayanışma Günü'),
('2027-05-19', 'Atatürk''ü Anma, Gençlik ve Spor Bayramı'),
('2027-07-15', 'Demokrasi ve Milli Birlik Günü'),
('2027-08-30', 'Zafer Bayramı'),
('2027-10-29', 'Cumhuriyet Bayramı');

-- ---------------------------------------------------------------------
-- Bildirimler
-- ref_key: aynı olay için tekrar bildirim oluşmasını önler (ör. görev son tarih hatırlatması)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'LEAVE_REQUESTED', 'LEAVE_DECIDED', 'LEAVE_REOPENED',
              'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT') NOT NULL,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) NULL,
    link VARCHAR(200) NULL,
    ref_key VARCHAR(120) NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_notification_ref UNIQUE (user_id, ref_key),
    INDEX idx_notification_user_read (user_id, read_at)
);
