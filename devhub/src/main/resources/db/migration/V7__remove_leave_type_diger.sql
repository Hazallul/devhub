-- DIGER türü kaldırıldı: İzinli durumu artık her zaman gerçek bir izin kaydıyla (türü ve tarihleri belli) oluşturulur.
UPDATE leave_requests SET type = 'MAZERET' WHERE type = 'DIGER';

ALTER TABLE leave_requests
    MODIFY COLUMN type ENUM('YILLIK', 'HASTALIK', 'MAZERET') NOT NULL;
