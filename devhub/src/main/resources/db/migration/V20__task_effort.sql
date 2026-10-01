-- İş gücü: görevin tahmini süresi ve gerçekte harcanan çalışma süresi.
-- Süre, görev "Devam Ediyor"dayken açık kalan oturumlardan hesaplanır (yalnızca mesai saatleri, bkz. WorkTimeService).

ALTER TABLE tasks
    ADD COLUMN estimated_minutes INT NULL,
    -- elle düzeltme (dakika, artı ya da eksi): harcanan = oturumlar + düzeltme
    ADD COLUMN spent_adjust_minutes INT NOT NULL DEFAULT 0;

CREATE TABLE task_work_sessions (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id    BIGINT NOT NULL,
    -- oturum sırasında görevin sahibi (görev aktarılırsa yeni kişiye yeni oturum açılır)
    user_id    BIGINT NOT NULL,
    started_at DATETIME NOT NULL,
    -- NULL = görev şu an "Devam Ediyor"
    ended_at   DATETIME NULL,
    CONSTRAINT fk_tws_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_tws_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_tws_task (task_id),
    INDEX idx_tws_user_time (user_id, started_at)
);

-- Şu an "Devam Ediyor"daki görevler için sayım bu andan başlar.
INSERT INTO task_work_sessions (task_id, user_id, started_at)
SELECT id, user_id, UTC_TIMESTAMP() FROM tasks WHERE status = 'DEVAM';
