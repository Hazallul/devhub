---
title: Kod İnceleme Rehberi
category: surecler
order: 2
summary: İyi bir pull request nasıl hazırlanır, inceleyen neye bakar ve geri bildirim nasıl verilir.
author: Ayşe Kaya
updated: 2026-08-28
tags: code review, pull request
---

Kod incelemesinin amacı hata bulmaktan çok bilgiyi yaymaktır. İncelenen her PR, en az iki kişinin o kodu anladığı anlamına gelir.

## Yazar olarak

- PR'ı küçük tutun. İnceleme kalitesi 400 satırdan sonra belirgin biçimde düşer.
- Açıklamaya ekran görüntüsü veya kısa bir video ekleyin; özellikle arayüz değişikliklerinde.
- İnceleme istemeden önce kendi diff'inizi baştan sona bir kez okuyun.
- Tartışmalı bir tasarım kararınız varsa kodun yanına yorum olarak **neden** o yolu seçtiğinizi yazın.

## İnceleyen olarak

İncelemeyi aşağıdaki sırayla yapın; en pahalı hatalar en üsttedir:

1. **Doğruluk:** Kod söylediği işi yapıyor mu? Sınır durumları (boş liste, null, hafta sonu, saat dilimi) düşünülmüş mü?
2. **Güvenlik:** Yetki kontrolü var mı? Kullanıcı girdisi doğrulanıyor mu?
3. **Tasarım:** Değişiklik doğru katmanda mı? Var olan bir servis yeniden mi yazılmış?
4. **Test:** Davranışı koruyan bir test eklenmiş mi?
5. **Okunabilirlik:** İsimler anlaşılır mı? Gereksiz karmaşıklık var mı?

> [!NOT]
> Biçimlendirme ve stil konuları incelemede tartışılmaz; bunlar lint ve formatlayıcının işidir.

## Geri bildirim dili

Yorumun önüne etiket koyarak niyetinizi netleştirin:

| Etiket | Anlamı |
| --- | --- |
| `engel:` | Birleştirmeden önce düzeltilmeli |
| `öneri:` | Daha iyi olabilir, karar yazarın |
| `soru:` | Anlamadım, açıklar mısın? |
| `ufak:` | Önemsiz, istersen düzelt |
| `övgü:` | Bunu beğendim |

Kişiyi değil kodu eleştirin. "Burada hata yapmışsın" yerine "Bu satır liste boşken hata veriyor gibi" deyin.

## Süreler

- İnceleme isteğine **bir iş günü** içinde ilk yanıt verilir.
- Yazar, geri bildirimlere en geç bir iş günü içinde döner.
- Üç turdan uzun süren tartışmalar yazılı yazışma yerine 15 dakikalık bir görüşmeyle çözülür.
