-- ---------------------------------------------------------------------
-- "Önemli" yıldızı kişiye özeldir: ortak listede birinin yıldızladığı kart başkasının "Önemli" görünümüne düşmez.
-- todo_items.important sütunu artık kullanılmaz (eski veriler kart sahibinin yıldızı olarak taşınır).
-- ---------------------------------------------------------------------
CREATE TABLE todo_stars (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    CONSTRAINT fk_todo_star_item FOREIGN KEY (item_id) REFERENCES todo_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_todo_star_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_todo_star (item_id, user_id),
    INDEX idx_todo_star_user (user_id)
);

INSERT INTO todo_stars (item_id, user_id)
SELECT id, user_id FROM todo_items WHERE important = b'1';
