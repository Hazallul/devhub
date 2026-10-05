-- Anketler: yönetici hazırlar (taslak), yayınlar; hedef kitledeki herkes bir kez yanıtlar.
CREATE TABLE surveys (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    title            VARCHAR(200)  NOT NULL,
    description      VARCHAR(2000) NULL,
    -- TASLAK → ACIK → KAPALI (kapalı anket yeniden açılabilir)
    state            VARCHAR(20)   NOT NULL,
    -- Anonim: yanıtlar kişiyle ilişkilendirilmez (kimin yanıtladığı yalnızca katılım için tutulur)
    anonymous        BIT(1)        NOT NULL DEFAULT b'0',
    -- Katılımcılar anket kapandıktan sonra (ya da yanıtladıktan sonra) özet sonuçları görebilir
    results_public   BIT(1)        NOT NULL DEFAULT b'0',
    -- Hedef kitle: HERKES / DEPARTMAN (audience_values = departman adları) / KISILER (audience_values = kullanıcı kimlikleri),
    -- değerler satır satır. Yayınlanınca kişi listesi survey_recipients'a yazılır.
    audience_type    VARCHAR(20)   NOT NULL DEFAULT 'HERKES',
    audience_values  TEXT          NULL,
    closes_at        DATETIME      NULL,
    created_by_id    BIGINT        NULL,
    created_at       DATETIME      NOT NULL,
    published_at     DATETIME      NULL,
    closed_at        DATETIME      NULL,
    CONSTRAINT fk_survey_created_by FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_survey_state (state)
);

CREATE TABLE survey_questions (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    survey_id  BIGINT       NOT NULL,
    position   INT          NOT NULL,
    -- TEK_SECIM, COKLU_SECIM, PUAN (1-5), METIN
    type       VARCHAR(20)  NOT NULL,
    text       VARCHAR(500) NOT NULL,
    required   BIT(1)       NOT NULL DEFAULT b'1',
    -- Seçenekler, her satırda bir tane (seçmeli sorular için)
    options    TEXT         NULL,
    CONSTRAINT fk_sq_survey FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE,
    INDEX idx_sq_survey (survey_id, position)
);

-- Kime gönderildiği ve kimin yanıtladığı (anonim ankette de; yanıtın içeriği buradan kişiye bağlanmaz)
CREATE TABLE survey_recipients (
    survey_id     BIGINT   NOT NULL,
    user_id       BIGINT   NOT NULL,
    responded     BIT(1)   NOT NULL DEFAULT b'0',
    reminded_at   DATETIME NULL,
    PRIMARY KEY (survey_id, user_id),
    CONSTRAINT fk_sr_survey FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_sr_user (user_id)
);

CREATE TABLE survey_responses (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    survey_id     BIGINT   NOT NULL,
    -- anonim ankette NULL
    user_id       BIGINT   NULL,
    submitted_at  DATETIME NOT NULL,
    CONSTRAINT fk_sresp_survey FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE,
    CONSTRAINT fk_sresp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_sresp_survey (survey_id)
);

CREATE TABLE survey_answers (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    response_id   BIGINT       NOT NULL,
    question_id   BIGINT       NOT NULL,
    -- seçilen seçeneklerin sırası (0'dan), virgülle; tek seçimde tek sayı
    choices       VARCHAR(500) NULL,
    rating        INT          NULL,
    text_value    TEXT         NULL,
    CONSTRAINT fk_sa_response FOREIGN KEY (response_id) REFERENCES survey_responses (id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_question FOREIGN KEY (question_id) REFERENCES survey_questions (id) ON DELETE CASCADE,
    INDEX idx_sa_question (question_id)
);
