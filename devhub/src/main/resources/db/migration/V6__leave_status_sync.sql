-- DIGER: yöneticinin durum menüsünden elle İzinli yaptığı günler için oluşturulan kayıt türü.
-- IPTAL: kişi İzinli'den erken çıkarıldığında o gün başlayan onaylı izin iptal edilir.
ALTER TABLE leave_requests
    MODIFY COLUMN type ENUM('YILLIK', 'HASTALIK', 'MAZERET', 'DIGER') NOT NULL,
    MODIFY COLUMN state ENUM('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI', 'IPTAL') NOT NULL DEFAULT 'BEKLIYOR';

-- Mevcut veriyi durumlarla eşitle.
-- 1) İzinli olmayan kişilerin bugünü kapsayan onaylı izinleri: bugün başladıysa iptal, önce başladıysa dün biter.
UPDATE leave_requests l JOIN users u ON u.id = l.user_id
SET l.state = 'IPTAL'
WHERE l.state = 'ONAYLANDI' AND u.status <> 'IZINLI'
  AND l.start_date = CURDATE() AND l.end_date >= CURDATE();

UPDATE leave_requests l JOIN users u ON u.id = l.user_id
SET l.end_date = CURDATE() - INTERVAL 1 DAY
WHERE l.state = 'ONAYLANDI' AND u.status <> 'IZINLI'
  AND l.start_date < CURDATE() AND l.end_date >= CURDATE();

-- 2) İzinli olup bugünü kapsayan onaylı izin kaydı olmayan kişiler için bugünlük kayıt.
INSERT INTO leave_requests (user_id, type, start_date, end_date, note, state, decided_at)
SELECT u.id, 'DIGER', CURDATE(), CURDATE(), 'Durum değişikliğiyle kaydedildi', 'ONAYLANDI', CURRENT_TIMESTAMP
FROM users u
WHERE u.status = 'IZINLI'
  AND NOT EXISTS (
      SELECT 1 FROM leave_requests l
      WHERE l.user_id = u.id AND l.state = 'ONAYLANDI'
        AND l.start_date <= CURDATE() AND l.end_date >= CURDATE()
  );
