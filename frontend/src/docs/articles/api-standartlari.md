---
title: REST API Tasarım Standartları
category: mimari
order: 2
summary: Uç nokta isimlendirme, HTTP metotları, hata formatı, durum kodları, sayfalama ve sürümleme kuralları.
author: Fatma Çelik
updated: 2026-09-08
tags: api, rest, http
---

Tüm uç noktalar `/api` altında yer alır ve JSON konuşur. Bu kurallar hem yeni uç noktalar hem de mevcutlarda yapılan değişiklikler için geçerlidir.

## İsimlendirme

- Kaynak adları **çoğul isimdir**: `/api/tasks`, `/api/leaves`
- Alt kaynaklar iç içe yazılır: `/api/tasks/{id}/comments`
- Kaynak olmayan işlemler fiille biter: `/api/leaves/{id}/finalize`
- URL'ler küçük harf ve tire ile yazılır: `/api/admin/reset-password`

## HTTP metotları

| Metot | Kullanım | Başarılı yanıt |
| --- | --- | --- |
| `GET` | Okuma; yan etkisi olmaz | 200 |
| `POST` | Yeni kaynak oluşturma | 200 / 201 |
| `PUT` | Kısmi güncelleme (yalnızca gönderilen alanlar değişir) | 200 |
| `DELETE` | Silme | 204 |

> [!NOT]
> `PUT` uç noktalarımız kısmi güncelleme yapar: gövdede olmayan alan değişmez, `null` gönderilen alan temizlenir. Bu yüzden istemci yalnızca değiştirdiği alanları gönderir.

## Hata formatı

Tüm hatalar aynı biçimde döner ve mesaj kullanıcıya doğrudan gösterilebilecek Türkçe bir cümledir:

```json
{
  "message": "Yıllık izin bakiyeniz yetersiz: 3 iş günü kaldı, 5 iş günü talep edildi."
}
```

| Kod | Ne zaman |
| --- | --- |
| 400 | Doğrulama hatası, iş kuralı ihlali |
| 401 | Oturum yok veya süresi dolmuş |
| 403 | Oturum var ama yetki yok |
| 404 | Kaynak bulunamadı |
| 409 | Çakışma (ör. aynı e-posta zaten kayıtlı) |
| 503 | Bağımlı servis (ör. veritabanı) erişilemez |

> [!UYARI]
> Hata mesajına istisna metni, SQL veya stack trace koymayın. Bunlar sunucu loguna yazılır; kullanıcı yalnızca ne yapması gerektiğini görür.

## Sayfalama

Büyüyebilecek listeler sayfalanır. Parametreler `page` (0'dan başlar) ve `size`'dır; yanıt toplam kayıt sayısını içerir:

```http
GET /api/logs?page=2&size=50
```

```json
{
  "items": [],
  "page": 2,
  "size": 50,
  "total": 1240
}
```

## Tarih ve saat

- Gün değerleri `yyyy-MM-dd` biçimindedir: `"dueDate": "2026-10-15"`
- Zaman damgaları UTC'dir; istemci kullanıcının saat dilimine çevirir.

## Sürümleme

Geriye dönük uyumsuz bir değişiklik gerekirse eski uç nokta kaldırılmaz; yeni sürüm yan yana açılır (`/api/v2/...`) ve eski sürüm en az iki yayın boyunca desteklenir.
