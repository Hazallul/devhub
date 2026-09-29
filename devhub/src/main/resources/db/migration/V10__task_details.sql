-- ---------------------------------------------------------------------
-- Görev ayrıntıları: açıklama ve görevi oluşturan/atayan kişi
-- created_by_id NULL: bilinmiyor (bu migration'dan önce oluşturulmuş görevler)
-- ---------------------------------------------------------------------
ALTER TABLE tasks
    ADD COLUMN description VARCHAR(4000) NULL,
    ADD COLUMN created_by_id BIGINT NULL,
    ADD CONSTRAINT fk_task_creator FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Görev geçmişi ve yorumlar (tek akış). EVENT: sistemin yazdığı değişiklik kaydı, COMMENT: kişinin yorumu.
-- actor_id NULL = sistem. Mesaj işlemi yapanın adını içermez; ad actor'dan gelir (birden fazla yönetici olabilir).
-- ---------------------------------------------------------------------
CREATE TABLE task_activity (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    kind ENUM('EVENT', 'COMMENT') NOT NULL,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_activity_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_activity_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_task_activity_task (task_id, created_at)
);

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT') NOT NULL;
