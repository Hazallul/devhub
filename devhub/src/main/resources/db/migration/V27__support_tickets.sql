-- Destek talepleri: müşteriden gelen hata, istek ve sorular. Ekip içi takip içindir (müşteri sisteme girmez).
CREATE TABLE tickets (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    title               VARCHAR(300)  NOT NULL,
    description         TEXT          NULL,
    -- Müşteri (şirket) ve iletişim bilgisi serbest metin; aynı müşterinin talepleri ada göre listelenir
    customer            VARCHAR(120)  NULL,
    contact             VARCHAR(200)  NULL,
    -- HATA, ISTEK, SORU
    type                VARCHAR(20)   NOT NULL,
    -- DUSUK, NORMAL, YUKSEK, ACIL (çözüm hedefi önceliğe göre mesai saatiyle hesaplanır)
    priority            VARCHAR(20)   NOT NULL,
    -- YENI, INCELENIYOR, MUSTERI_BEKLENIYOR, COZULDU, KAPANDI
    status              VARCHAR(30)   NOT NULL,
    assignee_id         BIGINT        NULL,
    requester_id        BIGINT        NULL,
    project_id          BIGINT        NULL,
    task_id             BIGINT        NULL,
    due_at              DATETIME      NULL,
    first_response_at   DATETIME      NULL,
    resolved_at         DATETIME      NULL,
    closed_at           DATETIME      NULL,
    created_at          DATETIME      NOT NULL,
    updated_at          DATETIME      NOT NULL,
    CONSTRAINT fk_ticket_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_requester FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL,
    INDEX idx_ticket_status (status),
    INDEX idx_ticket_assignee (assignee_id),
    INDEX idx_ticket_customer (customer)
);

-- Talebin geçmişi ve yorumları (görev geçmişiyle aynı yapı: EVENT / COMMENT)
CREATE TABLE ticket_activity (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id   BIGINT       NOT NULL,
    actor_id    BIGINT       NULL,
    kind        VARCHAR(10)  NOT NULL,
    message     TEXT         NOT NULL,
    created_at  DATETIME     NOT NULL,
    CONSTRAINT fk_ta_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_ta_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_ta_ticket (ticket_id, created_at)
);

ALTER TABLE attachments ADD CONSTRAINT fk_att_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE;
