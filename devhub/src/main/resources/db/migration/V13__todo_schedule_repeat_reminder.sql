-- ---------------------------------------------------------------------
-- Kişisel alan: haftalık plan, hatırlatma, tekrarlayan kartlar ve göreve bağlı kartlar.
-- due_time: kartın saati (due_date ile birlikte); o an gelince sahibine bir kez hatırlatma gider (reminded).
-- repeat_rule: kart tamamlanınca bir sonraki tarihe yeni kopyası açılır.
-- task_id: kart bir DevHub görevinden plana eklendiyse o görev (görev silinirse bağ kopar, kart kalır).
-- ---------------------------------------------------------------------
ALTER TABLE todo_items
    ADD COLUMN due_time TIME NULL AFTER due_date,
    ADD COLUMN reminded BIT(1) NOT NULL DEFAULT b'0' AFTER due_time,
    ADD COLUMN repeat_rule ENUM('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY') NULL AFTER reminded,
    ADD COLUMN task_id BIGINT NULL AFTER repeat_rule,
    ADD CONSTRAINT fk_todo_item_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    ADD INDEX idx_todo_item_reminder (reminded, due_date);

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT', 'TODO_RECEIVED',
                     'PROFILE_REQUESTED', 'PROFILE_DECIDED', 'TODO_REMINDER') NOT NULL;
