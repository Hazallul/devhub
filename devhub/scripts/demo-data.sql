-- =====================================================================
-- DevHub sunum verisi
-- Tüm tarihler çalıştırıldığı güne göre hesaplanır; sunumdan önce tekrar çalıştırılabilir:
--   docker exec -i devhub-mysql mysql -uroot -proot --default-character-set=utf8mb4 devhub < devhub/scripts/demo-data.sql
-- Kullanıcı hesapları ve şifreleri korunur; proje, görev, izin, duyuru ve log tabloları baştan yazılır.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM action_logs;
DELETE FROM announcements;
DELETE FROM leave_requests;
DELETE FROM tasks;
DELETE FROM projects;
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
UPDATE users SET job_title = 'DevOps Engineer', current_project = NULL, status = 'AKTIF', work_mode = 'AKTIF' WHERE email = 'kerem.aslan@devhub.local';
UPDATE users SET job_title = 'Scrum Master', current_project = 'Müşteri Portalı', status = 'AKTIF', work_mode = 'AKTIF' WHERE email = 'derya.sen@devhub.local';

-- E-postadan kullanıcı id'si (id'ler ortamdan ortama değişebilir)
DROP TEMPORARY TABLE IF EXISTS u;
CREATE TEMPORARY TABLE u (k VARCHAR(20) PRIMARY KEY, id BIGINT);
INSERT INTO u SELECT SUBSTRING_INDEX(email, '@', 1), id FROM users;
SET @admin = (SELECT id FROM users WHERE email = 'admin@devhub.local');

-- ---------------------------------------------------------------------
-- Görevler
-- Kurallar:
--  * İzinli kişilerin açık görevi yoktur: işleri izinden önce tamamlanmış ya da ekip arkadaşına devredilmiştir.
--  * Beklemedeki (Ödeme Altyapısı) ve tamamlanmış projelerde açık görev yoktur.
--  * Açık görevlerin son tarihi projenin teslim tarihini ve kişinin izin günlerini aşmaz; hafta sonuna denk gelmez.
-- Bilerek görevi olmayanlar: Emre (Devhub Core), Volkan (Enerji Optimizasyonu), Derya (Müşteri Portalı), Kerem (boşta).
-- Can'ın yalnızca tamamlanmış görevleri var (projede, açık görevi yok).
DROP TEMPORARY TABLE IF EXISTS t;
CREATE TEMPORARY TABLE t (k VARCHAR(20), content VARCHAR(1000), status VARCHAR(20), priority VARCHAR(10), due INT NULL, hours_ago INT);
INSERT INTO t VALUES
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
('buse.ozdemir',  'Test otomasyon araçlarını karşılaştır ve öneri hazırla',           'YAPILACAK',  'DUSUK',  7,    1);

INSERT INTO tasks (user_id, content, status, priority, due_date, created_at)
SELECT u.id, t.content, t.status, t.priority,
       IF(t.due IS NULL, NULL, CURDATE() + INTERVAL t.due DAY),
       NOW() - INTERVAL t.hours_ago HOUR
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
('merve.can',     'HASTALIK', -7,  -7, 'Migren',                           'ONAYLANDI',  TRUE,  7);

INSERT INTO leave_requests (user_id, type, start_date, end_date, note, state, decided_by, decided_at, finalized, finalized_at, created_at)
SELECT u.id, l.type, CURDATE() + INTERVAL l.s DAY, CURDATE() + INTERVAL l.e DAY, l.note, l.state,
       IF(l.state = 'BEKLIYOR', NULL, @admin),
       IF(l.state = 'BEKLIYOR', NULL, NOW() - INTERVAL l.days_ago DAY + INTERVAL 3 HOUR),
       l.fin,
       IF(l.fin, NOW() - INTERVAL l.days_ago DAY + INTERVAL 5 HOUR, NULL),
       NOW() - INTERVAL l.days_ago DAY - INTERVAL 2 HOUR
FROM l JOIN u ON u.k = l.k;

