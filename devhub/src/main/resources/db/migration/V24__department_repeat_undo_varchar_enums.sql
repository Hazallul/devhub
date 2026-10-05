-- Bildirim türü ve log kategorisi ENUM yerine VARCHAR: yeni modüller (anket, destek talepleri, yedekleme) eklendikçe
-- her seferinde tabloyu değiştirmek gerekmesin. Değerleri Java enum'ları denetler.
ALTER TABLE notifications MODIFY COLUMN type VARCHAR(40) NOT NULL;
ALTER TABLE action_logs MODIFY COLUMN category VARCHAR(20) NOT NULL DEFAULT 'SISTEM';

-- Departman / ekip (ör. Proje, Destek, Test). Yönetici girer; Görevler ve Çalışanlar sayfalarında gruplama ve filtre için.
ALTER TABLE users ADD COLUMN department VARCHAR(60) NULL AFTER job_title;

-- Tekrarlayan kart tamamlanınca açılan kopya. Tamamlama geri alınırsa (kopya hiç değiştirilmediyse) kopya silinir ve
-- tekrar kuralı asıl karta döner; böylece aynı kart iki kez görünmez.
ALTER TABLE todo_items ADD COLUMN repeat_copy_id BIGINT NULL;
