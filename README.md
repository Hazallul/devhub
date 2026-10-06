<div align="center">

# DevHub

**Ekibin görevleri, izinleri, dokümanları ve kişisel yapılacakları tek yerde.**

Küçük ve orta ölçekli yazılım ekipleri için hazırlanmış bir ekip yönetim paneli:
kim ne üzerinde çalışıyor, hangi iş gecikiyor, kim izinde, bugün ne yapmam gerekiyor; hepsi aynı ekranda.

**Türkçe** · [English](README.en.md)

![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Spring Boot](https://img.shields.io/badge/Spring_Boot_4-6DB33F?logo=springboot&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL_8-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

<img src="docs/screenshots/overview.webp" alt="DevHub genel bakış ekranı" width="100%">

</div>

---

## İçindekiler

- [Neler yapabilirsiniz?](#neler-yapabilirsiniz)
- [Hızlı başlangıç](#hızlı-başlangıç)
- [Kullanım rehberi](#kullanım-rehberi)
- [Çalışan ve yönetici](#çalışan-ve-yönetici)
- [Küçük ipuçları](#küçük-ipuçları)
- [Sık karşılaşılan sorunlar](#sık-karşılaşılan-sorunlar)

## Neler yapabilirsiniz?

| | |
|---|---|
| **Görevler** | Herkesin işini kişi panosunda ya da bütün görevleri tek tabloda görün. Atanmamış işleri tek tıkla birine atayın. Alt görev, etiket, dosya eki ve "şu bitmeden başlayamaz" bağımlılığı eklenebilir. |
| **İş gücü takibi** | Her göreve tahmini süre verilir; görev "Devam ediyor"dayken geçen mesai süresi otomatik sayılır. Tahmin ile gerçekleşen yan yana görünür. |
| **Yapılacaklarım** | Kendinize özel kartlar, listeler ve iki haftalık plan. Listeleri ekip arkadaşlarınızla paylaşabilirsiniz. |
| **Destek talepleri** | Çalışan arıza, erişim, ekipman gibi ihtiyaçlarını yönetime iletir; yönetici atar, takip eder. Çözüm hedefi önceliğe göre mesai saatiyle hesaplanır; talepten görev açılabilir. |
| **İzinler** | İzin talebi, yönetici onayı ve ekibin iki haftalık izin takvimi. Yıllık izin hakkı işe giriş tarihinden kendiliğinden hesaplanır. |
| **Anketler** | Yönetici herkese, bir departmana ya da seçtiği kişilere anket gönderir. Anonim seçeneği, son tarih, hatırlatma ve grafikli sonuçlar. |
| **Dokümantasyon** | Ekibin el kitabını sitede yazın ve düzenleyin. Çalışanların değişiklikleri yönetici onayından sonra yayınlanır. |
| **Anlık bildirimler** | Size görev atandığında, izniniz onaylandığında ya da kartınıza yorum geldiğinde sayfayı yenilemeden haberiniz olur. |
| **Yönetim** | Kullanıcı hesapları, raporlar, ayrıntılı işlem kayıtları (Excel'e aktarılabilir), sistem sağlığı ve otomatik veritabanı yedekleri. |
| **Açık ve koyu tema** | Her cihazda ayrı seçilir; giriş ekranından bile değiştirilebilir. |

## Hızlı başlangıç

Bilgisayarınızda yalnızca **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** kurulu olması yeterli. Java, Node.js ya da MySQL kurmanıza gerek yok; hepsi Docker'ın içinde çalışır.

```bash
git clone https://github.com/Hazallul/devhub.git
cd devhub/devhub
docker compose up -d --build
```

İlk açılış birkaç dakika sürer (gerekli paketler indirilir). Sonra tarayıcıda açın:

**http://localhost:5173**

Giriş ekranının altındaki **Yönetici** ya da **Çalışan** düğmesine basmanız yeterli; örnek hesaplarla tek tıkla giriş yapılır. İki rolü de denemek için birinden çıkıp diğeriyle girin.

<details>
<summary>Daha dolu örnek veri istiyorsanız</summary>

Projeler, görevler, izinler ve duyurular tarihleri bugüne göre ayarlanmış örnek verilerle doldurulur (mevcut verilerin üzerine yazar):

```bash
docker exec -i devhub-mysql mysql -uroot -proot --default-character-set=utf8mb4 devhub < scripts/demo-data.sql
```

Departmanlar, etiketler, alt görevler, destek talepleri ve anketler için ardından (Python 3 gerekir, tekrar çalıştırmak veriyi çoğaltmaz):

```bash
python scripts/demo-extras.py
```

</details>

<details>
<summary>Durdurmak ve yeniden başlatmak</summary>

```bash
docker compose stop      # durdurur, veriler kalır
docker compose start     # kaldığı yerden başlatır
docker compose down -v   # her şeyi siler (veritabanı dahil)
```

</details>

| Adres | Ne var? |
|---|---|
| http://localhost:5173 | DevHub |
| http://localhost:8025 | Test e-posta kutusu (şifre sıfırlama kodları buraya düşer, kimseye gerçek e-posta gitmez) |

## Kullanım rehberi

### Giriş ve şifremi unuttum

<img src="docs/screenshots/login.webp" alt="Giriş ekranı" width="100%">

E-posta ve şifrenizle giriş yapın. Sağ üstteki düğmelerle açık, koyu ya da sistem temasını seçebilirsiniz.

Şifrenizi unuttuysanız **Şifremi unuttum**'a basın:

1. E-postanızı yazın; adresinize 6 haneli bir kod gelir.
2. Kodu girin (kopyalayıp yapıştırmanız da olur).
3. Yeni şifrenizi belirleyin.
4. Talebiniz yöneticiye gider. Yönetici onaylayınca yeni şifreniz geçerli olur; o zamana kadar eski şifreniz çalışmaya devam eder.

Şifre değiştiğinde diğer cihazlardaki açık oturumlarınız güvenlik için kapanır.

### Genel bakış

Giriş yaptığınızda ilk gördüğünüz ekran (en üstteki görsel). **Bugünüm** bölümünde bugünkü kartlarınız durur; hemen altındaki kutuya yazıp Enter'a basarak yeni kart ekleyebilirsiniz.

- **Mavi zeminli, kare kutulu** kartlar size atanmış görevlerden gelir ("Görev · Proje adı" etiketiyle).
- **Yuvarlak kutulu** kartlar sizin kendi notlarınızdır.

Sağ tarafta yaklaşan son tarihleriniz, bekleyen talepleriniz ve izin kısayolu; aşağıda ekibin durumu, duyurular ve son hareketler var.

### Yapılacaklarım

Sol menüdeki **Yapılacaklarım** sizin kişisel alanınızdır; buradaki kartları sizden başkası görmez (paylaştığınız listeler hariç).

<img src="docs/screenshots/todo-today.webp" alt="Yapılacaklarım: Bugün panosu" width="100%">

**Bugün** ekranı günün tamamını tek bakışta gösterir: bugünün ve geciken kartların, önümüzdeki günler, size atanmış görevler, yıldızladıklarınız ve ekip arkadaşlarınızın size gönderdiği kartlar.

- Bir görevin yanındaki **güneş** düğmesi onu bugünün planına ekler.
- Karta tıklayınca ayrıntısı açılır: not, adımlar, tarih, saat hatırlatması ve tekrar (her gün, hafta içi, her hafta, her ay).
- Kartlar siz yazdıkça kaydedilir, "Kaydet"e basmanız gerekmez.

<img src="docs/screenshots/todo-week.webp" alt="Yapılacaklarım: Haftalık plan" width="100%">

**Haftalık plan** bu haftayı ve gelecek haftayı alt alta gösterir; pazar günü bile pazartesinin büyük işini görürsünüz. Kartları günler arasında sürükleyerek tarihini değiştirin. Kesik çizgili kutular görevlerinizin teslim tarihleridir.

**Listeler:** Sol menüden yeni liste açın, **Paylaş** ile ekip arkadaşlarınızı ekleyin. Paylaşılan listede herkes kartları görür, tamamlar ve yorum yazar.

### Görevler

<img src="docs/screenshots/tasks.webp" alt="Görevler: kişi panosu" width="100%">

Her satır bir kişidir: bu hafta kaç saat çalıştığı, kalan işi ve görevleri **Yapılacak / Devam ediyor / Tamamlandı** sütunlarında görünür.

- Kartı aynı satırda başka sütuna **sürükleyerek** durumunu değiştirin.
- **Kırmızı** kartlar gecikmiş, **turuncu** kartlar yüksek öncelikli işlerdir.
- Üstteki filtrelerle yalnızca kendi işlerinizi, bir projeyi, bir departmanı ya da bir önceliği görebilirsiniz.
- Kalabalık ekiplerde kişileri **Departman** ya da **Proje** ile gruplayın; gruplar açılıp kapanır ve tercihiniz hatırlanır.
- Panonun en üstündeki **Atanmamış** satırı henüz kimseye verilmemiş işleri gösterir. Yönetici kartı bir kişinin satırına sürükleyerek atar.

Sağ üstteki **Tablo** görünümü bütün görevleri (atanmış ya da atanmamış) tek listede gösterir: **Atanmamış** sekmesinde bekleyen işleri görün, **Atanan** sütunundan tek tıkla birine atayın ya da birden fazla görevi seçip toplu atayın. Sütun başlıklarına tıklayarak sıralayabilirsiniz. Çalışanlar atanmamış bir görevi **Üstlen** ile kendine alabilir.

<img src="docs/screenshots/tasks-table.webp" alt="Görevler: tablo görünümü" width="100%">

<img src="docs/screenshots/task-drawer.webp" alt="Görev ayrıntısı" width="100%">

Bir karta tıklayınca ayrıntısı sağda açılır: atanan kişi, öncelik, son tarih, açıklama, yorumlar ve görevin bütün geçmişi. **İş gücü** bölümü tahmini süreyi, şu ana kadar harcananı ve tahminin aşılıp aşılmadığını gösterir. Süre yalnızca mesai saatlerinde ve görev "Devam ediyor"dayken işler.

Ayrıntı panelinde ayrıca:

- **Etiketler:** "Müşteri hatası", "Fatura" gibi etiketler ekleyin; listede yoksa yazıp oluşturun.
- **Alt görevler:** işi adımlara bölün; kartta "1/3" gibi ilerleme görünür.
- **Bağımlılıklar:** "önce bitmesi gereken" görevi seçin. O görev bitmeden bu görev başlatılamaz; bitince size bildirim gelir.
- **Dosyalar:** ekran görüntüsü, PDF, Office belgesi ekleyin (en fazla 10 MB). Ekran görüntüsünü **Ctrl+V** ile doğrudan yapıştırabilirsiniz.

### Çalışanlar

<img src="docs/screenshots/team.webp" alt="Çalışanlar" width="100%">

Şirketteki herkes durumu (Aktif, Toplantıda, Uzaktan, İzinli), projesi ve görev sayısıyla listelenir. Bir kişiye tıklayınca satırı açılır: haftalık çalışma süresi, görevleri ve iletişim bağlantıları. Kendi satırınızdan hızlıca görev ekleyebilirsiniz.

Kendi durumunuzu sol alttaki adınızın yanından değiştirin.

### İzinler

<img src="docs/screenshots/leaves.webp" alt="İzinler" width="100%">

**İzin talebi** düğmesiyle talep oluşturun; yönetici onaylayınca durumunuz izin günlerinde kendiliğinden "İzinli" olur. Ekip takvimini tutup sağa sola sürükleyerek ileriki haftalara bakabilirsiniz. Yıllık izin hakkınız ve kalan gün sayınız bu sayfada. Planınız değişirse onaylanmış ama henüz başlamamış izninizi **✕** ile iptal edebilirsiniz; günler bakiyenize döner. Karar verilmeden tarihi geçen yıllık ve mazeret talepleri kendiliğinden kapanır.

### Destek talepleri

<img src="docs/screenshots/tickets.webp" alt="Destek talepleri" width="100%">

Bilgisayarınız mı bozuldu, VPN'e mi bağlanamıyorsunuz, yeni bir monitöre mi ihtiyacınız var? **Yeni talep** ile yönetime iletin. Talep her zaman sizin adınıza açılır; türünü (Arıza, Erişim / yetki, Ekipman, Diğer) ve önceliğini seçersiniz. **Çözüm hedefi** önceliğe göre mesai saatiyle hesaplanır (Acil 4 saat, Yüksek 1 iş günü, Normal 3 iş günü, Düşük 5 iş günü).

- Çalışan yalnızca **kendi açtığı** ve **kendisine atanan** talepleri görür; yönetici hepsini görür.
- Yönetici talebi çözecek kişiye atar; atanan kişi gerekirse **Bırak** ile talebi yönetime geri verir.
- Bir bilgi gerekiyorsa durum **Yanıt bekleniyor** yapılır; talep edene bildirim gider ve bu sürede talep gecikmiş sayılmaz.
- Ayrıntı panelinde yorum yazın, ekran görüntüsü ekleyin (Ctrl+V). Yönetici ya da atanan kişi **Bu talepten görev oluştur** ile işi görev panosuna taşıyabilir; görev bitince talebe not düşer.

### Anketler

<img src="docs/screenshots/survey-results.webp" alt="Anket sonuçları" width="100%">

Yönetici **Anketler → Yeni anket** ile hazır bir şablondan ya da boş sayfadan anket hazırlar: tek seçim, çoklu seçim, 1-5 puan ve yazılı yanıt soruları. Herkese, bir departmana ya da seçilen kişilere gönderilir; son tarih verilirse o saatte kendiliğinden kapanır.

- **Anonim** ankette yanıtlar kişiyle eşleştirilmez; kimin yanıtladığı yalnızca katılım için görünür.
- Çalışanlar bekleyen anketi Genel Bakış'ta ve menüdeki sayıda görür; yanıt birkaç dakika sürer.
- Yönetici sonuçları grafiklerle görür, yanıtlamayanlara **Hatırlat** der ve yanıtları **Excel** olarak indirir.

### Dokümantasyon

<img src="docs/screenshots/docs.webp" alt="Dokümantasyon" width="100%">

Ekibin el kitabı: kurulum rehberleri, süreçler, kurallar. Herkes **Düzenle** ile değişiklik önerebilir; tablo, kod bloğu, görsel ve not kutusu eklenebilir. Çalışanların önerileri yöneticinin onayından sonra yayınlanır, eski sürümler saklanır.

### Yönetici ekranları

Yönetici hesabıyla menüde **Yönetim** bölümü açılır.

| | |
|---|---|
| **Kullanıcılar** | Yeni çalışan ekleme, ad soyad ve unvan düzenleme, rol ve proje atama, hesabı kapatma. Hesabı kapatılan kişinin açık görevleri atanmamış havuza, talepleri yönetime döner; bekleyen izinleri iptal edilir. Şifre sıfırlama talepleri burada onaylanır. |
| **Raporlar** | İş yükü, proje ilerlemesi, tahmin ve gerçekleşen iş gücü, izin kullanımı. |
| **Loglar** | Kim, ne zaman, ne yaptı: girişler, görev değişiklikleri, onaylar. Filtrelenebilir, Excel'e aktarılabilir. |
| **Sistem izleme** | Servislerin sağlığı, işlemci ve bellek kullanımı, yanıt süreleri. |
| **Yedekler** | Bütün veriler 3 günde bir kendiliğinden yedeklenir; **Şimdi yedek al** ile elle de alınır. Yedekler bilgisayarda `devhub/backups` klasöründedir, indirilebilir ve **Bu yedeğe geri dön** ile geri yüklenebilir (önce o anki durumun yedeği alınır). |

Kullanıcı eklerken ya da düzenlerken **Departman** (ör. Proje, Destek, Test) verin: Görevler ve Çalışanlar sayfalarında gruplama ve filtre buna göre çalışır, anketler bir departmana gönderilebilir. Ad soyad ve unvanı yalnızca yönetici değiştirir.

<img src="docs/screenshots/reports.webp" alt="Raporlar" width="100%">

<details>
<summary>Diğer ekranlar</summary>

<br>

**Kullanıcılar**

<img src="docs/screenshots/users.webp" alt="Kullanıcılar" width="100%">

**Sistem izleme**

<img src="docs/screenshots/monitoring.webp" alt="Sistem izleme" width="100%">

**Yedekler**

<img src="docs/screenshots/backups.webp" alt="Yedekler" width="100%">

**Koyu tema**

<img src="docs/screenshots/overview-dark.webp" alt="Koyu tema" width="100%">

<img src="docs/screenshots/login-dark.webp" alt="Koyu temada giriş ekranı" width="100%">

</details>

## Çalışan ve yönetici

| | Çalışan | Yönetici |
|---|:---:|:---:|
| Kendi görevlerini ekleme ve güncelleme | ✓ | ✓ |
| Başkasına görev atama | | ✓ |
| Atanmamış görevi üstlenme | ✓ | ✓ |
| Destek talebi açma ve yorum (kendi talepleri) | ✓ | ✓ |
| Talepleri görme ve atama | | ✓ |
| Anket yanıtlama | ✓ | ✓ |
| Anket hazırlama ve sonuçlar | | ✓ |
| İzin talebi | ✓ | ✓ |
| İzin onaylama | | ✓ |
| Doküman düzenleme | öneri olarak | doğrudan |
| Proje açma, duyuru yayınlama | | ✓ |
| Kullanıcılar, raporlar, loglar, sistem izleme, yedekler | | ✓ |

## Küçük ipuçları

- **Ctrl + K** (Mac'te ⌘ + K): kişi, görev, proje ve doküman arama; sık kullanılan komutlar.
- **Sağ tık** her sayfada çalışır: kartlarda, satırlarda ve boş alanda o sayfaya özel işlemler açılır.
- Sağ üstteki **Yeni** düğmesi: görev, izin talebi, destek talebi; yönetici için proje, duyuru ve anket.
- **Ayarlar → Görünüm**: tema ve arayüz boyutu (Kompakt, Orta, Rahat).
- Bildirimler sağ üstteki zil simgesinde; okunmamış sayısı sekme başlığında da görünür.

## Sık karşılaşılan sorunlar

<details>
<summary>"port is already allocated" hatası</summary>

5173, 8081, 3306 ya da 8025 portlarından birini bilgisayarınızdaki başka bir program kullanıyor (çoğunlukla yerel bir MySQL). O programı kapatıp `docker compose up -d` komutunu tekrar çalıştırın.

</details>

<details>
<summary>Sayfa açılıyor ama giriş yapılamıyor</summary>

Backend ilk açılışta veritabanını hazırlarken bir dakika kadar sürebilir. Durumunu görmek için:

```bash
docker compose ps
```

`devhub-backend` satırında `healthy` yazınca tekrar deneyin.

</details>

<details>
<summary>Şifre sıfırlama kodu gelmedi</summary>

Yerel kurulumda e-postalar gerçek adrese gitmez, **http://localhost:8025** adresindeki test kutusuna düşer.

</details>

---

<div align="center">
<sub>Arayüz Türkçedir. Teknolojiler: React, TypeScript, Tailwind CSS, Framer Motion · Spring Boot, MySQL, Flyway · Docker.</sub>
</div>
