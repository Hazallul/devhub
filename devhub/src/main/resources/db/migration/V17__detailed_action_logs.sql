-- ---------------------------------------------------------------------
-- Ayrıntılı sistem logları (denetim kaydı): her kayıt bir kategori, işlem türü, önem seviyesi,
-- etkilenen kayıt (hedef), değişiklik ayrıntıları ve isteğin geldiği IP adresiyle tutulur.
-- Kişisel yapılacaklar kişiye özel olduğu için loglanmaz.
-- ---------------------------------------------------------------------
ALTER TABLE action_logs
    ADD COLUMN category ENUM('OTURUM', 'KULLANICI', 'PROFIL', 'PROJE', 'GOREV', 'IZIN', 'DUYURU', 'SISTEM') NOT NULL DEFAULT 'SISTEM' AFTER id,
    ADD COLUMN action VARCHAR(40) NOT NULL DEFAULT 'BILGI' AFTER category,
    ADD COLUMN level ENUM('BILGI', 'UYARI', 'KRITIK') NOT NULL DEFAULT 'BILGI' AFTER action,
    ADD COLUMN target_type VARCHAR(30) NULL AFTER actor_id,
    ADD COLUMN target_id BIGINT NULL AFTER target_type,
    ADD COLUMN target_name VARCHAR(200) NULL AFTER target_id,
    ADD COLUMN details VARCHAR(2000) NULL AFTER target_name,
    ADD COLUMN ip_address VARCHAR(45) NULL AFTER details,
    ADD INDEX idx_log_created (created_at),
    ADD INDEX idx_log_category (category, created_at),
    ADD INDEX idx_log_actor (actor_id, created_at);

-- Eski kayıtlar: mesajın başındaki "[gg.aa.yyyy ss:dd] " damgası kaldırılır (zaman created_at'te zaten var)
-- ve metinden kategori/işlem türü çıkarılır.
UPDATE action_logs SET message = SUBSTRING(message, LOCATE('] ', message) + 2) WHERE message LIKE '[%] %';
UPDATE action_logs SET category = 'PROJE', action = 'OLUSTURMA' WHERE message LIKE '%projesi oluşturuldu%';
UPDATE action_logs SET category = 'PROJE', action = 'PROJE_ATAMA' WHERE message LIKE '%projesine atandı%';
UPDATE action_logs SET category = 'PROJE', action = 'PROJEDEN_CIKARMA' WHERE message LIKE '%projesinden çıkarıldı%';
UPDATE action_logs SET category = 'GOREV', action = 'OLUSTURMA' WHERE message LIKE '%yeni görev eklendi%';
UPDATE action_logs SET category = 'KULLANICI', action = 'DURUM_DEGISIKLIGI' WHERE message LIKE '%durumu%güncellendi%';
