-- Yönetici kararı (onay/ret) kesinleştirilene kadar geri alınabilir; kesinleşen karar değiştirilemez.
ALTER TABLE leave_requests
    ADD COLUMN finalized BIT(1) NOT NULL DEFAULT b'0',
    ADD COLUMN finalized_at TIMESTAMP NULL;

-- Sistem tarafından iptal edilen izinler zaten son hâlindedir.
UPDATE leave_requests SET finalized = b'1', finalized_at = CURRENT_TIMESTAMP WHERE state = 'IPTAL';
