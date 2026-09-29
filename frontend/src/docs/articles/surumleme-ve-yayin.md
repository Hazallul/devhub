---
title: Sürümleme ve Yayın Süreci
category: surecler
order: 4
summary: Semantic Versioning, yayın takvimi, sürüm notları ve geri alma (rollback) prosedürü.
author: Mustafa Koç
updated: 2026-09-05
tags: release, semver, dağıtım
---

Her `main` birleştirmesi otomatik olarak staging ortamına dağıtılır. Üretime yayın ise haftada iki kez, salı ve perşembe günleri yapılır.

## Sürüm numaraları

[Semantic Versioning](https://semver.org) kullanıyoruz: `MAJOR.MINOR.PATCH`

| Parça | Artar | Örnek |
| --- | --- | --- |
| MAJOR | Geriye dönük uyumsuz API değişikliği | 2.0.0 |
| MINOR | Uyumlu yeni özellik | 1.4.0 |
| PATCH | Uyumlu hata düzeltmesi | 1.4.2 |

Sürüm numarası commit mesajlarından otomatik belirlenir: `feat` MINOR, `fix` PATCH, `BREAKING CHANGE` MAJOR artırır.

## Yayın adımları

1. Staging'de duman testleri (smoke test) geçer.
2. Sürüm etiketi oluşturulur ve sürüm notları otomatik üretilir.
3. Üretime kademeli dağıtım başlar: önce %10, 15 dakika sonra %100.
4. Yayını yapan kişi 30 dakika boyunca **Sistem İzleme** sayfasını takip eder.

```bash
git tag -a v1.8.0 -m "v1.8.0"
git push origin v1.8.0
```

> [!ONEMLI]
> Cuma günleri ve resmî tatil öncesi son iş günü üretime yayın yapılmaz. Acil güvenlik düzeltmeleri bu kuralın tek istisnasıdır.

## Veritabanı değişiklikleri

Şema değişiklikleri her zaman kodla aynı sürümde, Flyway migration'ı olarak gelir ve **geriye dönük uyumlu** olmalıdır. Bir kolonu silmek iki yayına yayılır:

1. Yayın: Kod kolonu okumayı bırakır.
2. Yayın: Migration kolonu siler.

## Geri alma

Yayından sonra hata oranı yükselirse önce geri alın, sonra araştırın:

```bash
./deploy.sh rollback --to v1.7.3
```

> [!NOT]
> Geri alma kararı için onay beklemeyin. Yayını yapan kişi bu yetkiye sahiptir; kararı sonra olay raporunda açıklar.
