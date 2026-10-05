-- Destek talepleri şirket içi talebe dönüştü: çalışan arıza, erişim, ekipman gibi ihtiyaçlarını yönetime iletir.
-- Müşteri alanları kalkar; türler ve "yanıt bekleniyor" durumu yeni anlamına göre adlandırılır.
UPDATE tickets SET type = CASE type WHEN 'HATA' THEN 'ARIZA' ELSE 'DIGER' END WHERE type IN ('HATA', 'ISTEK', 'SORU');
UPDATE tickets SET status = 'YANIT_BEKLENIYOR' WHERE status = 'MUSTERI_BEKLENIYOR';
ALTER TABLE tickets DROP INDEX idx_ticket_customer, DROP COLUMN customer, DROP COLUMN contact;
