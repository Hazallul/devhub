-- Şifremi unuttum: kişi e-postasına gelen kodu girer, yeni şifresini yazar; yönetici onaylayınca şifre geçerli olur.
-- Kod ve yeni şifre yalnızca BCrypt özeti olarak tutulur; düz metin hiçbir yerde saklanmaz ve loglanmaz.

CREATE TABLE password_reset_requests (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT NOT NULL,
    -- KOD_BEKLIYOR → (kod doğru + yeni şifre) ONAY_BEKLIYOR → ONAYLANDI / REDDEDILDI; yeni talep eskisini IPTAL eder,
    -- kod süresi dolan veya çok kez yanlış girilen talep SURESI_DOLDU olur
    state             VARCHAR(20) NOT NULL,
    code_hash         VARCHAR(100) NOT NULL,
    code_expires_at   DATETIME NOT NULL,
    attempts          INT NOT NULL DEFAULT 0,
    verified_at       DATETIME NULL,
    new_password_hash VARCHAR(100) NULL,
    request_ip        VARCHAR(64) NULL,
    decision_note     VARCHAR(500) NULL,
    decided_by        BIGINT NULL,
    decided_at        DATETIME NULL,
    created_at        DATETIME NOT NULL,
    CONSTRAINT fk_pwr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_pwr_decided_by FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_pwr_state (state),
    INDEX idx_pwr_user_created (user_id, created_at)
);

ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'TASK_ASSIGNED','TASK_DUE','TASK_COMPLETED','TASK_COMMENT','LEAVE_REQUESTED','LEAVE_DECIDED','LEAVE_REOPENED',
    'PROJECT_ASSIGNED','STATUS_CHANGED','ANNOUNCEMENT','TODO_RECEIVED','PROFILE_REQUESTED','PROFILE_DECIDED',
    'TODO_REMINDER','TODO_LIST_ADDED','TODO_COMMENT','DOC_REVISION_REQUESTED','DOC_REVISION_DECIDED','ONBOARDING_DONE',
    'PASSWORD_RESET_REQUESTED'
) NOT NULL;
