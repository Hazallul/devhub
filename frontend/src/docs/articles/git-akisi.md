---
title: Git Akışı ve Branch Stratejisi
category: surecler
order: 1
summary: Trunk-based geliştirme, branch isimlendirme, commit mesajı formatı ve pull request kuralları.
author: Ali Yılmaz
updated: 2026-09-15
tags: git, branch, commit
---

Trunk-based geliştirme kullanıyoruz: `main` her zaman yayınlanabilir durumdadır ve kısa ömürlü branch'ler en geç birkaç gün içinde ona birleşir.

## Branch isimlendirme

Branch adı, türü ve görev numarasını içerir:

```text
<tür>/<görev-no>-<kısa-açıklama>

feature/DH-142-izin-bakiyesi
fix/DH-187-takvim-hafta-sonu
chore/DH-190-gradle-guncelleme
```

| Tür | Ne zaman |
| --- | --- |
| `feature` | Kullanıcının göreceği yeni bir yetenek |
| `fix` | Hata düzeltmesi |
| `refactor` | Davranışı değiştirmeyen kod düzenlemesi |
| `chore` | Bağımlılık, yapılandırma, araç işleri |
| `docs` | Yalnızca dokümantasyon |

## Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org) formatını kullanıyoruz. Sürüm notları bu mesajlardan otomatik üretildiği için format önemlidir.

```text
feat(izin): yıllık izin bakiyesi hesaplamasına resmi tatilleri ekle

Hafta sonları ve holidays tablosundaki günler iş günü sayılmıyor.
Bakiye aşıldığında talep oluşturma 400 döner.

Refs: DH-142
```

- Başlık satırı en fazla 72 karakterdir ve emir kipiyle yazılır ("ekle", "düzelt").
- Gövde **neden** yapıldığını anlatır; **ne** yapıldığı zaten kodda görünür.
- Geriye dönük uyumsuz değişikliklerde gövdeye `BREAKING CHANGE:` satırı eklenir.

## Pull request kuralları

1. PR, tek bir mantıksal değişiklik içerir. 400 satırı geçiyorsa bölmeyi düşünün.
2. Açıklamada **ne**, **neden** ve **nasıl test edildi** başlıkları doldurulur.
3. En az bir onay ve yeşil CI olmadan birleştirilmez.
4. Birleştirme yöntemi her zaman **squash**'tır; `main` geçmişi PR başına tek commit içerir.

> [!IPUCU]
> Uzun süren bir iş için branch'i günlerce açık tutmak yerine özelliği bir özellik bayrağının (feature flag) arkasına saklayıp küçük parçalar hâlinde birleştirin.

## Çakışmaları çözme

`main` ile güncel kalmak için merge yerine rebase tercih edilir:

```bash
git fetch origin
git rebase origin/main
# çakışmaları çözün, ardından
git rebase --continue
git push --force-with-lease
```

> [!UYARI]
> `--force` yerine her zaman `--force-with-lease` kullanın. Böylece başkasının sizin branch'inize gönderdiği commit'leri yanlışlıkla silmezsiniz.
