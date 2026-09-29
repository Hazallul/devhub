---
title: Sprint ve Scrum Süreci
category: surecler
order: 3
summary: İki haftalık sprint döngüsü, toplantılar, tahminleme ve "tamamlandı" tanımı.
author: Burak Polat
updated: 2026-09-01
tags: scrum, sprint, planlama
---

İki haftalık sprintlerle çalışıyoruz. Amaç her sprint sonunda kullanıcıya ulaşabilecek, çalışan bir parça üretmektir.

## Sprint takvimi

| Gün | Etkinlik | Süre |
| --- | --- | --- |
| 1. pazartesi | Sprint planlama | 90 dk |
| Her gün 10:00 | Günlük toplantı | 15 dk |
| 2. çarşamba | Backlog düzenleme | 60 dk |
| 2. cuma | Demo | 45 dk |
| 2. cuma | Retrospektif | 45 dk |

## Tahminleme

Görevler hikâye puanıyla (1, 2, 3, 5, 8) tahmin edilir. 8 puanı geçen bir iş sprint'e alınmaz; önce bölünür.

> [!IPUCU]
> Puan, süreyi değil karmaşıklığı ve belirsizliği ölçer. "Bu kaç gün sürer?" yerine "Bunu yaparken bizi ne şaşırtabilir?" diye sorun.

## Kapasite

Sprint kapasitesi hesaplanırken izinler ve resmî tatiller düşülür. DevHub'daki **İzinler** takvimi bu hesap için tek doğru kaynaktır.

```text
kapasite = ekip üyesi sayısı × sprint iş günü − izin günleri
hedef    = son 3 sprint'in ortalama hızı × (kapasite / tam kapasite)
```

## "Tamamlandı" tanımı

Bir görev ancak aşağıdakilerin hepsi sağlandığında **Tamamlandı** sütununa taşınır:

- Kod incelendi ve `main`'e birleşti.
- Otomatik testler yazıldı ve CI yeşil.
- Staging ortamında ürün sahibine gösterildi.
- Gerekiyorsa dokümantasyon güncellendi.
- İzleme panosunda yeni bir hata ya da uyarı oluşmadı.

> [!UYARI]
> "Kod bitti ama test edilmedi" durumundaki işler **Devam Ediyor** sütununda kalır. Yarım işi tamamlandı saymak hızı yapay olarak şişirir.

## Retrospektif formatı

Her retrospektifte üç soru sorulur ve en fazla iki aksiyon maddesi seçilir:

1. Neler iyi gitti?
2. Neler bizi yavaşlattı?
3. Bir sonraki sprint'te neyi farklı deneyeceğiz?

Aksiyon maddeleri DevHub'da bir sahibe atanmış görev olarak açılır; aksi hâlde unutulur.
