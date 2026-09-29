CREATE TABLE tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    content VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO tasks (user_id, content) VALUES
(1, 'Admin panelindeki yeni log sistemini test et.'),
(2, 'Mikroservis mimarisi için altyapı hazırlıklarını tamamla.'),
(2, 'Yeni takım üyelerine oryantasyon ver.'),
(3, 'Auth servisinde JWT token süresi bugını düzelt.'),
(4, 'Frontend state management kurgusunu tamamla.'),
(4, 'Dashboard tasarımı için yeni komponentler üret.'),
(5, 'Mobil uygulama için API endpointlerini yaz.'),
(6, 'Tasarım sistemini (Design System) güncelle.'),
(7, 'Veritabanı optimizasyonu için indexleri kontrol et.');
