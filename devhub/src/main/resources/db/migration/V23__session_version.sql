-- Oturum sürümü: şifre değişince (kendisi, yönetici geçici şifresi ya da onaylanan şifre sıfırlama) bir artar.
-- Token'lar üretildikleri andaki sürümü taşır; sürümü tutmayan token kabul edilmez, böylece açık oturumlar kapanır.
ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0;
