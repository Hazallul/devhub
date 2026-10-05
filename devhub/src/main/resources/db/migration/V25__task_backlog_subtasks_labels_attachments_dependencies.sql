-- Atanmamış görevler: görev önce havuza eklenir, sonra birine atanır. Sahibi olmayan görev Yapılacak'ta bekler.
ALTER TABLE tasks MODIFY COLUMN user_id BIGINT NULL;

-- Alt görevler: görevin kontrol listesi (kartta "2/5" ilerleme olarak görünür).
CREATE TABLE task_subtasks (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id     BIGINT       NOT NULL,
    title       VARCHAR(300) NOT NULL,
    done        BIT(1)       NOT NULL DEFAULT b'0',
    position    INT          NOT NULL DEFAULT 0,
    done_by_id  BIGINT       NULL,
    done_at     DATETIME     NULL,
    created_at  DATETIME     NOT NULL,
    CONSTRAINT fk_subtask_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_subtask_done_by FOREIGN KEY (done_by_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_subtask_task (task_id, position)
);

-- Etiketler: herkes görev etiketlerken yenisini oluşturabilir; yönetici yeniden adlandırır, rengini değiştirir, siler.
CREATE TABLE labels (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(40) NOT NULL,
    color          VARCHAR(20) NOT NULL,
    created_by_id  BIGINT      NULL,
    created_at     DATETIME    NOT NULL,
    CONSTRAINT uq_label_name UNIQUE (name),
    CONSTRAINT fk_label_created_by FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE task_labels (
    task_id  BIGINT NOT NULL,
    label_id BIGINT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    CONSTRAINT fk_tl_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_tl_label FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE,
    INDEX idx_tl_label (label_id)
);

-- Bağımlılık: task_id, blocked_by_id bitmeden Devam Ediyor'a alınamaz ve tamamlanamaz.
CREATE TABLE task_dependencies (
    task_id        BIGINT   NOT NULL,
    blocked_by_id  BIGINT   NOT NULL,
    created_by_id  BIGINT   NULL,
    created_at     DATETIME NOT NULL,
    PRIMARY KEY (task_id, blocked_by_id),
    CONSTRAINT fk_dep_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_blocker FOREIGN KEY (blocked_by_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_created_by FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_dep_self CHECK (task_id <> blocked_by_id),
    INDEX idx_dep_blocker (blocked_by_id)
);

-- Dosya ekleri: bir göreve ya da destek talebine bağlıdır (talep tablosu V27'de; o sütunun FK'si orada eklenir).
-- İçerik veritabanında durur: yedeklere dahil olur, ayrı bir dosya klasörü yönetmek gerekmez.
CREATE TABLE attachments (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id       BIGINT       NULL,
    ticket_id     BIGINT       NULL,
    uploader_id   BIGINT       NULL,
    file_name     VARCHAR(255) NOT NULL,
    content_type  VARCHAR(120) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    data          LONGBLOB     NOT NULL,
    created_at    DATETIME     NOT NULL,
    CONSTRAINT fk_att_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_att_uploader FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_att_task (task_id),
    INDEX idx_att_ticket (ticket_id)
);
