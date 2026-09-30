-- ---------------------------------------------------------------------
-- Kişisel alan: yapılacaklar. Tüm kayıtlar sahibine özeldir (yöneticiler dahil başkası göremez).
-- ---------------------------------------------------------------------
CREATE TABLE todo_lists (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(9) NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_list_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_todo_list_user (user_id, position)
);

-- list_id NULL = varsayılan "Genel" listesi (gönderilen kartlar da buraya düşer).
-- my_day: kartın "Bugün" görünümüne eklendiği gün; ertesi gün kendiliğinden düşer.
-- due_date ileride eklenecek zamanlama/takvim özelliğinin de temelidir.
-- sent_by_id: kart başka birinden geldiyse gönderen; seen: alıcı kartı açtı mı.
CREATE TABLE todo_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    list_id BIGINT NULL,
    title VARCHAR(300) NOT NULL,
    note VARCHAR(4000) NULL,
    done BIT(1) NOT NULL DEFAULT b'0',
    done_at TIMESTAMP NULL,
    important BIT(1) NOT NULL DEFAULT b'0',
    my_day DATE NULL,
    due_date DATE NULL,
    position INT NOT NULL DEFAULT 0,
    sent_by_id BIGINT NULL,
    sent_message VARCHAR(500) NULL,
    seen BIT(1) NOT NULL DEFAULT b'1',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_item_list FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_item_sender FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_todo_item_user (user_id, list_id, position)
);

CREATE TABLE todo_steps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    done BIT(1) NOT NULL DEFAULT b'0',
    position INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_todo_step_item FOREIGN KEY (item_id) REFERENCES todo_items(id) ON DELETE CASCADE,
    INDEX idx_todo_step_item (item_id, position)
);

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT', 'TODO_RECEIVED') NOT NULL;
