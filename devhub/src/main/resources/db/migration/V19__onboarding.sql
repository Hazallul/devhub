-- İşe başlangıç listesi: yeni gelen çalışanın ilk günlerde yapacakları.
-- Adımlar yönetici tarafından düzenlenen tek bir şablondur; ilerleme kişi başına tutulur.

CREATE TABLE onboarding_steps (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    -- uygulama içi adres (ör. /docs/git-akisi); adım kartında "Aç" düğmesi olur
    link        VARCHAR(255) NULL,
    -- kendiliğinden tamamlanma kuralı: SIFRE (kendi şifresini belirledi), ILETISIM (iletişim bilgisi ekledi),
    -- DOKUMAN (link'teki dokümanı açtı); NULL = kişi kendisi işaretler
    auto_rule   VARCHAR(20) NULL,
    position    INT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Listesi açılmış kişiler (yeni kullanıcılar otomatik; yönetici var olan biri için de başlatabilir)
CREATE TABLE onboarding_users (
    user_id       BIGINT PRIMARY KEY,
    started_at    DATETIME NOT NULL,
    started_by_id BIGINT NULL,
    completed_at  DATETIME NULL,
    -- kişi tamamlanan kartı Genel Bakış'tan kaldırdı
    closed_at     DATETIME NULL,
    CONSTRAINT fk_onb_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_onb_started_by FOREIGN KEY (started_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE onboarding_progress (
    user_id BIGINT NOT NULL,
    step_id BIGINT NOT NULL,
    done_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, step_id),
    CONSTRAINT fk_onbp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_onbp_step FOREIGN KEY (step_id) REFERENCES onboarding_steps (id) ON DELETE CASCADE
);

ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'TASK_ASSIGNED','TASK_DUE','TASK_COMPLETED','TASK_COMMENT','LEAVE_REQUESTED','LEAVE_DECIDED','LEAVE_REOPENED',
    'PROJECT_ASSIGNED','STATUS_CHANGED','ANNOUNCEMENT','TODO_RECEIVED','PROFILE_REQUESTED','PROFILE_DECIDED',
    'TODO_REMINDER','TODO_LIST_ADDED','TODO_COMMENT','DOC_REVISION_REQUESTED','DOC_REVISION_DECIDED','ONBOARDING_DONE'
) NOT NULL;

INSERT INTO onboarding_steps (title, description, link, auto_rule, position) VALUES
('Kendi şifreni belirle', 'İlk girişte verilen geçici şifreyi yalnızca senin bildiğin bir şifreyle değiştir.', '/settings', 'SIFRE', 1),
('Mühendislik el kitabına göz at', 'Ekibin nasıl çalıştığını, hangi dokümanın nerede olduğunu anlatan giriş yazısı.', '/docs/hos-geldiniz', 'DOKUMAN', 2),
('Geliştirme ortamını kur', 'Kurulum rehberini açıp adımları sırayla uygula; takıldığın yerde ekibe sor.', '/docs/gelistirme-ortami', 'DOKUMAN', 3),
('Git akışını öğren', 'Branch isimlendirme, commit mesajları ve pull request kuralları.', '/docs/git-akisi', 'DOKUMAN', 4),
('İletişim bilgilerini ekle', 'Telefon, LinkedIn ya da GitHub adresini profiline ekle; ekip sana kolayca ulaşsın.', '/settings', 'ILETISIM', 5),
('Ekibini tanı', 'Ekip sayfasında kimin hangi projede çalıştığına bak.', '/team', NULL, 6),
('Kod inceleme rehberini oku', 'İlk pull request''ini açmadan önce incelemede nelere bakıldığını öğren.', '/docs/kod-inceleme', 'DOKUMAN', 7),
('Yöneticinle tanışma görüşmesi yap', 'İlk haftanın hedeflerini ve sana atanacak ilk görevi konuşun.', NULL, NULL, 8);
