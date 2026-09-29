---
title: Loglama ve Gözlemlenebilirlik
category: kalite
order: 4
summary: Log seviyeleri, yapılandırılmış log, Sistem İzleme sayfası ve yeni bir servisi izlemeye ekleme.
author: Mustafa Koç
updated: 2026-09-29
tags: log, izleme, metrik
---

Bir sorunu çözmek için önce onu görebilmemiz gerekir. Üç kaynağımız var: loglar, metrikler ve sağlık kontrolleri.

## Log seviyeleri

| Seviye | Ne zaman | Örnek |
| --- | --- | --- |
| `ERROR` | Bir işlem başarısız oldu ve biri ilgilenmeli | Veritabanına yazılamadı |
| `WARN` | Beklenmedik ama sistem devam ediyor | Docker izleme vekiline ulaşılamadı |
| `INFO` | Önemli iş olayları | Zamanlanmış izin işi 3 kaydı güncelledi |
| `DEBUG` | Geliştirme sırasında ayrıntı | Gelen istek gövdesi |

> [!UYARI]
> Döngü içinde `INFO` log yazmayın. 10 saniyede bir çalışan bir iş, günde 8.640 satır üretir.

## İyi bir log satırı

Log, bağlamı taşımalıdır; "hata oluştu" tek başına işe yaramaz:

```java
log.warn("İzin durumu güncellenemedi: userId={}, leaveId={}, neden={}",
         user.getId(), leave.getId(), e.getMessage());
```

## Sistem İzleme sayfası

Yöneticiler **Sistem → Sistem İzleme** sayfasından her servisin anlık durumunu görür:

- CPU ve bellek kullanımı (Docker istatistikleri)
- Sağlık kontrolü sonucu ve yanıt süresi
- Son bir saatin durum geçmişi ve grafikleri
- Servise özel metrikler: JVM heap, veritabanı bağlantı sayısı gibi

Bir servis CPU veya bellek sınırının %85'ini aştığında ya da sağlık kontrolü yavaşladığında **Uyarı**, konteyner durduğunda veya kontrol başarısız olduğunda **Çalışmıyor** olarak görünür.

## Yeni bir servisi izlemeye ekleme

Servisler `monitoring.yml` dosyasında tanımlanır. Yeni bir kayıt eklemek yeterlidir:

```yaml
- id: odeme-api
  name: Ödeme Sağlayıcısı
  kind: Dış servis
  check: HTTP
  target: https://status.example.com/health
```

| Alan | Açıklama |
| --- | --- |
| `container` | Docker konteyner adı; verilirse CPU/bellek toplanır |
| `check` | `HTTP`, `TCP` veya `JDBC` sağlık kontrolü |
| `target` | Kontrol adresi (URL veya host:port) |
| `probe` | Servise özel metrikler: `JVM`, `MYSQL` |

> [!IPUCU]
> Compose projesine eklenen yeni konteynerler hiçbir ayar yapmadan sayfada "otomatik bulundu" etiketiyle listelenir. Anlamlı bir ad ve sağlık kontrolü için yine de `monitoring.yml`'a eklemeniz önerilir.
