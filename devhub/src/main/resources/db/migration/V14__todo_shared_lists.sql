-- ---------------------------------------------------------------------
-- Kişisel alan: ortak listeler. Bir listeyi oluşturan kişi o listenin yöneticisidir; başkalarını ekleyebilir
-- ve onlara da yöneticilik verebilir (uygulamanın genel yönetici rolünden bağımsızdır).
-- Listedeki kartları yalnızca üyeler görür. Tek üyeli liste eskisi gibi kişiye özeldir.
-- ---------------------------------------------------------------------
CREATE TABLE todo_list_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    list_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role ENUM('ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_todo_member_list FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_todo_member (list_id, user_id),
    INDEX idx_todo_member_user (user_id)
);

INSERT INTO todo_list_members (list_id, user_id, role)
SELECT id, user_id, 'ADMIN' FROM todo_lists;

-- "Bugüne ekle" işareti kaldırıldı: bugün görünümü artık yalnızca tarihe bakar.
-- Bugüne eklenmiş ama tarihi olmayan açık kartlar kaybolmasın diye tarihleri bugüne kurulur.
UPDATE todo_items SET due_date = my_day WHERE my_day IS NOT NULL AND due_date IS NULL AND done = b'0';
UPDATE todo_items SET my_day = NULL;

ALTER TABLE notifications
    MODIFY type ENUM('TASK_ASSIGNED', 'TASK_DUE', 'TASK_COMPLETED', 'TASK_COMMENT', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
                     'LEAVE_REOPENED', 'PROJECT_ASSIGNED', 'STATUS_CHANGED', 'ANNOUNCEMENT', 'TODO_RECEIVED',
                     'PROFILE_REQUESTED', 'PROFILE_DECIDED', 'TODO_REMINDER', 'TODO_LIST_ADDED') NOT NULL;
