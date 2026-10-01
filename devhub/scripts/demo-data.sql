-- =====================================================================
-- DevHub sunum verisi
-- Tüm tarihler çalıştırıldığı güne göre hesaplanır; sunumdan önce tekrar çalıştırılabilir:
--   docker exec -i devhub-mysql mysql -uroot -proot --default-character-set=utf8mb4 devhub < devhub/scripts/demo-data.sql
-- Kullanıcı hesapları ve şifreleri korunur; proje, görev, izin, duyuru, bildirim, log ve kişisel yapılacak tabloları baştan yazılır.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM notifications;
DELETE FROM task_activity;
DELETE FROM profile_change_requests;
DELETE FROM user_links;
DELETE FROM todo_stars;
DELETE FROM todo_comments;
DELETE FROM todo_list_members;
DELETE FROM todo_steps;
DELETE FROM todo_items;
DELETE FROM todo_lists;
DELETE FROM action_logs;
DELETE FROM announcements;
DELETE FROM leave_requests;
DELETE FROM tasks;
DELETE FROM projects;
ALTER TABLE notifications AUTO_INCREMENT = 1;
ALTER TABLE task_activity AUTO_INCREMENT = 1;
ALTER TABLE todo_stars AUTO_INCREMENT = 1;
ALTER TABLE todo_comments AUTO_INCREMENT = 1;
ALTER TABLE todo_list_members AUTO_INCREMENT = 1;
ALTER TABLE todo_steps AUTO_INCREMENT = 1;
ALTER TABLE todo_items AUTO_INCREMENT = 1;
ALTER TABLE todo_lists AUTO_INCREMENT = 1;
ALTER TABLE action_logs AUTO_INCREMENT = 1;
ALTER TABLE announcements AUTO_INCREMENT = 1;
ALTER TABLE leave_requests AUTO_INCREMENT = 1;
ALTER TABLE tasks AUTO_INCREMENT = 1;
ALTER TABLE projects AUTO_INCREMENT = 1;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Projeler
-- ---------------------------------------------------------------------
INSERT INTO projects (id, name, description, status, deadline) VALUES
(1, 'Devhub Core',          'Şirket içi yönetim panelinin çekirdek servisleri: yetkilendirme, izin ve görev modülleri.',        'AKTIF',      CURDATE() + INTERVAL 24 DAY),
(2, 'Mobil Uygulama',       'Saha ekipleri için iOS/Android uygulaması; çevrimdışı çalışma ve anlık bildirimler.',              'AKTIF',      CURDATE() + INTERVAL 41 DAY),
(3, 'Ödeme Altyapısı',      'Yeni ödeme sağlayıcısı entegrasyonu ve mutabakat servisleri. Sağlayıcı sözleşmesi bekleniyor.',   'BEKLEMEDE',  CURDATE() + INTERVAL 18 DAY),
(4, 'Raporlama Paneli',     'Yönetim için gerçek zamanlı KPI, tüketim ve performans raporları.',                               'AKTIF',      CURDATE() + INTERVAL 6 DAY),
(5, 'Enerji Optimizasyonu', 'Tüketim verisinden tasarruf önerileri üreten analiz modülü.',                                     'PLANLAMA',   CURDATE() + INTERVAL 70 DAY),
(6, 'Fatura Düzeltmeleri',  'Fatura hesaplama hatalarının giderilmesi ve geriye dönük düzeltmeler.',                           'TAMAMLANDI', CURDATE() - INTERVAL 3 DAY),
(7, 'Müşteri Portalı',      'Kurumsal müşteriler için self-servis fatura, sözleşme ve destek portalı.',                        'PLANLAMA',   CURDATE() + INTERVAL 90 DAY),
(8, 'Veri Ambarı Göçü',     'Eski raporlama veritabanının yeni veri ambarına taşınması.',                                     'AKTIF',      CURDATE() + INTERVAL 30 DAY);

-- ---------------------------------------------------------------------
-- Kullanıcılar: mevcut 16 hesap güncellenir, 2 yeni kişi eklenir (şifre diğer seed hesaplarıyla aynı)
-- ---------------------------------------------------------------------
UPDATE users SET job_title = 'Sistem Yöneticisi',     current_project = NULL,                   status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'admin@devhub.local';
UPDATE users SET job_title = 'Team Lead',             current_project = 'Devhub Core',          status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'ali.yilmaz@devhub.local';
UPDATE users SET job_title = 'Backend Developer',     current_project = 'Mobil Uygulama',       status = 'TOPLANTIDA', work_mode = 'AKTIF'   WHERE email = 'ayse.kaya@devhub.local';
UPDATE users SET job_title = 'Frontend Developer',    current_project = 'Ödeme Altyapısı',      status = 'IZINLI',     work_mode = 'AKTIF'   WHERE email = 'mehmet.demir@devhub.local';
UPDATE users SET job_title = 'Full-Stack Developer',  current_project = 'Raporlama Paneli',     status = 'UZAKTAN',    work_mode = 'UZAKTAN' WHERE email = 'fatma.celik@devhub.local';
UPDATE users SET job_title = 'Mobile Developer',      current_project = 'Mobil Uygulama',       status = 'IZINLI',     work_mode = 'AKTIF'   WHERE email = 'ahmet.sahin@devhub.local';
UPDATE users SET job_title = 'QA Engineer',           current_project = 'Mobil Uygulama',       status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'zeynep.ozturk@devhub.local';
UPDATE users SET job_title = 'DevOps Engineer',       current_project = 'Veri Ambarı Göçü',     status = 'IZINLI',     work_mode = 'AKTIF'   WHERE email = 'mustafa.koc@devhub.local';
UPDATE users SET job_title = 'UI/UX Designer',        current_project = 'Raporlama Paneli',     status = 'UZAKTAN',    work_mode = 'UZAKTAN' WHERE email = 'elif.arslan@devhub.local';
UPDATE users SET job_title = 'Product Owner',         current_project = 'Devhub Core',          status = 'TOPLANTIDA', work_mode = 'AKTIF'   WHERE email = 'burak.polat@devhub.local';
UPDATE users SET job_title = 'Data Analyst',          current_project = 'Veri Ambarı Göçü',     status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'merve.can@devhub.local';
UPDATE users SET job_title = 'Backend Developer',     current_project = 'Ödeme Altyapısı',      status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'can.dogan@devhub.local';
UPDATE users SET job_title = 'Frontend Developer',    current_project = 'Raporlama Paneli',     status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'seda.yildiz@devhub.local';
UPDATE users SET job_title = 'Full-Stack Developer',  current_project = 'Devhub Core',          status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'emre.kurt@devhub.local';
UPDATE users SET job_title = 'QA Engineer',           current_project = NULL,                   status = 'AKTIF',      work_mode = 'AKTIF'   WHERE email = 'buse.ozdemir@devhub.local';
UPDATE users SET job_title = 'Backend Developer',     current_project = 'Enerji Optimizasyonu', status = 'UZAKTAN',    work_mode = 'UZAKTAN' WHERE email = 'volkan.aydin@devhub.local';

INSERT INTO users (email, password_hash, full_name, role, job_title, current_project, status, work_mode, avatar_color)
SELECT 'kerem.aslan@devhub.local', password_hash, 'Kerem Aslan', 'EMPLOYEE', 'DevOps Engineer', NULL, 'AKTIF', 'AKTIF', '#B7C4A0'
FROM users WHERE email = 'ali.yilmaz@devhub.local'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'kerem.aslan@devhub.local');
INSERT INTO users (email, password_hash, full_name, role, job_title, current_project, status, work_mode, avatar_color)
SELECT 'derya.sen@devhub.local', password_hash, 'Derya Şen', 'EMPLOYEE', 'Scrum Master', 'Müşteri Portalı', 'AKTIF', 'AKTIF', '#E4D9B4'
FROM users WHERE email = 'ali.yilmaz@devhub.local'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'derya.sen@devhub.local');
UPDATE users SET job_title = 'DevOps Engineer', current_project = 'Veri Ambarı Göçü', status = 'AKTIF', work_mode = 'AKTIF' WHERE email = 'kerem.aslan@devhub.local';
UPDATE users SET job_title = 'Scrum Master', current_project = 'Müşteri Portalı', status = 'AKTIF', work_mode = 'AKTIF' WHERE email = 'derya.sen@devhub.local';

-- İşe giriş tarihi ve kıdeme göre yıllık izin hakkı: 1 yıldan az 0, 1–5 yıl 14, 5–15 yıl 20, 15+ yıl 26 gün.
-- (Uygulama hakkı her zaman işe giriş tarihinden hesaplar; bu sütun yalnızca bilgi amaçlıdır.)
DROP TEMPORARY TABLE IF EXISTS h;
CREATE TEMPORARY TABLE h (k VARCHAR(20), hire DATE);
INSERT INTO h VALUES
('admin', '2016-09-01'), ('ali.yilmaz', '2019-03-11'), ('ayse.kaya', '2021-02-15'), ('mehmet.demir', '2023-06-05'),
('fatma.celik', '2020-10-01'), ('ahmet.sahin', '2024-01-08'), ('zeynep.ozturk', '2022-09-12'), ('mustafa.koc', '2010-04-19'),
('elif.arslan', '2023-11-20'), ('burak.polat', '2018-05-14'), ('merve.can', '2024-07-01'), ('can.dogan', '2021-12-06'),
('seda.yildiz', '2025-02-03'), ('emre.kurt', '2025-09-15'), ('buse.ozdemir', '2026-03-02'), ('volkan.aydin', '2012-01-16'),
('kerem.aslan', '2026-08-17'), ('derya.sen', '2019-10-07');
UPDATE users us JOIN h ON h.k = SUBSTRING_INDEX(us.email, '@', 1)
SET us.hire_date = h.hire,
    us.annual_leave_days = CASE
        WHEN TIMESTAMPDIFF(YEAR, h.hire, CURDATE()) >= 15 THEN 26
        WHEN TIMESTAMPDIFF(YEAR, h.hire, CURDATE()) >= 5 THEN 20
        WHEN TIMESTAMPDIFF(YEAR, h.hire, CURDATE()) >= 1 THEN 14
        ELSE 0 END,
    us.active = b'1', us.must_change_password = b'0';

-- İşten ayrılmış, hesabı pasifleştirilmiş eski çalışan (Kullanıcılar sayfasındaki "Pasif" filtresi için)
INSERT INTO users (email, password_hash, full_name, role, job_title, current_project, status, work_mode, avatar_color, active, hire_date, annual_leave_days)
SELECT 'onur.tekin@devhub.local', password_hash, 'Onur Tekin', 'EMPLOYEE', 'Frontend Developer', NULL, 'AKTIF', 'AKTIF', '#B7C4A0', b'0', '2022-04-04', 14
FROM users WHERE email = 'ali.yilmaz@devhub.local'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'onur.tekin@devhub.local');
UPDATE users SET active = b'0', current_project = NULL WHERE email = 'onur.tekin@devhub.local';

-- E-postadan kullanıcı id'si (id'ler ortamdan ortama değişebilir)
DROP TEMPORARY TABLE IF EXISTS u;
CREATE TEMPORARY TABLE u (k VARCHAR(20) PRIMARY KEY, id BIGINT);
-- Yalnızca @devhub.local hesapları (uygulamadan eklenen başka alan adlı hesaplar aynı öneki taşıyabilir)
INSERT INTO u SELECT SUBSTRING_INDEX(email, '@', 1), id FROM users WHERE email LIKE '%@devhub.local';
SET @admin = (SELECT id FROM users WHERE email = 'admin@devhub.local');