-- ---------------------------------------------------------------------
-- Hafta sonu düzeltmesi (tarihler çalıştırılan güne göre kaydığı için sonradan normalize edilir)
--  * Son tarih / teslim: Cumartesi → Cuma, Pazar → Pazartesi
--  * İzin başlangıcı hafta sonundaysa Pazartesi'ye, bitişi hafta sonundaysa Cuma'ya çekilir
-- ---------------------------------------------------------------------
UPDATE tasks    SET due_date = due_date - INTERVAL 1 DAY WHERE DAYOFWEEK(due_date) = 7;
UPDATE tasks    SET due_date = due_date + INTERVAL 1 DAY WHERE DAYOFWEEK(due_date) = 1;
UPDATE projects SET deadline = deadline - INTERVAL 1 DAY WHERE DAYOFWEEK(deadline) = 7;
UPDATE projects SET deadline = deadline + INTERVAL 1 DAY WHERE DAYOFWEEK(deadline) = 1;
UPDATE leave_requests SET start_date = start_date + INTERVAL 2 DAY WHERE DAYOFWEEK(start_date) = 7;
UPDATE leave_requests SET start_date = start_date + INTERVAL 1 DAY WHERE DAYOFWEEK(start_date) = 1;
UPDATE leave_requests SET end_date = end_date - INTERVAL 1 DAY WHERE DAYOFWEEK(end_date) = 7;
UPDATE leave_requests SET end_date = end_date - INTERVAL 2 DAY WHERE DAYOFWEEK(end_date) = 1;
-- Proje teslim tarihi hafta sonundan kaydıysa, o projenin açık görevleri teslimi aşmasın.
UPDATE tasks t JOIN users us ON us.id = t.user_id JOIN projects p ON p.name = us.current_project
SET t.due_date = p.deadline
WHERE t.status <> 'TAMAMLANDI' AND t.due_date > p.deadline;

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
-- Sistem logları (yalnızca proje ataması, İzinli'ye geçiş, yeni görev ve yeni proje)
-- ---------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS g;
-- days_ago/clock: mesai saatinde geçmiş bir an (İstanbul saati); hours_ago doluysa "şu andan X saat önce".
CREATE TEMPORARY TABLE g (days_ago INT, clock TIME, hours_ago INT NULL, message VARCHAR(400));
INSERT INTO g VALUES
(10, '09:40', NULL, 'Yeni ''Veri Ambarı Göçü'' projesi oluşturuldu.'),
(10, '09:52', NULL, 'Mustafa Koç, Veri Ambarı Göçü projesine atandı.'),
(10, '09:53', NULL, 'Merve Can, Veri Ambarı Göçü projesine atandı.'),
(8,  '14:15', NULL, 'Can Doğan için yeni görev eklendi.'),
(7,  '10:05', NULL, 'Yeni ''Müşteri Portalı'' projesi oluşturuldu.'),
(7,  '10:12', NULL, 'Derya Şen, Müşteri Portalı projesine atandı.'),
(5,  '16:30', NULL, 'Mustafa Koç için yeni görev eklendi.'),
(3,  '11:20', NULL, 'Burak Polat, Devhub Core projesine atandı.'),
(3,  '11:45', NULL, 'Volkan Aydın, Enerji Optimizasyonu projesine atandı.'),
(2,  '15:10', NULL, 'Buse Özdemir, Mobil Uygulama projesinden çıkarıldı ve boşa alındı.'),
(1,  '10:30', NULL, 'Ali Yılmaz için yeni görev eklendi.'),
(1,  '14:40', NULL, 'Seda Yıldız için yeni görev eklendi.'),
(1,  '17:05', NULL, 'Zeynep Öztürk için yeni görev eklendi.'),
(0,  NULL,    3,    'Admin için yeni görev eklendi.'),
(0,  NULL,    1,    'Buse Özdemir için yeni görev eklendi.');

-- İzinli geçişi, bugün süren her onaylı iznin başladığı sabah loglanır (izin kayıtlarıyla birebir tutarlı).
INSERT INTO g (days_ago, clock, hours_ago, message)
SELECT DATEDIFF(CURDATE(), lr.start_date), '08:45', NULL,
       CONCAT(us.full_name, ' durumu ''AKTIF'' -> ''IZINLI'' olarak güncellendi.')
FROM leave_requests lr JOIN users us ON us.id = lr.user_id
WHERE lr.state = 'ONAYLANDI' AND CURDATE() BETWEEN lr.start_date AND lr.end_date;

-- created_at UTC saklanır; mesajdaki damga İstanbul saatidir.
INSERT INTO action_logs (message, created_at)
SELECT CONCAT('[', DATE_FORMAT(CONVERT_TZ(x.at_utc, '+00:00', '+03:00'), '%d.%m.%Y %H:%i'), '] ', x.message), x.at_utc
FROM (
  SELECT message,
         IF(hours_ago IS NOT NULL,
            NOW() - INTERVAL hours_ago HOUR,
            CONVERT_TZ(TIMESTAMP(DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00')) - INTERVAL days_ago DAY, clock), '+03:00', '+00:00')) AS at_utc
  FROM g
) x
ORDER BY x.at_utc;

DROP TEMPORARY TABLE IF EXISTS u, t, l, g;

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
SELECT 'Kişinin projesi yok listesinde', us.full_name, us.current_project
FROM users us WHERE us.current_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.name = us.current_project);
