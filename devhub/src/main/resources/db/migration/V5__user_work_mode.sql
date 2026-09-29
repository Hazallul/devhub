-- Kişinin yönetici tarafından belirlenen çalışma şekli (AKTIF = ofiste, UZAKTAN).
-- Çalışan kendi durumunu yalnızca bu değer ile TOPLANTIDA arasında değiştirebilir;
-- izin bitince de bu değere döner.
ALTER TABLE users
    ADD COLUMN work_mode VARCHAR(20) NOT NULL DEFAULT 'AKTIF';

UPDATE users SET work_mode = 'UZAKTAN' WHERE status = 'UZAKTAN';