-- ---------------------------------------------------------------------
-- Görevler
-- Kurallar:
--  * İzinli kişilerin açık görevi yoktur: işleri izinden önce tamamlanmış ya da ekip arkadaşına devredilmiştir.
--  * Beklemedeki (Ödeme Altyapısı) ve tamamlanmış projelerde açık görev yoktur.
--  * Açık görevlerin son tarihi projenin teslim tarihini ve kişinin izin günlerini aşmaz; hafta sonuna denk gelmez.
-- Herkesin görevi vardır (sunumda boş kart kalmasın); Can'ın ve izinlilerin yalnızca tamamlanmış görevleri vardır.
-- Can'ın yalnızca tamamlanmış görevleri var (projede, açık görevi yok).
DROP TEMPORARY TABLE IF EXISTS t;
CREATE TEMPORARY TABLE t (k VARCHAR(20), content VARCHAR(1000), status VARCHAR(20), priority VARCHAR(10), due INT NULL, hours_ago INT, proj VARCHAR(100) NULL DEFAULT NULL);
INSERT INTO t (k, content, status, priority, due, hours_ago) VALUES
('admin',         'Yıl sonu performans değerlendirme takvimini yayınla',              'YAPILACAK',  'ORTA',   10,   3),
('admin',         'Yeni işe alım ilanlarını onayla',                                  'TAMAMLANDI', 'DUSUK',  NULL, 60),
('ali.yilmaz',    'Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'DEVAM',      'YUKSEK', 2,    30),
('ali.yilmaz',    'Yeni takım üyeleri için oryantasyon dokümanını güncelle',          'YAPILACAK',  'ORTA',   9,    50),
('ali.yilmaz',    'Kod incelemesine otomatik lint kontrolü ekle',                     'YAPILACAK',  'DUSUK',  14,   20),
('ali.yilmaz',    'Rol bazlı yetki matrisini gözden geçir',                           'TAMAMLANDI', 'ORTA',   NULL, 120),
('burak.polat',   'Q4 yol haritası sunumunu hazırla',                                 'DEVAM',      'YUKSEK', 3,    26),
('burak.polat',   'Müşteri geri bildirimlerini backloga aktar',                       'YAPILACAK',  'ORTA',   6,    10),
('burak.polat',   'İzin modülü için kabul kriterlerini yaz',                          'TAMAMLANDI', 'YUKSEK', NULL, 60),
('ayse.kaya',     'Auth servisinde refresh token akışını tamamla',                    'DEVAM',      'YUKSEK', 1,    40),
('ayse.kaya',     'Çevrimdışı senkronizasyon için çakışma çözümleme API''si (Ahmet''ten devir)', 'YAPILACAK', 'YUKSEK', 7, 22),
('ayse.kaya',     'Mobil bildirim servisi için API uç noktalarını yaz',               'YAPILACAK',  'ORTA',   13,   30),
('ayse.kaya',     'Rate limiting ayarlarını production ile eşitle',                   'TAMAMLANDI', 'ORTA',   NULL, 100),
('ahmet.sahin',   'Çevrimdışı mod için yerel önbellek katmanı',                       'TAMAMLANDI', 'YUKSEK', NULL, 90),
('ahmet.sahin',   'Push bildirim izin ekranını yenile',                               'TAMAMLANDI', 'ORTA',   NULL, 160),
('zeynep.ozturk', 'iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'DEVAM', 'YUKSEK', 1, 22),
('zeynep.ozturk', 'Mobil uygulama regresyon test setini güncelle',                    'DEVAM',      'ORTA',   3,    20),
('zeynep.ozturk', 'Ödeme ekranı için uçtan uca test senaryoları yaz',                 'YAPILACAK',  'ORTA',   10,   12),
('zeynep.ozturk', 'Android 15 cihaz matrisi testleri',                                'TAMAMLANDI', 'DUSUK',  NULL, 150),
('mehmet.demir',  '3D Secure yönlendirme ekranı prototipi',                           'TAMAMLANDI', 'ORTA',   NULL, 110),
('mehmet.demir',  'Ödeme formu için tasarım token''larını güncelle',                  'TAMAMLANDI', 'DUSUK',  NULL, 150),
('can.dogan',     'Yeni ödeme sağlayıcısı için sandbox entegrasyonu',                 'TAMAMLANDI', 'YUKSEK', NULL, 200),
('can.dogan',     'Mutabakat raporu için veri modeli',                                'TAMAMLANDI', 'ORTA',   NULL, 170),
('fatma.celik',   'KPI kartları için gerçek zamanlı veri akışı (WebSocket)',          'DEVAM',      'YUKSEK', 2,    48),
('fatma.celik',   'Yavaş çalışan tüketim sorgusunu optimize et',                      'YAPILACAK',  'YUKSEK', -1,   96),
('fatma.celik',   'Rapor dışa aktarma (Excel/PDF) servisi',                           'YAPILACAK',  'ORTA',   5,    24),
('elif.arslan',   'Raporlama paneli için kullanıcı testlerini planla',                'DEVAM',      'ORTA',   2,    30),
('elif.arslan',   'Boş durum ve hata ekranı illüstrasyonları',                        'YAPILACAK',  'DUSUK',  5,    8),
('elif.arslan',   'Grafik bileşenleri için tasarım sistemi güncellemesi',             'TAMAMLANDI', 'ORTA',   NULL, 110),
('seda.yildiz',   'KPI kartlarını yeni tasarıma taşı',                                'DEVAM',      'YUKSEK', 2,    20),
('seda.yildiz',   'Filtre çubuğunu mobil uyumlu hâle getir',                          'YAPILACAK',  'ORTA',   6,    14),
('mustafa.koc',   'Veri ambarı için Kubernetes staging ortamını kur',                 'TAMAMLANDI', 'YUKSEK', NULL, 130),
('mustafa.koc',   'Yedekleme ve geri yükleme prosedürünü dokümante et',               'TAMAMLANDI', 'ORTA',   NULL, 110),
('merve.can',     'Eski raporlama tablolarının veri eşlemesini çıkar',                'DEVAM',      'YUKSEK', 3,    36),
('merve.can',     'Staging ortamında ilk veri aktarım denemesini yap',                'YAPILACAK',  'ORTA',   7,    26),
('merve.can',     'Veri kalitesi kontrolleri için SQL test paketi',                   'YAPILACAK',  'ORTA',   9,    18),
('merve.can',     'Mobil kullanım metriklerini panoya bağla',                         'TAMAMLANDI', 'ORTA',   NULL, 140),
('buse.ozdemir',  'Test otomasyon araçlarını karşılaştır ve öneri hazırla',           'YAPILACAK',  'DUSUK',  7,    1),
('buse.ozdemir',  'Giriş ekranı için erişilebilirlik test listesi',                   'DEVAM',      'ORTA',   4,    30),
('buse.ozdemir',  'Hata kayıt şablonunu ekiple paylaş',                               'TAMAMLANDI', 'DUSUK',  NULL, 60),
('emre.kurt',     'Görev panosunda klavye ile taşıma desteği',                        'DEVAM',      'ORTA',   4,    28),
('emre.kurt',     'Bildirim merkezi için okunmamış sayacı testleri',                  'YAPILACAK',  'DUSUK',  8,    10),
('volkan.aydin',  'Tüketim verisi için anomali tespiti prototipi',                    'DEVAM',      'YUKSEK', 6,    44),
('volkan.aydin',  'Tasarruf önerisi algoritması için veri seti hazırlığı',            'YAPILACAK',  'ORTA',   12,   20),
('volkan.aydin',  'Enerji Optimizasyonu teknik keşif dokümanı',                       'TAMAMLANDI', 'ORTA',   NULL, 90),
('derya.sen',     'Müşteri Portalı için sprint 1 planlamasını yap',                   'DEVAM',      'YUKSEK', 3,    30),
('derya.sen',     'Paydaş görüşmeleri için toplantı takvimi oluştur',                 'YAPILACAK',  'ORTA',   5,    12),
('derya.sen',     'Portal gereksinim dokümanını müşteriyle paylaş',                   'TAMAMLANDI', 'ORTA',   NULL, 70),
('kerem.aslan',   'Veri ambarı için CI/CD hattını kur',                               'DEVAM',      'YUKSEK', 5,    40),
('kerem.aslan',   'Staging sunucularına izleme ajanlarını yükle',                     'YAPILACAK',  'ORTA',   9,    16),
('kerem.aslan',   'Yeni geliştirici makinesi kurulum betiği',                         'TAMAMLANDI', 'DUSUK',  NULL, 150),
('seda.yildiz',   'Rapor tablolarında sıralama ve sayfalama',                         'YAPILACAK',  'DUSUK',  11,   6),
('burak.polat',   'Müşteri Portalı için ürün vizyon dokümanı',                         'TAMAMLANDI', 'ORTA',   NULL, 80);

-- Son iki ayda tamamlanmış işler (Raporlar'daki haftalık grafik ve proje ilerlemesi için)
INSERT INTO t (k, content, status, priority, due, hours_ago, proj) VALUES
('burak.polat',   'Fatura düzeltmeleri için geriye dönük hesaplama raporu',            'TAMAMLANDI', 'YUKSEK', NULL, 1300, 'Fatura Düzeltmeleri'),
('onur.tekin',    'Fatura ekranında KDV yuvarlama hatasını düzelt',                    'TAMAMLANDI', 'YUKSEK', NULL, 1250, 'Fatura Düzeltmeleri'),
('onur.tekin',    'Fatura PDF şablonunu yeni tasarıma taşı',                          'TAMAMLANDI', 'ORTA',   NULL, 1100, 'Fatura Düzeltmeleri'),
('burak.polat',   'Düzeltilen faturalar için müşteri bilgilendirme metni',             'TAMAMLANDI', 'ORTA',   NULL, 900,  'Fatura Düzeltmeleri'),
('ali.yilmaz',    'Kimlik doğrulama servisini Spring Boot 4''e yükselt',                'TAMAMLANDI', 'YUKSEK', NULL, 1000, NULL),
('emre.kurt',     'Görev panosu için sürükle-bırak altyapısı',                         'TAMAMLANDI', 'ORTA',   NULL, 780,  NULL),
('ayse.kaya',     'Mobil API için sayfalama desteği',                                 'TAMAMLANDI', 'ORTA',   NULL, 720,  NULL),
('zeynep.ozturk', 'Giriş akışı için otomasyon testleri',                              'TAMAMLANDI', 'ORTA',   NULL, 600,  NULL),
('fatma.celik',   'KPI sorguları için indeks çalışması',                              'TAMAMLANDI', 'YUKSEK', NULL, 540,  NULL),
('seda.yildiz',   'Raporlama paneli için grafik bileşeni prototipi',                  'TAMAMLANDI', 'ORTA',   NULL, 460,  NULL),
('merve.can',     'Eski rapor tablolarının envanterini çıkar',                        'TAMAMLANDI', 'ORTA',   NULL, 400,  NULL),
('can.dogan',     'Ödeme sağlayıcısı karşılaştırma dokümanı',                          'TAMAMLANDI', 'DUSUK',  NULL, 350,  NULL),
('elif.arslan',   'Raporlama paneli kullanıcı akışı tasarımı',                        'TAMAMLANDI', 'ORTA',   NULL, 300,  NULL),
('emre.kurt',     'İzin modülü için takvim bileşeni',                                 'TAMAMLANDI', 'ORTA',   NULL, 260,  NULL);

-- Görev, verildiği projeye bağlanır (belirtilmediyse kişinin şu anki projesi).
-- Tamamlanan görevin bitiş zamanı: oluşturulduktan sonra, süresinin yarısında (en fazla 5 gün).
INSERT INTO tasks (user_id, content, status, priority, due_date, created_at, project_id, completed_at)
SELECT u.id, t.content, t.status, t.priority,
       IF(t.due IS NULL, NULL, CURDATE() + INTERVAL t.due DAY),
       NOW() - INTERVAL t.hours_ago HOUR,
       (SELECT p.id FROM projects p JOIN users us ON us.id = u.id WHERE p.name = COALESCE(t.proj, us.current_project)),
       IF(t.status = 'TAMAMLANDI', NOW() - INTERVAL t.hours_ago HOUR + INTERVAL LEAST(GREATEST(t.hours_ago DIV 2, 1), 120) HOUR, NULL)
FROM t JOIN u ON u.k = t.k;

-- ---------------------------------------------------------------------
-- İzinler (İzinli olanların kaydı bugünü kapsar)
-- ---------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS l;
CREATE TEMPORARY TABLE l (k VARCHAR(20), type VARCHAR(10), s INT, e INT, note VARCHAR(300), state VARCHAR(12), fin BOOLEAN, days_ago INT);
INSERT INTO l VALUES
('mehmet.demir',  'YILLIK',   -1,  3,  'Aile ziyareti',                    'ONAYLANDI',  TRUE,  9),
('ahmet.sahin',   'HASTALIK', -1,  1,  'Grip, doktor raporu var',          'ONAYLANDI',  FALSE, 1),
('mustafa.koc',   'YILLIK',   -4,  6,  'Yaz tatili',                       'ONAYLANDI',  TRUE,  20),
('can.dogan',     'YILLIK',    8,  12, 'Kısa tatil',                       'ONAYLANDI',  TRUE,  5),
('elif.arslan',   'YILLIK',    15, 19, 'Yurt dışı seyahati',               'ONAYLANDI',  FALSE, 2),
('fatma.celik',   'MAZERET',   3,  3,  'Tapu işlemi',                      'BEKLIYOR',   FALSE, 0),
('seda.yildiz',   'MAZERET',   1,  1,  'Diş tedavisi',                     'BEKLIYOR',   FALSE, 0),
('zeynep.ozturk', 'YILLIK',    20, 24, 'Düğün',                            'BEKLIYOR',   FALSE, 1),
('burak.polat',   'YILLIK',   -12, -10,'Sprint kapanışına denk geliyor',   'REDDEDILDI', TRUE,  15),
('ali.yilmaz',    'YILLIK',   -25, -21,'Bayram tatili',                    'ONAYLANDI',  TRUE,  40),
('merve.can',     'HASTALIK', -7,  -7, 'Migren',                           'ONAYLANDI',  TRUE,  7),
('zeynep.ozturk', 'YILLIK',   -33, -31,'Hafta sonuna ekleme',              'ONAYLANDI',  TRUE,  40),
('elif.arslan',   'MAZERET',  -16, -16,'Taşınma',                          'ONAYLANDI',  TRUE,  18),
('seda.yildiz',   'HASTALIK', -19, -18,'Soğuk algınlığı',                  'ONAYLANDI',  TRUE,  19),
('volkan.aydin',  'YILLIK',   -45, -38,'Yaz tatili',                       'ONAYLANDI',  TRUE,  60),
('derya.sen',     'YILLIK',   -28, -26,'Aile ziyareti',                    'ONAYLANDI',  TRUE,  35),
('emre.kurt',     'MAZERET',  -9,  -9, 'Resmi işlemler',                   'ONAYLANDI',  TRUE,  11),
('kerem.aslan',   'MAZERET',  -3,  -3, 'Ev taşıma',                        'REDDEDILDI', FALSE, 6),
('can.dogan',     'HASTALIK', -36, -35,'Grip',                             'ONAYLANDI',  TRUE,  36);

INSERT INTO leave_requests (user_id, type, start_date, end_date, note, state, decided_by, decided_at, finalized, finalized_at, created_at)
SELECT u.id, l.type, CURDATE() + INTERVAL l.s DAY, CURDATE() + INTERVAL l.e DAY, l.note, l.state,
       IF(l.state = 'BEKLIYOR', NULL, @admin),
       IF(l.state = 'BEKLIYOR', NULL, NOW() - INTERVAL l.days_ago DAY + INTERVAL 3 HOUR),
       l.fin,
       IF(l.fin, NOW() - INTERVAL l.days_ago DAY + INTERVAL 5 HOUR, NULL),
       NOW() - INTERVAL l.days_ago DAY - INTERVAL 2 HOUR
FROM l JOIN u ON u.k = l.k;

-- Resmi tatil köprüsü: bir haftadan sonraki ilk tatilin iki gün öncesinden ertesi gününe (tatil iş gününden düşülür)
SET @h = (SELECT MIN(date) FROM holidays WHERE date > CURDATE() + INTERVAL 7 DAY AND DAYOFWEEK(date) NOT IN (1, 7));
INSERT INTO leave_requests (user_id, type, start_date, end_date, note, state, decided_by, decided_at, finalized, finalized_at, created_at)
SELECT u.id, 'YILLIK', @h - INTERVAL 2 DAY, @h + INTERVAL 1 DAY, CONCAT((SELECT name FROM holidays WHERE date = @h), ' köprüsü'),
       'ONAYLANDI', @admin, NOW() - INTERVAL 3 DAY, b'1', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 4 DAY
FROM u WHERE u.k = 'merve.can' AND @h IS NOT NULL;

-- ---------------------------------------------------------------------
-- Hafta sonu düzeltmesi (tarihler çalıştırılan güne göre kaydığı için sonradan normalize edilir)
--  * Son tarih / teslim: Cumartesi → Cuma, Pazar → Pazartesi
--  * İzin başlangıcı hafta sonundaysa Pazartesi'ye, bitişi hafta sonundaysa Cuma'ya çekilir (başlangıçtan önceye düşmez)
-- ---------------------------------------------------------------------
UPDATE tasks    SET due_date = due_date - INTERVAL 1 DAY WHERE DAYOFWEEK(due_date) = 7;
UPDATE tasks    SET due_date = due_date + INTERVAL 1 DAY WHERE DAYOFWEEK(due_date) = 1;
UPDATE projects SET deadline = deadline - INTERVAL 1 DAY WHERE DAYOFWEEK(deadline) = 7;
UPDATE projects SET deadline = deadline + INTERVAL 1 DAY WHERE DAYOFWEEK(deadline) = 1;
-- Başlangıç ve bitiş tek UPDATE'te düzeltilir: MySQL atamaları soldan sağa uygular, bu yüzden GREATEST içindeki
-- start_date yeni değerdir. Yalnızca hafta sonuna denk gelen bir izin böylece tek güne (Pazartesi) iner;
-- bitiş hiçbir zaman başlangıcın önüne düşmez (eskiden "5 Eki – 2 Eki" gibi ters aralıklar oluşabiliyordu).
UPDATE leave_requests SET
  start_date = start_date + INTERVAL (CASE DAYOFWEEK(start_date) WHEN 7 THEN 2 WHEN 1 THEN 1 ELSE 0 END) DAY,
  end_date = GREATEST(start_date, end_date - INTERVAL (CASE DAYOFWEEK(end_date) WHEN 7 THEN 1 WHEN 1 THEN 2 ELSE 0 END) DAY);
-- Proje teslim tarihi hafta sonundan kaydıysa, o projenin açık görevleri teslimi aşmasın.
UPDATE tasks t JOIN users us ON us.id = t.user_id JOIN projects p ON p.name = us.current_project
SET t.due_date = p.deadline
WHERE t.status <> 'TAMAMLANDI' AND t.due_date > p.deadline;
-- Açık görevin son tarihi sahibinin izin günlerine denk gelmesin: iznin bitişinden sonraki ilk iş gününe alınır.
UPDATE tasks t
JOIN leave_requests lr ON lr.user_id = t.user_id AND lr.state IN ('ONAYLANDI', 'BEKLIYOR') AND t.due_date BETWEEN lr.start_date AND lr.end_date
SET t.due_date = lr.end_date + INTERVAL (CASE DAYOFWEEK(lr.end_date) WHEN 6 THEN 3 WHEN 7 THEN 2 ELSE 1 END) DAY
WHERE t.status <> 'TAMAMLANDI';

-- ---------------------------------------------------------------------
-- Görev ayrıntıları: atayan kişi, açıklamalar, geçmiş ve yorumlar
-- Geçmiş mesajları uygulamanın yazdığıyla aynıdır; işlemi yapanın adı actor_id'den gelir.
-- ---------------------------------------------------------------------
-- Görevleri çoğunlukla yönetici atar; aşağıdakileri kişiler kendileri eklemiştir.
UPDATE tasks SET created_by_id = @admin;
UPDATE tasks SET created_by_id = user_id WHERE content IN (
  'Kod incelemesine otomatik lint kontrolü ekle',
  'Müşteri geri bildirimlerini backloga aktar',
  'Boş durum ve hata ekranı illüstrasyonları',
  'Test otomasyon araçlarını karşılaştır ve öneri hazırla',
  'Veri kalitesi kontrolleri için SQL test paketi',
  'Mobil kullanım metriklerini panoya bağla');

UPDATE tasks tk JOIN (
  SELECT 'Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir' AS content,
         'Perşembe 10:00 planlamasına kadar:\n- Backlog maddelerini puanla\n- Müşteri taleplerini öncelik sırasına koy\n- Kapasiteyi izinleri hesaba katarak çıkar' AS d
  UNION ALL SELECT 'Auth servisinde refresh token akışını tamamla',
         'Access token 15 dakika, refresh token 7 gün geçerli olacak. Refresh token her kullanımda yenilenmeli (rotasyon); çalınmış bir token tespit edilirse kullanıcının tüm oturumları kapatılmalı.'
  UNION ALL SELECT 'Yavaş çalışan tüketim sorgusunu optimize et',
         'Tüketim raporu şu an yaklaşık 12 saniyede açılıyor, hedef 2 saniyenin altı. EXPLAIN çıktısı ve örnek parametreler ortak klasörde.'
  UNION ALL SELECT 'iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)',
         'Uygulama çevrimdışı moddan çıkarken senkronizasyon ekranında çöküyor. Ahmet izne çıkmadan önce ilk incelemeyi yaptı; cihaz kayıtları ortak klasörde.'
  UNION ALL SELECT 'Çevrimdışı senkronizasyon için çakışma çözümleme API''si (Ahmet''ten devir)',
         'Aynı kayıt iki cihazda değiştiğinde "son yazan kazanır" yerine alan bazlı birleştirme yapılacak. Ahmet''in taslak dokümanı üzerinden devam edilecek.'
  UNION ALL SELECT 'KPI kartları için gerçek zamanlı veri akışı (WebSocket)',
         'Kartlar 5 saniyede bir güncellenecek. Bağlantı koparsa kartlar son değeri göstermeye devam etmeli ve üstte bir uyarı çıkmalı.'
  UNION ALL SELECT 'Q4 yol haritası sunumunu hazırla',
         'Yönetim sunumu için: tamamlanan projeler, Q4 hedefleri, riskler ve kaynak ihtiyacı. Taslak cuma günü paylaşılacak.'
  UNION ALL SELECT 'Yıl sonu performans değerlendirme takvimini yayınla',
         'Takvim tüm çalışanlara duyurulacak; öz değerlendirme formu için son teslim tarihi eklenecek.'
  UNION ALL SELECT 'Staging ortamında ilk veri aktarım denemesini yap',
         'Önce son 3 ayın verisiyle deneme yapılacak; aktarım süresi ve hatalı kayıt sayısı raporlanacak.'
  UNION ALL SELECT 'Rapor dışa aktarma (Excel/PDF) servisi',
         'Excel ve PDF çıktısı. Seçili filtreler ve tarih aralığı dosyanın başlığında görünmeli.'
) x ON x.content = tk.content
SET tk.description = x.d;

-- Oluşturma kaydı (devredilen görevler ayrıca aşağıda)
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, tk.created_by_id, 'EVENT',
       IF(tk.created_by_id = tk.user_id, 'görevi oluşturdu', CONCAT('görevi oluşturdu ve ', us.full_name, ' kişisine atadı')),
       tk.created_at
FROM tasks tk JOIN users us ON us.id = tk.user_id
WHERE tk.content NOT LIKE '%(Ahmet''ten devir)%';

-- Ahmet izne çıkmadan önce ona atanan, sonra ekip arkadaşına aktarılan görevler
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, @admin, 'EVENT', 'görevi oluşturdu ve Ahmet Şahin kişisine atadı', tk.created_at - INTERVAL 6 DAY
FROM tasks tk WHERE tk.content LIKE '%(Ahmet''ten devir)%';
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, @admin, 'EVENT', CONCAT('görevi aktardı: Ahmet Şahin → ', us.full_name), tk.created_at
FROM tasks tk JOIN users us ON us.id = tk.user_id WHERE tk.content LIKE '%(Ahmet''ten devir)%';

-- Durum değişiklikleri: devam edenler ömrünün üçte birinde başladı; bitenler yarı yolda başlayıp completed_at'te bitti
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, tk.user_id, 'EVENT', 'durumu değiştirdi: Yapılacak → Devam Ediyor',
       tk.created_at + INTERVAL GREATEST(TIMESTAMPDIFF(MINUTE, tk.created_at, NOW()) DIV 3, 30) MINUTE
FROM tasks tk WHERE tk.status = 'DEVAM';
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, tk.user_id, 'EVENT', 'durumu değiştirdi: Yapılacak → Devam Ediyor',
       tk.created_at + INTERVAL (TIMESTAMPDIFF(MINUTE, tk.created_at, tk.completed_at) DIV 2) MINUTE
FROM tasks tk WHERE tk.status = 'TAMAMLANDI';
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, tk.user_id, 'EVENT', 'durumu değiştirdi: Devam Ediyor → Tamamlandı', tk.completed_at
FROM tasks tk WHERE tk.status = 'TAMAMLANDI';

-- Devredilen görevler Ahmet'e 6 gün önce atanmıştı
UPDATE tasks SET created_at = created_at - INTERVAL 6 DAY WHERE content LIKE '%(Ahmet''ten devir)%';

-- Yöneticinin sonradan yaptığı düzenlemeler
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, @admin, 'EVENT', 'önceliği değiştirdi: Orta → Yüksek', NOW() - INTERVAL 70 HOUR
FROM tasks tk WHERE tk.content = 'Yavaş çalışan tüketim sorgusunu optimize et';
INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, @admin, 'EVENT', CONCAT('son tarihi ', DATE_FORMAT(tk.due_date, '%d.%m.%Y'), ' olarak belirledi'), NOW() - INTERVAL 20 HOUR
FROM tasks tk WHERE tk.content = 'Q4 yol haritası sunumunu hazırla';

-- Yorumlar (izinli kişiler yorum yazmaz; her yorum görev oluşturulduktan sonra)
DROP TEMPORARY TABLE IF EXISTS c;
CREATE TEMPORARY TABLE c (content VARCHAR(1000), author VARCHAR(20), text VARCHAR(1000), hours_ago INT);
INSERT INTO c VALUES
('Müşteri Portalı için sprint 1 planlamasını yap', 'admin', 'Portal için ilk sprintte giriş ve fatura listesi yeterli olur.', 20),
('Müşteri Portalı için sprint 1 planlamasını yap', 'derya.sen', 'Anlaştık, kapsamı buna göre daralttım; tahminleri yarın netleştiriyorum.', 15),
('Tüketim verisi için anomali tespiti prototipi', 'volkan.aydin', 'İlk sonuçlar umut verici; yanlış alarm oranı %8 civarında.', 10),
('Tüketim verisi için anomali tespiti prototipi', 'admin', 'Güzel. Haftaya kısa bir demo yapalım.', 6),
('Veri ambarı için CI/CD hattını kur', 'kerem.aslan', 'Pipeline taslağı hazır, staging deploy adımını test ediyorum.', 12),
('Veri ambarı için CI/CD hattını kur', 'ali.yilmaz', 'Lint ve birim test adımlarını da ekleyebilir misin?', 8),
('Görev panosunda klavye ile taşıma desteği', 'ali.yilmaz', 'Erişilebilirlik için çok iyi olur; ok tuşlarıyla sütun değiştirme de eklensin.', 14),
('Giriş ekranı için erişilebilirlik test listesi', 'seda.yildiz', 'Kontrast kontrolünü ben de paylaştım, listeye ekleyebilirsin.', 9),
('Staging ortamında ilk veri aktarım denemesini yap', 'kerem.aslan', 'Aktarım için ayrı bir servis hesabı açtım, bilgileri sana ilettim.', 7),
('Rapor dışa aktarma (Excel/PDF) servisi', 'elif.arslan', 'PDF şablonu için tasarımı perşembeye kadar paylaşırım.', 5),
('Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'burak.polat', 'Backlog''daki müşteri taleplerini etiketledim, önceliklendirmede kullanabilirsin.', 20),
('Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'ali.yilmaz', 'Teşekkürler, perşembeden önce son hâlini paylaşırım.', 18),
('Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'admin', 'Sunumda Q4 hedefleriyle bağlantıyı da gösterelim.', 4),
('Auth servisinde refresh token akışını tamamla', 'ali.yilmaz', 'Token rotasyonunu da bu kapsamda ele alalım.', 30),
('Auth servisinde refresh token akışını tamamla', 'ayse.kaya', 'Rotasyon eklendi, yarın test ortamına alıyorum.', 6),
('Yavaş çalışan tüketim sorgusunu optimize et', 'admin', 'Bu görev gecikti; bugün kısa bir durum güncellemesi alabilir miyim?', 26),
('Yavaş çalışan tüketim sorgusunu optimize et', 'fatma.celik', 'İndeks denemesi sürüyor. KPI akışı biter bitmez buna geçiyorum.', 22),
('iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'zeynep.ozturk', 'Hata yalnızca iOS 19.1''de ve çevrimdışıyken çıkıyor; ekran kaydını ortak klasöre ekledim.', 10),
('KPI kartlarını yeni tasarıma taşı', 'elif.arslan', 'Figma''daki son varyant onaylandı, boşluk değerlerini güncelledim.', 12),
('Eski raporlama tablolarının veri eşlemesini çıkar', 'admin', 'Eşleme dokümanını Veri Ambarı klasörüne de koyalım.', 8);

INSERT INTO task_activity (task_id, actor_id, kind, message, created_at)
SELECT tk.id, us.id, 'COMMENT', c.text, NOW() - INTERVAL c.hours_ago HOUR
FROM c JOIN tasks tk ON tk.content = c.content JOIN users us ON us.email = CONCAT(c.author, '@devhub.local');

-- ---------------------------------------------------------------------
-- Duyurular
-- ---------------------------------------------------------------------
INSERT INTO announcements (title, content, author_id, pinned, created_at)
SELECT x.title, x.content, @admin, x.pinned, NOW() - INTERVAL x.hours_ago HOUR
FROM (
  SELECT 'Sprint 15 planlaması' AS title, 'Perşembe 10:00''da tüm ekiplerin katılımıyla sprint planlaması yapılacak. Lütfen backlog maddelerinizi önceden güncelleyin.' AS content, b'1' AS pinned, 5 AS hours_ago
  UNION ALL SELECT 'Yeni izin süreci', 'İzin talepleri artık DevHub üzerinden oluşturuluyor. Yönetici onayından sonra durumunuz izin başladığı gün otomatik olarak “İzinli” olur.', b'0', 28
  UNION ALL SELECT 'Ekim ayı ekip buluşması', 'Ayın son cuma günü ofiste kahvaltılı ekip buluşması yapacağız. Katılım durumunuzu takım liderinize iletin.', b'0', 52
  UNION ALL SELECT 'Parola yenileme hatırlatması', 'Güvenlik politikası gereği tüm hesapların parolası bu ay sonuna kadar yenilenmelidir.', b'0', 96
) x;

-- ---------------------------------------------------------------------
-- Sistem logları (denetim kaydı): oturumlar, kullanıcı yönetimi, projeler, görevler, duyurular, sistem
-- (İzin ve profil talebi logları en sonda, gerçek kayıtlardan üretilir.)
-- ---------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS g;
-- days_ago/clock: mesai saatinde geçmiş bir an (İstanbul saati); hours_ago doluysa "şu andan X saat önce".
-- actor: işlemi yapan kişinin e-posta öneki; NULL = sistem veya tanınmayan kişi (başarısız giriş)
CREATE TEMPORARY TABLE g (days_ago INT, clock TIME NULL, hours_ago INT NULL, category VARCHAR(20), action VARCHAR(40), level VARCHAR(10),
                          message VARCHAR(500), actor VARCHAR(30) NULL, target_type VARCHAR(30) NULL, target_name VARCHAR(200) NULL,
                          details VARCHAR(2000) NULL, ip VARCHAR(45) NULL);
INSERT INTO g VALUES
(10, '08:52', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'admin', 'KULLANICI', 'Admin', NULL, NULL),
(10, '09:40', NULL, 'PROJE', 'OLUSTURMA', 'BILGI', 'Yeni proje oluşturuldu: Veri Ambarı Göçü', 'admin', 'PROJE', 'Veri Ambarı Göçü', 'Aşama: Aktif
Açıklama: Eski raporlama veritabanının yeni veri ambarına taşınması.', NULL),
(10, '09:52', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Mustafa Koç, Veri Ambarı Göçü projesine atandı', 'admin', 'KULLANICI', 'Mustafa Koç', 'Proje: — → Veri Ambarı Göçü', NULL),
(10, '09:53', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Merve Can, Veri Ambarı Göçü projesine atandı', 'admin', 'KULLANICI', 'Merve Can', 'Proje: Raporlama Paneli → Veri Ambarı Göçü', NULL),
(10, '11:15', NULL, 'KULLANICI', 'OLUSTURMA', 'BILGI', 'Yeni kullanıcı oluşturuldu: Kerem Aslan', 'admin', 'KULLANICI', 'Kerem Aslan', 'E-posta: kerem.aslan@devhub.local
Rol: Çalışan
Unvan: DevOps Engineer
Yıllık izin hakkı: 14 gün
Geçici şifre verildi; ilk girişte değiştirilmesi zorunlu', NULL),
(10, '13:05', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'kerem.aslan', 'KULLANICI', 'Kerem Aslan', 'Geçici şifreyle giriş: şifre değişikliği bekleniyor', NULL),
(10, '13:06', NULL, 'OTURUM', 'SIFRE_DEGISTIRME', 'BILGI', 'Şifresini değiştirdi', 'kerem.aslan', 'KULLANICI', 'Kerem Aslan', 'Geçici şifre ilk girişte değiştirildi', NULL),
(9, '08:47', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'ali.yilmaz', 'KULLANICI', 'Ali Yılmaz', NULL, NULL),
(9, '09:02', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'ayse.kaya', 'KULLANICI', 'Ayşe Kaya', NULL, NULL),
(9, '09:15', NULL, 'OTURUM', 'GIRIS_BASARISIZ', 'UYARI', 'Hatalı şifreyle giriş denemesi', NULL, 'KULLANICI', 'Burak Polat', 'Denenen e-posta: burak.polat@devhub.local', '10.20.0.10'),
(9, '09:16', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'burak.polat', 'KULLANICI', 'Burak Polat', NULL, NULL),
(9, '10:30', NULL, 'SISTEM', 'OLUSTURMA', 'BILGI', 'Resmi tatil eklendi: Cumhuriyet Bayramı', 'admin', 'TATIL', 'Cumhuriyet Bayramı', 'Tarih: 29.10
Bu gün izin hesaplarında iş günü sayılmaz', NULL),
(8, '14:15', NULL, 'GOREV', 'OLUSTURMA', 'BILGI', 'Can Doğan için yeni görev: Ödeme sağlayıcısı API dokümanını incele', 'admin', 'GOREV', 'Ödeme sağlayıcısı API dokümanını incele', 'Atanan: Can Doğan
Öncelik: Orta
Proje: Ödeme Altyapısı', NULL),
(7, '10:00', NULL, 'KULLANICI', 'OLUSTURMA', 'BILGI', 'Yeni kullanıcı oluşturuldu: Derya Şen', 'admin', 'KULLANICI', 'Derya Şen', 'E-posta: derya.sen@devhub.local
Rol: Çalışan
Unvan: Scrum Master
Yıllık izin hakkı: 14 gün
Geçici şifre verildi; ilk girişte değiştirilmesi zorunlu', NULL),
(7, '10:05', NULL, 'PROJE', 'OLUSTURMA', 'BILGI', 'Yeni proje oluşturuldu: Müşteri Portalı', 'admin', 'PROJE', 'Müşteri Portalı', 'Aşama: Planlama
Açıklama: Kurumsal müşteriler için self-servis fatura, sözleşme ve destek portalı.', NULL),
(7, '10:12', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Derya Şen, Müşteri Portalı projesine atandı', 'admin', 'KULLANICI', 'Derya Şen', 'Proje: — → Müşteri Portalı', NULL),
(6, '09:10', NULL, 'KULLANICI', 'GUNCELLEME', 'BILGI', 'Kullanıcı bilgileri güncellendi: Volkan Aydın', 'admin', 'KULLANICI', 'Volkan Aydın', 'Yıllık izin hakkı (gün): 14 → 20
İşe giriş: — → 2019-03-11', NULL),
(6, '11:00', NULL, 'GOREV', 'GOREV_AKTARMA', 'BILGI', 'Görev başka birine aktarıldı: iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'admin', 'GOREV', 'iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'Atanan: Ahmet Şahin → Zeynep Öztürk
Görevin sahibi: Zeynep Öztürk', NULL),
(5, '16:30', NULL, 'GOREV', 'OLUSTURMA', 'BILGI', 'Mustafa Koç için yeni görev: Eski raporlama tablolarının veri eşlemesini çıkar', 'admin', 'GOREV', 'Eski raporlama tablolarının veri eşlemesini çıkar', 'Atanan: Mustafa Koç
Öncelik: Yüksek
Proje: Veri Ambarı Göçü
Açıklama eklendi', NULL),
(5, '17:45', NULL, 'KULLANICI', 'PASIFLESTIRME', 'KRITIK', 'Hesap pasifleştirildi: Onur Tekin', 'admin', 'KULLANICI', 'Onur Tekin', 'Kişi giriş yapamaz; açık oturumları da geçersiz sayılır', NULL),
(4, '09:20', NULL, 'OTURUM', 'GIRIS_BASARISIZ', 'UYARI', 'Pasifleştirilmiş hesapla giriş denemesi', NULL, 'KULLANICI', 'Onur Tekin', 'Denenen e-posta: onur.tekin@devhub.local', '10.20.0.19'),
(4, '09:22', NULL, 'OTURUM', 'GIRIS_BASARISIZ', 'UYARI', 'Pasifleştirilmiş hesapla giriş denemesi', NULL, 'KULLANICI', 'Onur Tekin', 'Denenen e-posta: onur.tekin@devhub.local', '10.20.0.19'),
(4, '14:10', NULL, 'KULLANICI', 'SIFRE_SIFIRLAMA', 'KRITIK', 'Geçici şifre oluşturuldu: Emre Kurt', 'admin', 'KULLANICI', 'Emre Kurt', 'Eski şifre geçersiz; kişi bir sonraki girişte şifresini değiştirmek zorunda
Şifrenin kendisi loglanmaz', NULL),
(4, '14:31', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'emre.kurt', 'KULLANICI', 'Emre Kurt', 'Geçici şifreyle giriş: şifre değişikliği bekleniyor', NULL),
(4, '14:32', NULL, 'OTURUM', 'SIFRE_DEGISTIRME', 'BILGI', 'Şifresini değiştirdi', 'emre.kurt', 'KULLANICI', 'Emre Kurt', 'Geçici şifre ilk girişte değiştirildi', NULL),
(3, '11:20', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Burak Polat, Devhub Core projesine atandı', 'admin', 'KULLANICI', 'Burak Polat', 'Proje: Mobil Uygulama → Devhub Core', NULL),
(3, '11:45', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Volkan Aydın, Enerji Optimizasyonu projesine atandı', 'admin', 'KULLANICI', 'Volkan Aydın', 'Proje: — → Enerji Optimizasyonu', NULL),
(3, '15:30', NULL, 'PROJE', 'GUNCELLEME', 'BILGI', 'Proje güncellendi: Ödeme Altyapısı', 'admin', 'PROJE', 'Ödeme Altyapısı', 'Aşama: Aktif → Beklemede
Açıklama güncellendi', NULL),
(2, '15:10', NULL, 'PROJE', 'PROJEDEN_CIKARMA', 'BILGI', 'Buse Özdemir, Mobil Uygulama projesinden çıkarıldı', 'admin', 'KULLANICI', 'Buse Özdemir', 'Proje: Mobil Uygulama → —
Kişi şu an bir projeye bağlı değil', NULL),
(2, '16:00', NULL, 'GOREV', 'SILME', 'UYARI', 'Görev silindi: Eski sprint notlarını arşivle', 'ali.yilmaz', 'GOREV', 'Eski sprint notlarını arşivle', 'Atanan: Ali Yılmaz
Durum: Yapılacak
Proje: Devhub Core
Oluşturan: Ali Yılmaz', NULL),
(1, '08:55', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'ali.yilmaz', 'KULLANICI', 'Ali Yılmaz', NULL, NULL),
(1, '09:05', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'fatma.celik', 'KULLANICI', 'Fatma Çelik', NULL, NULL),
(1, '09:10', NULL, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'zeynep.ozturk', 'KULLANICI', 'Zeynep Öztürk', NULL, NULL),
(1, '10:30', NULL, 'GOREV', 'OLUSTURMA', 'BILGI', 'Ali Yılmaz için yeni görev: Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'ali.yilmaz', 'GOREV', 'Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'Atanan: Ali Yılmaz
Öncelik: Yüksek', NULL),
(1, '11:40', NULL, 'GOREV', 'DURUM_DEGISIKLIGI', 'BILGI', 'Görev durumu değişti: Yavaş çalışan tüketim sorgusunu optimize et', 'fatma.celik', 'GOREV', 'Yavaş çalışan tüketim sorgusunu optimize et', 'Durum: Yapılacak → Devam Ediyor', NULL),
(1, '12:15', NULL, 'GOREV', 'GUNCELLEME', 'BILGI', 'Görev güncellendi: Yavaş çalışan tüketim sorgusunu optimize et', 'admin', 'GOREV', 'Yavaş çalışan tüketim sorgusunu optimize et', 'Öncelik: Orta → Yüksek
Görevin sahibi: Fatma Çelik', NULL),
(1, '14:40', NULL, 'GOREV', 'OLUSTURMA', 'BILGI', 'Seda Yıldız için yeni görev: Filtre çubuğunu mobil uyumlu hâle getir', 'admin', 'GOREV', 'Filtre çubuğunu mobil uyumlu hâle getir', 'Atanan: Seda Yıldız
Öncelik: Orta
Proje: Raporlama Paneli', NULL),
(1, '15:25', NULL, 'GOREV', 'YORUM', 'BILGI', 'Göreve yorum yazıldı: iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'zeynep.ozturk', 'GOREV', 'iOS 19 çökme hatasını yeniden üret ve kayıt altına al (Ahmet''ten devir)', 'Yorum: Hata yalnızca iOS 19.1''de ve çevrimdışıyken çıkıyor; ekran kaydını ortak klasöre ekledim.', NULL),
(1, '17:05', NULL, 'GOREV', 'OLUSTURMA', 'BILGI', 'Zeynep Öztürk için yeni görev: Regresyon test listesini güncelle', 'zeynep.ozturk', 'GOREV', 'Regresyon test listesini güncelle', 'Atanan: Zeynep Öztürk
Öncelik: Düşük', NULL),
(1, '18:02', NULL, 'OTURUM', 'CIKIS', 'BILGI', 'Oturumu kapattı', 'ali.yilmaz', 'KULLANICI', 'Ali Yılmaz', NULL, NULL),
(0, NULL, 6, 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı', 'admin', 'KULLANICI', 'Admin', NULL, NULL),
(0, NULL, 4, 'GOREV', 'YORUM', 'BILGI', 'Göreve yorum yazıldı: Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'admin', 'GOREV', 'Sprint 15 planlamasını hazırla ve backlog önceliklerini netleştir', 'Yorum: Sunumda Q4 hedefleriyle bağlantıyı da gösterelim.', NULL),
(0, NULL, 3, 'GOREV', 'OLUSTURMA', 'BILGI', 'Admin için yeni görev: Q4 yol haritası sunumunu hazırla', 'admin', 'GOREV', 'Q4 yol haritası sunumunu hazırla', 'Atanan: Admin
Öncelik: Yüksek
Açıklama eklendi', NULL),
(0, NULL, 2, 'KULLANICI', 'DURUM_DEGISIKLIGI', 'BILGI', 'Ayşe Kaya durumu: Aktif → Toplantıda', 'ayse.kaya', 'KULLANICI', 'Ayşe Kaya', 'Durum: Aktif → Toplantıda
Kişi kendi durumunu değiştirdi', NULL),
(0, NULL, 1, 'GOREV', 'OLUSTURMA', 'BILGI', 'Buse Özdemir için yeni görev: Test otomasyon araçlarını karşılaştır ve öneri hazırla', 'admin', 'GOREV', 'Test otomasyon araçlarını karşılaştır ve öneri hazırla', 'Atanan: Buse Özdemir
Öncelik: Orta', NULL),
(0, NULL, 1, 'OTURUM', 'GIRIS_BASARISIZ', 'UYARI', 'Kayıtlı olmayan e-postayla giriş denemesi', NULL, 'KULLANICI', 'test@devhub.local', 'Denenen e-posta: test@devhub.local', '185.34.12.7');

-- Görev ve oturum logları aşağıda gerçek kayıtlardan üretilir; elle yazılanlardan yalnızca özel olanlar kalır
-- (silinen görev, geçici şifreyle ilk giriş vb.).
DELETE FROM g WHERE category = 'GOREV' AND action <> 'SILME';
DELETE FROM g WHERE action IN ('GIRIS', 'CIKIS') AND details IS NULL;
INSERT INTO g VALUES (9, '10:05', NULL, 'PROJE', 'PROJE_ATAMA', 'BILGI', 'Kerem Aslan, Veri Ambarı Göçü projesine atandı', 'admin', 'KULLANICI', 'Kerem Aslan', 'Proje: — → Veri Ambarı Göçü', NULL);

-- Hafta sonuna düşen log mesai günü olsun: Cumartesi/Pazar → önceki Cuma (saat aynı kalır)
UPDATE g SET days_ago = days_ago + CASE DAYOFWEEK(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL days_ago DAY) WHEN 1 THEN 2 WHEN 7 THEN 1 ELSE 0 END
WHERE hours_ago IS NULL;

-- Bugün süren her onaylı iznin başladığı gece zamanlayıcı kişiyi İzinli yapar (Sistem).
INSERT INTO g (days_ago, clock, hours_ago, category, action, level, message, actor, target_type, target_name, details, ip)
SELECT DATEDIFF(CURDATE(), lr.start_date), '00:05', NULL, 'KULLANICI', 'DURUM_DEGISIKLIGI', 'BILGI',
       CONCAT(us.full_name, ' durumu: Aktif → İzinli'), NULL, 'KULLANICI', us.full_name,
       'Durum: Aktif → İzinli\nİzin takvimine göre sistem tarafından otomatik güncellendi', NULL
FROM leave_requests lr JOIN users us ON us.id = lr.user_id
WHERE lr.state = 'ONAYLANDI' AND CURDATE() BETWEEN lr.start_date AND lr.end_date;

-- created_at UTC saklanır; hedef id'leri ada göre bulunur; IP: kişiye özel iç ağ adresi (başarısız girişte kayıtlı adres).
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT x.category, x.action, x.level, x.message, x.at_utc, x.actor_id, x.target_type,
       CASE x.target_type
         WHEN 'KULLANICI' THEN (SELECT id FROM users WHERE full_name = x.target_name LIMIT 1)
         WHEN 'PROJE' THEN (SELECT id FROM projects WHERE name = x.target_name LIMIT 1)
         WHEN 'GOREV' THEN (SELECT id FROM tasks WHERE content = x.target_name LIMIT 1)
         WHEN 'TATIL' THEN (SELECT id FROM holidays WHERE name = x.target_name ORDER BY date LIMIT 1)
       END,
       x.target_name, x.details,
       COALESCE(x.ip, IF(x.actor_id IS NULL, NULL, CONCAT('10.20.0.', x.actor_id)))
FROM (
  SELECT g.*, (SELECT id FROM users WHERE email = CONCAT(g.actor, '@devhub.local')) AS actor_id,
         IF(hours_ago IS NOT NULL,
            NOW() - INTERVAL hours_ago HOUR,
            CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL days_ago DAY, clock), '+03:00', '+00:00')) AS at_utc
  FROM g
) x
ORDER BY x.at_utc;

-- Görevlerin oluşturulması (görevi atayan kişi tarafından)
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'GOREV', 'OLUSTURMA', 'BILGI', CONCAT(ow.full_name, ' için yeni görev: ', tk.content), tk.created_at, COALESCE(tk.created_by_id, tk.user_id),
       'GOREV', tk.id, LEFT(tk.content, 200),
       CONCAT('Atanan: ', ow.full_name,
              '\nÖncelik: ', CASE tk.priority WHEN 'YUKSEK' THEN 'Yüksek' WHEN 'DUSUK' THEN 'Düşük' ELSE 'Orta' END,
              IF(tk.due_date IS NULL, '', CONCAT('\nSon tarih: ', DATE_FORMAT(tk.due_date, '%d.%m.%Y'))),
              IF(pr.name IS NULL, '', CONCAT('\nProje: ', pr.name)),
              IF(tk.description IS NULL, '', '\nAçıklama eklendi')),
       CONCAT('10.20.0.', COALESCE(tk.created_by_id, tk.user_id))
FROM tasks tk JOIN users ow ON ow.id = tk.user_id LEFT JOIN projects pr ON pr.id = tk.project_id;

-- Görev geçmişindeki olaylar (durum, tamamlama, aktarma, öncelik/son tarih) ve yorumlar
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'GOREV',
       CASE WHEN a.kind = 'COMMENT' THEN 'YORUM'
            WHEN a.message LIKE '%→ Tamamlandı' THEN 'TAMAMLAMA'
            WHEN a.message LIKE 'durumu değiştirdi:%' THEN 'DURUM_DEGISIKLIGI'
            WHEN a.message LIKE 'görevi aktardı:%' THEN 'GOREV_AKTARMA'
            ELSE 'GUNCELLEME' END,
       'BILGI',
       CONCAT(CASE WHEN a.kind = 'COMMENT' THEN 'Göreve yorum yazıldı: '
                   WHEN a.message LIKE '%→ Tamamlandı' THEN 'Görev tamamlandı: '
                   WHEN a.message LIKE 'durumu değiştirdi:%' THEN 'Görev durumu değişti: '
                   WHEN a.message LIKE 'görevi aktardı:%' THEN 'Görev başka birine aktarıldı: '
                   ELSE 'Görev güncellendi: ' END, tk.content),
       a.created_at, a.actor_id, 'GOREV', tk.id, LEFT(tk.content, 200),
       CASE WHEN a.kind = 'COMMENT' THEN CONCAT('Yorum: ', LEFT(a.message, 300))
            WHEN a.message LIKE 'durumu değiştirdi:%' THEN CONCAT('Durum: ', SUBSTRING(a.message, LENGTH('durumu değiştirdi: ') + 1))
            WHEN a.message LIKE 'görevi aktardı:%' THEN CONCAT('Atanan: ', SUBSTRING(a.message, LENGTH('görevi aktardı: ') + 1))
            WHEN a.message LIKE 'önceliği değiştirdi:%' THEN CONCAT('Öncelik: ', SUBSTRING(a.message, LENGTH('önceliği değiştirdi: ') + 1))
            ELSE CONCAT(UPPER(LEFT(a.message, 1)), SUBSTRING(a.message, 2)) END,
       IF(a.actor_id IS NULL, NULL, CONCAT('10.20.0.', a.actor_id))
FROM task_activity a JOIN tasks tk ON tk.id = a.task_id
WHERE a.kind = 'COMMENT' OR a.message NOT LIKE 'görevi oluşturdu%';

-- Oturumlar: son iki haftanın iş günlerinde aktif çalışanların sabah girişleri (izinli günler hariç), bazılarının akşam çıkışları
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, ip_address)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 13)
SELECT 'OTURUM', 'GIRIS', 'BILGI', 'Sisteme giriş yaptı',
       CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY, '08:20') + INTERVAL ((us.id * 37 + d.n * 11) % 70) MINUTE, '+03:00', '+00:00'),
       us.id, 'KULLANICI', us.id, us.full_name, CONCAT('10.20.0.', us.id)
FROM d CROSS JOIN users us
WHERE us.active = b'1' AND us.email LIKE '%@devhub.local'
  AND (us.id * 7 + d.n * 3) % 10 < 8
  AND DAYOFWEEK(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY) NOT IN (1, 7)
  AND (us.hire_date IS NULL OR us.hire_date <= DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY)
  AND NOT EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.user_id = us.id AND lr.state = 'ONAYLANDI'
                  AND DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY BETWEEN lr.start_date AND lr.end_date)
  AND CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY, '08:20') + INTERVAL ((us.id * 37 + d.n * 11) % 70) MINUTE, '+03:00', '+00:00') < NOW();

INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, ip_address)
WITH RECURSIVE d(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM d WHERE n < 13)
SELECT 'OTURUM', 'CIKIS', 'BILGI', 'Oturumu kapattı',
       CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY, '17:35') + INTERVAL ((us.id * 13 + d.n * 7) % 55) MINUTE, '+03:00', '+00:00'),
       us.id, 'KULLANICI', us.id, us.full_name, CONCAT('10.20.0.', us.id)
FROM d CROSS JOIN users us
WHERE us.active = b'1' AND us.email LIKE '%@devhub.local'
  AND (us.id * 7 + d.n * 3) % 10 < 8 AND (us.id + d.n) % 3 = 0
  AND DAYOFWEEK(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY) NOT IN (1, 7)
  AND (us.hire_date IS NULL OR us.hire_date <= DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY)
  AND NOT EXISTS (SELECT 1 FROM leave_requests lr WHERE lr.user_id = us.id AND lr.state = 'ONAYLANDI'
                  AND DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL d.n DAY BETWEEN lr.start_date AND lr.end_date);

-- Duyurular: yayın anında loglanır
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'DUYURU', 'YAYIN', 'BILGI', CONCAT('Duyuru yayınlandı: ', a.title), a.created_at, a.author_id, 'DUYURU', a.id, a.title,
       CONCAT(IF(a.pinned, 'Sabitlenmiş duyuru\n', ''), 'İçerik: ', LEFT(a.content, 200), '\nTüm aktif çalışanlara bildirim gönderildi'),
       CONCAT('10.20.0.', a.author_id)
FROM announcements a;

-- ---------------------------------------------------------------------
-- Bildirimler (uygulamanın ürettiği olaylarla aynı metinler)
-- ---------------------------------------------------------------------
-- Yöneticiye: bekleyen izin talepleri (okunmamış)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, created_at)
SELECT @admin, lr.user_id, 'LEAVE_REQUESTED', CONCAT(us.full_name, ' izin talebinde bulundu'),
       CONCAT(CASE lr.type WHEN 'YILLIK' THEN 'Yıllık izin' WHEN 'HASTALIK' THEN 'Hastalık izni' ELSE 'Mazeret izni' END,
              ' · ', DATE_FORMAT(lr.start_date, '%d.%m'), IF(lr.end_date > lr.start_date, CONCAT(' – ', DATE_FORMAT(lr.end_date, '%d.%m')), '')),
       '/leaves', lr.created_at
FROM leave_requests lr JOIN users us ON us.id = lr.user_id WHERE lr.state = 'BEKLIYOR';

-- Çalışana: son 10 günde sonuçlanan izin talepleri (okunmuş)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, read_at, created_at)
SELECT lr.user_id, @admin, 'LEAVE_DECIDED',
       IF(lr.state = 'ONAYLANDI', 'İzin talebiniz onaylandı', 'İzin talebiniz reddedildi'),
       CONCAT(CASE lr.type WHEN 'YILLIK' THEN 'Yıllık izin' WHEN 'HASTALIK' THEN 'Hastalık izni' ELSE 'Mazeret izni' END,
              ' · ', DATE_FORMAT(lr.start_date, '%d.%m'), IF(lr.end_date > lr.start_date, CONCAT(' – ', DATE_FORMAT(lr.end_date, '%d.%m')), '')),
       '/leaves', lr.decided_at + INTERVAL 1 HOUR, lr.decided_at
FROM leave_requests lr
WHERE lr.state IN ('ONAYLANDI', 'REDDEDILDI') AND lr.decided_at > NOW() - INTERVAL 10 DAY AND lr.user_id <> @admin;

-- Çalışana: yöneticinin son 3 günde atadığı açık görevler (son 24 saattekiler okunmamış)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, read_at, created_at)
SELECT tk.user_id, @admin, 'TASK_ASSIGNED', IF(tk.content LIKE '%(Ahmet''ten devir)%', 'Size bir görev aktarıldı', 'Size yeni görev atandı'),
       tk.content, CONCAT('/tasks?task=', tk.id),
       IF(tk.created_at < NOW() - INTERVAL 24 HOUR, tk.created_at + INTERVAL 2 HOUR, NULL), tk.created_at
FROM tasks tk JOIN users us ON us.id = tk.user_id
WHERE tk.status <> 'TAMAMLANDI' AND tk.created_by_id = @admin AND tk.user_id <> @admin
  AND (tk.created_at > NOW() - INTERVAL 3 DAY OR tk.content LIKE '%(Ahmet''ten devir)%') AND us.email NOT IN ('admin@devhub.local', 'ali.yilmaz@devhub.local', 'zeynep.ozturk@devhub.local');

-- Proje atamaları (loglarla aynı olaylar)
INSERT INTO notifications (user_id, actor_id, type, title, link, read_at, created_at)
SELECT us.id, @admin, 'PROJECT_ASSIGNED', x.title, '/projects', IF(x.days_ago > 2, NOW() - INTERVAL x.days_ago DAY + INTERVAL 1 HOUR, NULL), NOW() - INTERVAL x.days_ago DAY
FROM (
  SELECT 'burak.polat' AS k, '"Devhub Core" projesine atandınız' AS title, 3 AS days_ago
  UNION ALL SELECT 'volkan.aydin', '"Enerji Optimizasyonu" projesine atandınız', 3
  UNION ALL SELECT 'derya.sen', '"Müşteri Portalı" projesine atandınız', 7
  UNION ALL SELECT 'buse.ozdemir', '"Mobil Uygulama" projesinden çıkarıldınız', 2
) x JOIN users us ON us.email = CONCAT(x.k, '@devhub.local');

-- Herkese: son iki duyuru (en yenisi okunmamış)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, read_at, created_at)
SELECT us.id, a.author_id, 'ANNOUNCEMENT', CONCAT('Yeni duyuru: ', a.title), a.content, '/',
       IF(a.created_at < NOW() - INTERVAL 24 HOUR, a.created_at + INTERVAL 3 HOUR, NULL), a.created_at
FROM announcements a JOIN users us ON us.active = b'1' AND us.id <> a.author_id
WHERE a.created_at > NOW() - INTERVAL 30 HOUR;

-- Son günü bugün/yarın olan açık görevler için hatırlatma (uygulamanın zamanlayıcısıyla aynı anahtar; tekrar üretilmez)
INSERT INTO notifications (user_id, type, title, body, link, ref_key, created_at)
SELECT tk.user_id, 'TASK_DUE', IF(tk.due_date = CURDATE(), 'Görevinizin son günü bugün', 'Görevinizin son günü yarın'),
       tk.content, CONCAT('/tasks?task=', tk.id), CONCAT('task-due:', tk.id, ':', tk.due_date), NOW() - INTERVAL 2 HOUR
FROM tasks tk WHERE tk.status <> 'TAMAMLANDI' AND tk.due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 1 DAY;

-- Atayana: son 3 günde tamamlanan görevler (son 24 saattekiler okunmamış)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, read_at, created_at)
SELECT tk.created_by_id, tk.user_id, 'TASK_COMPLETED', CONCAT(us.full_name, ' görevi tamamladı'), tk.content, CONCAT('/tasks?task=', tk.id),
       IF(tk.completed_at < NOW() - INTERVAL 24 HOUR, tk.completed_at + INTERVAL 1 HOUR, NULL), tk.completed_at
FROM tasks tk JOIN users us ON us.id = tk.user_id
WHERE tk.status = 'TAMAMLANDI' AND tk.completed_at > NOW() - INTERVAL 3 DAY AND tk.created_by_id <> tk.user_id;

-- Yorumlar: görevin sahibi ve atayan kişi bildirim alır (yorumu yazan hariç)
INSERT INTO notifications (user_id, actor_id, type, title, body, link, read_at, created_at)
SELECT r.user_id, a.actor_id, 'TASK_COMMENT', CONCAT(au.full_name, ' bir göreve yorum yazdı'), CONCAT(tk.content, ' — ', a.message),
       CONCAT('/tasks?task=', tk.id), IF(a.created_at < NOW() - INTERVAL 24 HOUR, a.created_at + INTERVAL 2 HOUR, NULL), a.created_at
FROM task_activity a
JOIN tasks tk ON tk.id = a.task_id
JOIN users au ON au.id = a.actor_id
JOIN (SELECT id AS task_id, user_id FROM tasks UNION SELECT id, created_by_id FROM tasks WHERE created_by_id IS NOT NULL) r ON r.task_id = tk.id
WHERE a.kind = 'COMMENT' AND r.user_id <> a.actor_id;

-- ---------------------------------------------------------------------
-- Kişisel alan: yapılacaklar (her kayıt yalnızca sahibine görünür)
-- k: sahibi, list: liste adı (NULL = Genel), due: bugünden gün farkı, pos: sıra (küçük üstte),
-- sender: kart başka birinden geldiyse gönderen; seen = 0 ise alıcı henüz açmamıştır.
-- ---------------------------------------------------------------------
INSERT INTO todo_lists (user_id, name, color, position)
SELECT us.id, x.name, x.color, x.pos
FROM (
  SELECT 'admin' AS k, 'Yönetim' AS name, '#9CAB84' AS color, 0 AS pos
  UNION ALL SELECT 'admin', 'Kişisel', '#D9A88A', 1
  UNION ALL SELECT 'ali.yilmaz', 'Sprint 15', '#C5D89D', 0
  UNION ALL SELECT 'derya.sen', 'Portal Kickoff', '#D9A88A', 0
  UNION ALL SELECT 'fatma.celik', 'Raporlama', '#9CAB84', 0
  UNION ALL SELECT 'zeynep.ozturk', 'Test planı', '#B7C4A0', 0
) x JOIN users us ON us.email = CONCAT(x.k, '@devhub.local');

-- Her listenin oluşturanı o listenin yöneticisidir. "Sprint 15" ortak bir listedir: Ali yönetir,
-- Ayşe de yönetici yapılmıştır, Burak ve Seda üyedir (üyeler listedeki tüm kartları görür).
INSERT INTO todo_list_members (list_id, user_id, role, joined_at)
SELECT id, user_id, 'ADMIN', NOW() - INTERVAL 6 DAY FROM todo_lists;
INSERT INTO todo_list_members (list_id, user_id, role, joined_at)
SELECT tl.id, us.id, x.role, NOW() - INTERVAL x.ago DAY
FROM (
  SELECT 'ayse.kaya' AS k, 'ADMIN' AS role, 5 AS ago
  UNION ALL SELECT 'burak.polat', 'MEMBER', 4
  UNION ALL SELECT 'seda.yildiz', 'MEMBER', 2
) x JOIN users us ON us.email = CONCAT(x.k, '@devhub.local')
JOIN todo_lists tl ON tl.name = 'Sprint 15';
-- "Portal Kickoff": Derya'nın ortak listesi (Burak ve Elif üye)
INSERT INTO todo_list_members (list_id, user_id, role, joined_at)
SELECT tl.id, us.id, 'MEMBER', NOW() - INTERVAL 3 DAY
FROM users us JOIN todo_lists tl ON tl.name = 'Portal Kickoff'
WHERE us.email IN ('burak.polat@devhub.local', 'elif.arslan@devhub.local');

DROP TEMPORARY TABLE IF EXISTS td;
CREATE TEMPORARY TABLE td (k VARCHAR(20), list VARCHAR(80) NULL, title VARCHAR(300), note VARCHAR(4000) NULL, done BOOLEAN, important BOOLEAN,
                           myday BOOLEAN, due INT NULL, pos INT, sender VARCHAR(20) NULL, msg VARCHAR(500) NULL, seen BOOLEAN);
INSERT INTO td VALUES
('derya.sen',   'Portal Kickoff', 'Kickoff sunumunu hazırla', 'Kapsam, takvim ve ekip rolleri.', FALSE, TRUE, FALSE, 1, 0, NULL, NULL, TRUE),
('derya.sen',   'Portal Kickoff', 'Müşteri tarafı katılımcı listesini netleştir', NULL, TRUE, FALSE, FALSE, NULL, 1, NULL, NULL, TRUE),
('burak.polat', 'Portal Kickoff', 'Ürün vizyonunu iki slayta indir', NULL, FALSE, FALSE, FALSE, 1, 2, NULL, NULL, TRUE),
('elif.arslan', 'Portal Kickoff', 'Portal için ilk ekran taslaklarını ekle', NULL, FALSE, FALSE, FALSE, 2, 3, NULL, NULL, TRUE),
('derya.sen',   NULL, 'Retrospektif notlarını ekiple paylaş', NULL, FALSE, FALSE, FALSE, 0, 0, NULL, NULL, TRUE),
('derya.sen',   NULL, 'Scrum eğitimi için kaynak listesi', NULL, FALSE, FALSE, FALSE, NULL, 1, NULL, NULL, TRUE),
('fatma.celik', 'Raporlama', 'WebSocket bağlantı kopmalarını logla', NULL, FALSE, TRUE, FALSE, 0, 0, NULL, NULL, TRUE),
('fatma.celik', 'Raporlama', 'Sorgu planlarını karşılaştır', 'EXPLAIN çıktılarını wiki sayfasına ekle.', FALSE, FALSE, FALSE, 1, 1, NULL, NULL, TRUE),
('fatma.celik', NULL, 'Yan haklar formunu doldur', NULL, FALSE, FALSE, FALSE, 3, 0, NULL, NULL, TRUE),
('zeynep.ozturk', 'Test planı', 'iOS 19.1 cihazını test laboratuvarından al', NULL, TRUE, FALSE, FALSE, NULL, 0, NULL, NULL, TRUE),
('zeynep.ozturk', 'Test planı', 'Çevrimdışı senaryolar için test verisi hazırla', NULL, FALSE, TRUE, FALSE, 1, 1, NULL, NULL, TRUE),
('zeynep.ozturk', NULL, 'Hata raporu şablonunu güncelle', NULL, FALSE, FALSE, FALSE, 2, 0, 'ali.yilmaz', 'Yeni alanları ekleyebilir misin?', TRUE),
('elif.arslan', NULL, 'Tasarım sistemi renk tokenlarını gözden geçir', NULL, FALSE, FALSE, FALSE, 2, 0, NULL, NULL, TRUE),
('burak.polat', NULL, 'Q4 hedeflerini yönetimle teyit et', NULL, FALSE, TRUE, FALSE, 1, 0, NULL, NULL, TRUE),
('merve.can',   NULL, 'Veri sözlüğüne yeni tabloları ekle', NULL, FALSE, FALSE, FALSE, 1, 0, NULL, NULL, TRUE),
('merve.can',   NULL, 'SQL eğitimi videolarını izle', NULL, FALSE, FALSE, FALSE, NULL, 1, NULL, NULL, TRUE),
('emre.kurt',   NULL, 'Klavye kısayolları dokümanını yaz', NULL, FALSE, FALSE, FALSE, 2, 0, NULL, NULL, TRUE),
('volkan.aydin', NULL, 'Anomali sonuçlarını grafikle', NULL, FALSE, TRUE, FALSE, 1, 0, NULL, NULL, TRUE),
('kerem.aslan', NULL, 'VPN erişim talebini takip et', NULL, FALSE, FALSE, FALSE, 0, 0, NULL, NULL, TRUE),
('kerem.aslan', NULL, 'Oryantasyon dokümanını oku', NULL, TRUE, FALSE, FALSE, NULL, 1, NULL, NULL, TRUE),
('buse.ozdemir', NULL, 'Otomasyon araçları için deneme hesapları aç', NULL, FALSE, FALSE, FALSE, 1, 0, NULL, NULL, TRUE),
('can.dogan',   NULL, 'İzin öncesi devir notlarını hazırla', NULL, FALSE, TRUE, FALSE, 2, 0, NULL, NULL, TRUE),
('admin', NULL,      'Haftalık durum raporunu gönder',          NULL, FALSE, FALSE, TRUE,  0,    0, NULL, NULL, TRUE),
('admin', NULL,      'Yeni stajyer için hesap aç',              'Kullanıcılar sayfasından eklenecek; geçici şifre ilk gün elden verilecek.', FALSE, FALSE, FALSE, 2, 1, NULL, NULL, TRUE),
('admin', NULL,      'Müşteri ziyareti gündemini onayla',       'Gündem taslağı ortak klasörde. Katılımcı listesi de eklenecek.', FALSE, FALSE, FALSE, 3, 2, 'burak.polat', 'Perşembeye kadar dönüş yapabilir misin?', FALSE),
('admin', NULL,      'Ofis malzemesi siparişini onayla',        NULL, TRUE,  FALSE, FALSE, NULL, 3, NULL, NULL, TRUE),
('admin', 'Yönetim', 'Sprint demosu için sunumu hazırla',       'Cuma 14:00 demo. Proje ilerlemesi ve Sistem İzleme gösterilecek.', FALSE, TRUE, TRUE, 1, 0, NULL, NULL, TRUE),
('admin', 'Yönetim', 'Q4 bütçe taslağını hazırla',              NULL, FALSE, TRUE,  FALSE, 5,    1, NULL, NULL, TRUE),
('admin', 'Yönetim', 'Performans görüşmelerini planla',         'Her görüşme 45 dakika; takvim daveti gönderilecek.', FALSE, FALSE, FALSE, 8, 2, NULL, NULL, TRUE),
('admin', 'Yönetim', 'İzin takvimini ekip liderleriyle paylaş', NULL, TRUE,  FALSE, FALSE, NULL, 3, NULL, NULL, TRUE),
('admin', 'Kişisel', 'Diş randevusunu ayarla',                  NULL, FALSE, FALSE, FALSE, NULL, 0, NULL, NULL, TRUE),
('admin', 'Kişisel', 'Clean Architecture: 5. bölümü oku',       NULL, FALSE, FALSE, FALSE, NULL, 1, NULL, NULL, TRUE),
('ali.yilmaz', 'Sprint 15', 'Backlog maddelerini puanla',       NULL, FALSE, TRUE,  TRUE,  1,    0, NULL, NULL, TRUE),
('ali.yilmaz', 'Sprint 15', 'Bekleyen PR incelemelerine bak',   NULL, FALSE, FALSE, TRUE,  0,    1, NULL, NULL, TRUE),
('ayse.kaya',  'Sprint 15', 'Auth servisinin yük testini çalıştır', 'Sonuçları sprint demosundan önce kanala yazalım.', FALSE, FALSE, FALSE, 2, 2, NULL, NULL, TRUE),
('burak.polat', 'Sprint 15', 'Release notlarını derle',        NULL, FALSE, FALSE, FALSE, 3, 3, NULL, NULL, TRUE),
('seda.yildiz', 'Sprint 15', 'Giriş ekranı erişilebilirlik kontrolü', NULL, TRUE, FALSE, FALSE, NULL, 4, NULL, NULL, TRUE),
('ali.yilmaz', NULL,        'Demo ortamını kontrol et',         'Demo öncesi staging verisi yenilenmeli.', FALSE, FALSE, FALSE, 1, 0, 'admin', 'Demo öncesi bir göz atar mısın?', FALSE),
('ali.yilmaz', NULL,        'Oryantasyon dokümanına Git akışını ekle', NULL, FALSE, FALSE, FALSE, 6, 1, NULL, NULL, TRUE),
('ayse.kaya',  NULL,        'Refresh token testlerini yaz',     NULL, FALSE, TRUE,  TRUE,  0,    0, NULL, NULL, TRUE),
('ayse.kaya',  NULL,        'Rate limit dokümanını güncelle',   NULL, FALSE, FALSE, FALSE, 4,    1, NULL, NULL, TRUE);

INSERT INTO todo_items (user_id, list_id, title, note, done, done_at, important, my_day, due_date, position, sent_by_id, sent_message, seen, created_at, updated_at)
SELECT us.id, tl.id, td.title, td.note, td.done, IF(td.done, NOW() - INTERVAL 20 HOUR, NULL), td.important,
       NULL, IF(td.due IS NULL, IF(td.myday AND NOT td.done, CURDATE(), NULL), CURDATE() + INTERVAL td.due DAY), td.pos,
       sn.id, td.msg, td.seen, NOW() - INTERVAL (3 + td.pos * 5) HOUR, NOW() - INTERVAL 2 HOUR
FROM td
JOIN users us ON us.email = CONCAT(td.k, '@devhub.local')
LEFT JOIN todo_lists tl ON tl.name = td.list AND tl.id IN (SELECT list_id FROM todo_list_members WHERE user_id = us.id)
LEFT JOIN users sn ON sn.email = CONCAT(td.sender, '@devhub.local');

-- Tarihler hafta sonuna denk gelmesin (görevlerdeki kuralın aynısı)
UPDATE todo_items SET due_date = due_date + INTERVAL 2 DAY WHERE DAYOFWEEK(due_date) = 7;
UPDATE todo_items SET due_date = due_date + INTERVAL 1 DAY WHERE DAYOFWEEK(due_date) = 1;

INSERT INTO todo_steps (item_id, title, done, position)
SELECT ti.id, x.step, x.done, x.pos
FROM (
  SELECT 'Sprint demosu için sunumu hazırla' AS title, 'Slaytları güncelle' AS step, TRUE AS done, 0 AS pos
  UNION ALL SELECT 'Sprint demosu için sunumu hazırla', 'Demo verisini yenile', FALSE, 1
  UNION ALL SELECT 'Sprint demosu için sunumu hazırla', 'Prova yap', FALSE, 2
  UNION ALL SELECT 'Q4 bütçe taslağını hazırla', 'Geçen çeyreğin harcamalarını çıkar', TRUE, 0
  UNION ALL SELECT 'Q4 bütçe taslağını hazırla', 'Ekiplerin taleplerini topla', TRUE, 1
  UNION ALL SELECT 'Q4 bütçe taslağını hazırla', 'Taslağı finansla paylaş', FALSE, 2
  UNION ALL SELECT 'Demo ortamını kontrol et', 'Staging verisini yenile', FALSE, 0
  UNION ALL SELECT 'Demo ortamını kontrol et', 'Giriş ve izin akışını dene', FALSE, 1
) x JOIN todo_items ti ON ti.title = x.title;

-- "Önemli" yıldızı kişiye özeldir: kartı ekleyenin yıldızı olarak yazılır.
INSERT INTO todo_stars (item_id, user_id) SELECT id, user_id FROM todo_items WHERE important = b'1';

-- Tamamlayan kişi: kendi kartlarını sahipleri tamamlamıştır; ortak listedeki bir kartı başka bir üye (Ayşe) tamamlamıştır.
UPDATE todo_items SET done_by_id = user_id WHERE done = b'1';
UPDATE todo_items ti JOIN users us ON us.email = 'ayse.kaya@devhub.local'
SET ti.done_by_id = us.id WHERE ti.title = 'Giriş ekranı erişilebilirlik kontrolü';

-- Ortak listedeki kartlarda yorumlar
INSERT INTO todo_comments (item_id, user_id, body, created_at)
SELECT ti.id, us.id, x.body, NOW() - INTERVAL x.ago HOUR
FROM (
  SELECT 'Auth servisinin yük testini çalıştır' AS title, 'ali.yilmaz' AS k, 'Staging ortamında çalıştıralım, canlıya dokunmayalım.' AS body, 5 AS ago
  UNION ALL SELECT 'Auth servisinin yük testini çalıştır', 'ayse.kaya', 'Tamam, senaryoları yarın sabah hazır ederim.', 3
  UNION ALL SELECT 'Giriş ekranı erişilebilirlik kontrolü', 'ayse.kaya', 'Kontrast ve klavye gezintisini doğruladım, kapattım.', 20
) x JOIN todo_items ti ON ti.title = x.title JOIN users us ON us.email = CONCAT(x.k, '@devhub.local');

-- Saatli ve tekrarlayan kartlar (haftalık plan, hatırlatma)
UPDATE todo_items SET due_time = '16:30', repeat_rule = 'WEEKLY' WHERE title = 'Haftalık durum raporunu gönder';
UPDATE todo_items SET due_time = '14:00' WHERE title = 'Sprint demosu için sunumu hazırla';
UPDATE todo_items SET due_time = '10:00', repeat_rule = 'WEEKDAYS' WHERE title = 'Bekleyen PR incelemelerine bak';
UPDATE todo_items SET due_time = '11:00' WHERE title = 'Refresh token testlerini yaz';

-- Bir DevHub görevinden plana alınmış kart: Ali'nin son tarihi en yakın açık görevi
INSERT INTO todo_items (user_id, list_id, title, important, my_day, due_date, position, task_id, created_at, updated_at)
SELECT tk.user_id, NULL, tk.content, FALSE, NULL, tk.due_date, 2, tk.id, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR
FROM tasks tk JOIN users us ON us.id = tk.user_id
WHERE us.email = 'ali.yilmaz@devhub.local' AND tk.status <> 'TAMAMLANDI' AND tk.due_date >= CURDATE()
ORDER BY tk.due_date, tk.id LIMIT 1;

-- Saati geçmiş kartlar için hatırlatma yeniden gönderilmesin (saatler İstanbul saatiyle; sunucu UTC)
UPDATE todo_items SET reminded = (due_time IS NOT NULL AND TIMESTAMP(due_date, due_time) <= NOW() + INTERVAL 3 HOUR);

-- Henüz açılmamış gelen kartların bildirimi
INSERT INTO notifications (user_id, actor_id, type, title, body, link, created_at)
SELECT ti.user_id, ti.sent_by_id, 'TODO_RECEIVED', CONCAT(sn.full_name, ' size bir yapılacak gönderdi'),
       CONCAT(ti.title, IF(ti.sent_message IS NULL, '', CONCAT(' — ', ti.sent_message))), CONCAT('/todo?item=', ti.id), ti.created_at
FROM todo_items ti JOIN users sn ON sn.id = ti.sent_by_id WHERE ti.seen = b'0';

-- ---------------------------------------------------------------------
-- İzin kararlarına açıklama (reddedilenlerin hepsinde, onaylananların birkaçında)
-- ---------------------------------------------------------------------
UPDATE leave_requests SET decision_note = 'Bu tarihlerde sprint demosu var; ekipte en az iki backend geliştirici bulunmalı. Bir hafta sonrası için yeniden talep açabilirsiniz.'
WHERE state = 'REDDEDILDI';
UPDATE leave_requests SET decision_note = 'İyi tatiller! Devir notlarını ekip kanalına bırakmayı unutmayın.'
WHERE state = 'ONAYLANDI' AND type = 'YILLIK' AND start_date > CURDATE();

-- ---------------------------------------------------------------------
-- Profil bağlantıları (kişi kendisi ekler; onay gerekmez)
-- ---------------------------------------------------------------------
INSERT INTO user_links (user_id, type, label, value, position)
SELECT us.id, x.type, x.label, x.value, x.pos
FROM (
  SELECT 'admin' AS k, 'EMAIL' AS type, 'Destek' AS label, 'destek@devhub.local' AS value, 0 AS pos
  UNION ALL SELECT 'admin', 'PHONE', 'Dahili', '+90 212 555 01 00', 1
  UNION ALL SELECT 'ali.yilmaz', 'LINKEDIN', NULL, 'https://www.linkedin.com/in/ali-yilmaz-ornek', 0
  UNION ALL SELECT 'ali.yilmaz', 'GITHUB', NULL, 'https://github.com/aliyilmaz-ornek', 1
  UNION ALL SELECT 'ali.yilmaz', 'EMAIL', 'Kişisel', 'ali.yilmaz@example.com', 2
  UNION ALL SELECT 'ayse.kaya', 'GITHUB', NULL, 'https://github.com/aysekaya-ornek', 0
  UNION ALL SELECT 'ayse.kaya', 'WEBSITE', 'Blog', 'https://aysekaya.example.com', 1
  UNION ALL SELECT 'elif.arslan', 'WEBSITE', 'Portfolyo', 'https://elifarslan.example.com', 0
  UNION ALL SELECT 'elif.arslan', 'LINKEDIN', NULL, 'https://www.linkedin.com/in/elif-arslan-ornek', 1
) x JOIN users us ON us.email = CONCAT(x.k, '@devhub.local');

-- Zenginleştirme: bağlantısı olmayan her aktif kişiye dahili hat ve LinkedIn; yazılımcılara GitHub, bazılarına kişisel e-posta
INSERT INTO user_links (user_id, type, label, value, position)
SELECT us.id, 'PHONE', 'Dahili', CONCAT('+90 212 555 01 ', LPAD(us.id + 10, 2, '0')), 0
FROM users us WHERE us.active = b'1' AND us.email LIKE '%@devhub.local' AND NOT EXISTS (SELECT 1 FROM user_links l WHERE l.user_id = us.id);
INSERT INTO user_links (user_id, type, label, value, position)
SELECT us.id, 'LINKEDIN', NULL, CONCAT('https://www.linkedin.com/in/', REPLACE(SUBSTRING_INDEX(us.email, '@', 1), '.', '-'), '-ornek'), 1
FROM users us WHERE us.active = b'1' AND us.email LIKE '%@devhub.local' AND (SELECT COUNT(*) FROM user_links l WHERE l.user_id = us.id) = 1;
INSERT INTO user_links (user_id, type, label, value, position)
SELECT us.id, 'GITHUB', NULL, CONCAT('https://github.com/', REPLACE(SUBSTRING_INDEX(us.email, '@', 1), '.', ''), '-ornek'), 2
FROM users us WHERE us.active = b'1' AND us.email LIKE '%@devhub.local' AND (SELECT COUNT(*) FROM user_links l WHERE l.user_id = us.id) = 2
  AND (us.job_title LIKE '%Developer%' OR us.job_title LIKE '%DevOps%' OR us.job_title LIKE '%QA%' OR us.job_title LIKE '%Data%');
INSERT INTO user_links (user_id, type, label, value, position)
SELECT us.id, 'EMAIL', 'Kişisel', CONCAT(SUBSTRING_INDEX(us.email, '@', 1), '@example.com'), 3
FROM users us WHERE us.active = b'1' AND us.email LIKE '%@devhub.local' AND us.id % 3 = 0
  AND NOT EXISTS (SELECT 1 FROM user_links l WHERE l.user_id = us.id AND l.type = 'EMAIL');

-- ---------------------------------------------------------------------
-- Ad / unvan değişikliği talepleri: biri bekliyor, biri açıklamayla reddedilmiş
-- ---------------------------------------------------------------------
INSERT INTO profile_change_requests (user_id, full_name, job_title, previous_full_name, previous_job_title, state, decision_note, decided_by, decided_at, created_at)
SELECT us.id, us.full_name, 'Senior Backend Developer', us.full_name, us.job_title, 'BEKLIYOR', NULL, NULL, NULL, NOW() - INTERVAL 5 HOUR
FROM users us WHERE us.email = 'ayse.kaya@devhub.local';
INSERT INTO profile_change_requests (user_id, full_name, job_title, previous_full_name, previous_job_title, state, decision_note, decided_by, decided_at, created_at)
SELECT us.id, us.full_name, 'Head of Product', us.full_name, us.job_title, 'REDDEDILDI',
       'Unvan değişiklikleri yıl sonu değerlendirmesinden sonra yapılıyor; o zaman tekrar konuşalım.', @admin, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 3 DAY
FROM users us WHERE us.email = 'burak.polat@devhub.local';

INSERT INTO notifications (user_id, actor_id, type, title, body, link, created_at)
SELECT @admin, r.user_id, 'PROFILE_REQUESTED', CONCAT(us.full_name, ' profil değişikliği istedi'),
       CONCAT('Unvan: ', COALESCE(r.previous_job_title, '—'), ' → ', COALESCE(r.job_title, '—')), '/users', r.created_at
FROM profile_change_requests r JOIN users us ON us.id = r.user_id WHERE r.state = 'BEKLIYOR';


-- ---------------------------------------------------------------------
-- İzin ve profil talebi logları: yukarıdaki gerçek kayıtlardan üretilir (talep, karar, kesinleştirme)
-- ---------------------------------------------------------------------
INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'IZIN', 'TALEP', 'BILGI', 'İzin talebi oluşturuldu', lr.created_at, lr.user_id, 'IZIN', lr.id, us.full_name,
       CONCAT(CASE lr.type WHEN 'YILLIK' THEN 'Yıllık izin' WHEN 'HASTALIK' THEN 'Hastalık' ELSE 'Mazeret' END, ' · ',
              DATE_FORMAT(lr.start_date, '%d.%m'), IF(lr.end_date = lr.start_date, '', CONCAT(' – ', DATE_FORMAT(lr.end_date, '%d.%m'))),
              IF(lr.note IS NULL, '', CONCAT('\nNot: ', lr.note)), '\nYönetici onayı bekleniyor'),
       CONCAT('10.20.0.', lr.user_id)
FROM leave_requests lr JOIN users us ON us.id = lr.user_id;

INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'IZIN', IF(lr.state = 'ONAYLANDI', 'ONAY', 'RET'), 'BILGI',
       CONCAT(IF(lr.state = 'ONAYLANDI', 'İzin talebi onaylandı: ', 'İzin talebi reddedildi: '), us.full_name),
       lr.decided_at, lr.decided_by, 'IZIN', lr.id, us.full_name,
       CONCAT(CASE lr.type WHEN 'YILLIK' THEN 'Yıllık izin' WHEN 'HASTALIK' THEN 'Hastalık' ELSE 'Mazeret' END, ' · ',
              DATE_FORMAT(lr.start_date, '%d.%m'), IF(lr.end_date = lr.start_date, '', CONCAT(' – ', DATE_FORMAT(lr.end_date, '%d.%m'))),
              IF(lr.decision_note IS NULL, '', CONCAT('\nAçıklama: ', lr.decision_note)), '\nKarar kesinleşene kadar geri alınabilir'),
       CONCAT('10.20.0.', lr.decided_by)
FROM leave_requests lr JOIN users us ON us.id = lr.user_id
WHERE lr.state IN ('ONAYLANDI', 'REDDEDILDI') AND lr.decided_at IS NOT NULL;

INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'IZIN', 'KESINLESTIRME', 'BILGI', CONCAT('İzin kararı kesinleştirildi: ', us.full_name), lr.finalized_at, lr.decided_by, 'IZIN', lr.id, us.full_name,
       CONCAT('Karar: ', IF(lr.state = 'ONAYLANDI', 'Onaylandı', 'Reddedildi'), '\nBu karar artık değiştirilemez'), CONCAT('10.20.0.', lr.decided_by)
FROM leave_requests lr JOIN users us ON us.id = lr.user_id
WHERE lr.finalized = b'1' AND lr.finalized_at IS NOT NULL AND lr.decided_by IS NOT NULL;

INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'PROFIL', 'TALEP', 'BILGI', 'Profil değişikliği talep edildi', r.created_at, r.user_id, 'PROFIL_TALEBI', r.id, us.full_name,
       CONCAT('Unvan: ', COALESCE(r.previous_job_title, '—'), ' → ', COALESCE(r.job_title, '—'), '\nYönetici onayı bekleniyor'), CONCAT('10.20.0.', r.user_id)
FROM profile_change_requests r JOIN users us ON us.id = r.user_id;

INSERT INTO action_logs (category, action, level, message, created_at, actor_id, target_type, target_id, target_name, details, ip_address)
SELECT 'PROFIL', IF(r.state = 'ONAYLANDI', 'ONAY', 'RET'), 'BILGI',
       CONCAT(IF(r.state = 'ONAYLANDI', 'Profil değişikliği onaylandı: ', 'Profil değişikliği reddedildi: '), us.full_name),
       r.decided_at, r.decided_by, 'PROFIL_TALEBI', r.id, us.full_name,
       CONCAT('Unvan: ', COALESCE(r.previous_job_title, '—'), ' → ', COALESCE(r.job_title, '—'), IF(r.decision_note IS NULL, '', CONCAT('\nAçıklama: ', r.decision_note))),
       CONCAT('10.20.0.', r.decided_by)
FROM profile_change_requests r JOIN users us ON us.id = r.user_id
WHERE r.state IN ('ONAYLANDI', 'REDDEDILDI') AND r.decided_at IS NOT NULL;

-- Hafta sonuna düşen tüm log kayıtları (ör. izin kararları, duyurular) önceki Cuma'ya alınır: ofis hafta sonu çalışmaz.
UPDATE action_logs
SET created_at = created_at - INTERVAL (CASE DAYOFWEEK(CONVERT_TZ(created_at, '+00:00', '+03:00')) WHEN 1 THEN 2 ELSE 1 END) DAY
WHERE DAYOFWEEK(CONVERT_TZ(created_at, '+00:00', '+03:00')) IN (1, 7);

DROP TEMPORARY TABLE IF EXISTS u, t, l, g, h, c, td;

-- ---------------------------------------------------------------------
-- Tutarlılık kontrolü: her satır bir kural ihlalidir; boş sonuç beklenir.
-- ---------------------------------------------------------------------
SELECT 'İzinli kişinin açık görevi' AS ihlal, us.full_name AS kim, tk.content AS detay
FROM tasks tk JOIN users us ON us.id = tk.user_id
WHERE us.status = 'IZINLI' AND tk.status <> 'TAMAMLANDI'
UNION ALL
SELECT 'İzinli durumunun izin kaydı yok', us.full_name, ''
FROM users us
WHERE us.status = 'IZINLI' AND NOT EXISTS (
  SELECT 1 FROM leave_requests lr WHERE lr.user_id = us.id AND lr.state = 'ONAYLANDI' AND CURDATE() BETWEEN lr.start_date AND lr.end_date)
UNION ALL
SELECT 'Son tarih izin günlerine denk geliyor', us.full_name, tk.content
FROM tasks tk JOIN users us ON us.id = tk.user_id
JOIN leave_requests lr ON lr.user_id = us.id AND lr.state IN ('ONAYLANDI', 'BEKLIYOR')
WHERE tk.status <> 'TAMAMLANDI' AND tk.due_date BETWEEN lr.start_date AND lr.end_date
UNION ALL
SELECT 'Görev proje teslimini aşıyor', us.full_name, tk.content
FROM tasks tk JOIN users us ON us.id = tk.user_id JOIN projects p ON p.name = us.current_project
WHERE tk.status <> 'TAMAMLANDI' AND tk.due_date > p.deadline
UNION ALL
SELECT 'Beklemedeki/biten projede açık görev', us.full_name, tk.content
FROM tasks tk JOIN users us ON us.id = tk.user_id JOIN projects p ON p.name = us.current_project
WHERE p.status IN ('BEKLEMEDE', 'TAMAMLANDI') AND tk.status <> 'TAMAMLANDI'
UNION ALL
SELECT 'Hafta sonu tarihi', 'görev', tk.content FROM tasks tk WHERE DAYOFWEEK(tk.due_date) IN (1, 7)
UNION ALL
SELECT 'Hafta sonu tarihi', 'proje', p.name FROM projects p WHERE DAYOFWEEK(p.deadline) IN (1, 7)
UNION ALL
SELECT 'Hafta sonu tarihi', 'izin', us.full_name FROM leave_requests lr JOIN users us ON us.id = lr.user_id
WHERE DAYOFWEEK(lr.start_date) IN (1, 7) OR DAYOFWEEK(lr.end_date) IN (1, 7)
UNION ALL
SELECT 'Yıllık izin bakiyesi aşılıyor', b.full_name, CONCAT(b.used, ' / ', b.annual_leave_days, ' iş günü')
FROM (
  SELECT us.full_name, us.annual_leave_days, COUNT(*) AS used
  FROM leave_requests lr
  JOIN users us ON us.id = lr.user_id
  JOIN (
    WITH RECURSIVE d AS (
      SELECT MAKEDATE(YEAR(CURDATE()), 1) AS day
      UNION ALL SELECT day + INTERVAL 1 DAY FROM d WHERE day < MAKEDATE(YEAR(CURDATE()) + 1, 1) - INTERVAL 1 DAY
    ) SELECT day FROM d
  ) days ON days.day BETWEEN lr.start_date AND lr.end_date
  WHERE lr.type = 'YILLIK' AND lr.state IN ('ONAYLANDI', 'BEKLIYOR')
    AND DAYOFWEEK(days.day) NOT IN (1, 7) AND days.day NOT IN (SELECT date FROM holidays)
  GROUP BY us.id
) b WHERE b.used > b.annual_leave_days
UNION ALL
SELECT 'Aktif olmayan kişide açık görev', us.full_name, tk.content
FROM tasks tk JOIN users us ON us.id = tk.user_id WHERE us.active = b'0' AND tk.status <> 'TAMAMLANDI'
UNION ALL
SELECT 'Görevi başkasına çalışan atamış', us.full_name, tk.content
FROM tasks tk JOIN users us ON us.id = tk.created_by_id WHERE tk.created_by_id <> tk.user_id AND us.role <> 'ADMIN'
UNION ALL
SELECT 'Geçmiş kaydı görevden önce / gelecekte', CAST(a.task_id AS CHAR), a.message
FROM task_activity a JOIN tasks tk ON tk.id = a.task_id WHERE a.created_at < tk.created_at OR a.created_at > NOW()
UNION ALL
SELECT 'Kart, sahibinin üyesi olmadığı bir listede', us.full_name, ti.title
FROM todo_items ti JOIN users us ON us.id = ti.user_id
WHERE ti.list_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM todo_list_members m WHERE m.list_id = ti.list_id AND m.user_id = ti.user_id)
UNION ALL
SELECT 'Yöneticisi olmayan liste', tl.name, ''
FROM todo_lists tl WHERE NOT EXISTS (SELECT 1 FROM todo_list_members m WHERE m.list_id = tl.id AND m.role = 'ADMIN')
UNION ALL
SELECT 'Kişisel kart başkasının görevine bağlı', us.full_name, ti.title
FROM todo_items ti JOIN tasks tk ON tk.id = ti.task_id JOIN users us ON us.id = ti.user_id WHERE tk.user_id <> ti.user_id
UNION ALL
SELECT 'Tarihsiz kartta saat veya tekrar', us.full_name, ti.title
FROM todo_items ti JOIN users us ON us.id = ti.user_id WHERE ti.due_date IS NULL AND (ti.due_time IS NOT NULL OR ti.repeat_rule IS NOT NULL)
UNION ALL
SELECT 'Kişisel kartta hafta sonu tarihi', us.full_name, ti.title
FROM todo_items ti JOIN users us ON us.id = ti.user_id WHERE DAYOFWEEK(ti.due_date) IN (1, 7)
UNION ALL
SELECT 'Gelecek tarihli log', lg.category, lg.message FROM action_logs lg WHERE lg.created_at > NOW() + INTERVAL 1 MINUTE
UNION ALL
SELECT 'İzin bitişi başlangıçtan önce', us.full_name, CONCAT(lr.start_date, ' – ', lr.end_date)
FROM leave_requests lr JOIN users us ON us.id = lr.user_id WHERE lr.end_date < lr.start_date
UNION ALL
SELECT 'Kişinin projesi yok listesinde', us.full_name, us.current_project
FROM users us WHERE us.current_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.name = us.current_project);
