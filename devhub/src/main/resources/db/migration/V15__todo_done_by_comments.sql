-- ---------------------------------------------------------------------
-- Ortak listelerde kim ne yaptı: kartı tamamlayan kişi ve kart yorumları.
-- ---------------------------------------------------------------------
ALTER TABLE todo_items
    ADD COLUMN done_by_id BIGINT NULL AFTER done_at,
    ADD CONSTRAINT fk_todo_item_done_by FOREIGN KEY (done_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- Bugüne kadar tamamlanan kartları sahibi tamamlamış sayılır.
UPDATE todo_items SET done_by_id = user_id WHERE done = b'1';

CREATE TABLE todo_comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    body VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_comment_item FOREIGN KEY (item_id) REFERENCES todo_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_todo_comment_item (item_id, created_at)
);

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT', 'TODO_RECEIVED',
                     'PROFILE_REQUESTED', 'PROFILE_DECIDED', 'TODO_REMINDER', 'TODO_LIST_ADDED', 'TODO_COMMENT') NOT NULL;
