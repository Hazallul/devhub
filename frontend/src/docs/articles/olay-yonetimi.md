---
title: Olay Yönetimi ve Nöbet
category: kalite
order: 2
summary: Üretimde bir sorun çıktığında önem seviyeleri, ilk müdahale adımları, iletişim ve olay sonrası rapor.
author: Mustafa Koç
updated: 2026-09-19
tags: incident, nöbet, postmortem
---

Üretimde bir şey ters gittiğinde amacımız önce etkiyi durdurmak, sonra nedenini bulmaktır. Suçlu aranmaz; süreç iyileştirilir.

## Önem seviyeleri

| Seviye | Tanım | İlk yanıt | Örnek |
| --- | --- | --- | --- |
| SEV1 | Sistem tamamen erişilemez veya veri kaybı var | 15 dk | Veritabanı çöktü |
| SEV2 | Önemli bir özellik çalışmıyor, geçici çözüm yok | 1 saat | Kimse giriş yapamıyor |
| SEV3 | Bir özellik kısmen bozuk, geçici çözüm var | 1 iş günü | Rapor dışa aktarma hatalı |
| SEV4 | Kozmetik sorun | Sonraki sprint | Yanlış hizalanmış buton |

## İlk müdahale

1. **Kabul edin:** Nöbetçi, uyarıyı aldığını #olaylar kanalında bildirir.
2. **Etkiyi ölçün:** Sistem İzleme sayfasında hangi servislerin etkilendiğine bakın.
3. **Durdurun:** Son yayın sonrası başladıysa önce geri alın.
4. **İletişim kurun:** SEV1 ve SEV2 için her 30 dakikada bir durum güncellemesi yazın.
5. **Kapatın:** Etki bittiğinde olayı kapatın ve rapor için bir görev açın.

> [!ONEMLI]
> SEV1 durumunda nöbetçi tek başına çalışmaz. İlk 15 dakikada çözülemiyorsa takım liderini ve altyapı sorumlusunu çağırın.

## İlk bakılacak yerler

```bash
# Servislerin durumu
docker compose ps

# Backend'in son logları
docker compose logs --tail=200 backend

# Veritabanı bağlantı sayısı
docker exec devhub-mysql mysql -uroot -p -e "SHOW STATUS LIKE 'Threads_connected';"
```

## Nöbet düzeni

Nöbet haftalıktır ve pazartesi 10:00'da devredilir. Nöbetçi mesai dışında 30 dakika içinde bilgisayar başında olabilmelidir. İzin planlanırken nöbet haftasına denk gelmemesine dikkat edilir; gerekirse takas yapılır.

## Olay sonrası rapor

SEV1 ve SEV2 olayları için beş iş günü içinde rapor yazılır:

```text
Başlık:        Giriş servisinde 40 dakikalık kesinti
Tarih/Süre:    12.09.2026 14:10 – 14:50
Etki:          Kullanıcıların %100'ü giriş yapamadı
Kök neden:     Süresi dolan JWT imzalama anahtarı
Tespit:        Sistem İzleme uyarısı + kullanıcı bildirimi
Ne iyi gitti:  Geri alma 6 dakikada tamamlandı
Aksiyonlar:    [DH-201] Anahtar süresi için 14 gün önceden uyarı
```

> [!NOT]
> Raporda kişi adı değil rol yazılır: "geliştirici yanlış komutu çalıştırdı" yerine "komut, üretim ortamını onay istemeden değiştirebiliyordu".
