---
title: Güvenlik Kontrol Listesi
category: kalite
order: 3
summary: Her pull request'te kontrol edilen güvenlik maddeleri, sır yönetimi ve OWASP Top 10'a karşı önlemler.
author: Ali Yılmaz
updated: 2026-09-03
tags: güvenlik, owasp, yetki
---

Güvenlik bir ekibin değil herkesin işidir. Aşağıdaki liste her PR incelemesinde gözden geçirilir.

## PR kontrol listesi

- Yeni uç noktada yetki kontrolü var mı? (`requireAdmin` veya `requireSelfOrAdmin`)
- Kullanıcı girdisi uzunluk ve biçim açısından doğrulanıyor mu?
- Hata mesajı iç ayrıntı (SQL, istisna metni) sızdırıyor mu?
- Loglara şifre, token veya kişisel veri yazılıyor mu?
- Yeni bağımlılık eklendiyse lisansı ve bilinen açıkları kontrol edildi mi?

## Yetkilendirme

Her uç nokta varsayılan olarak kimlik doğrulama ister. Yetki kontrolü controller'ın ilk satırında yapılır:

```java
@PutMapping("/{id}")
public ResponseEntity<TaskDto> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
    Task task = findTask(id);
    currentUser.requireSelfOrAdmin(task.getUser().getId(), "Yalnızca kendi görevlerinizi yönetebilirsiniz.");
    // ...
}
```

> [!UYARI]
> Arayüzde bir butonu gizlemek yetki kontrolü değildir. Kural her zaman sunucuda uygulanır; arayüz yalnızca kullanıcıya yapamayacağı şeyi göstermez.

## Sır yönetimi

| Yapılır | Yapılmaz |
| --- | --- |
| Sırları ortam değişkeniyle vermek | Sırları koda veya `application.properties`'e yazmak |
| Geliştirmede sahte değerler kullanmak | Üretim şifresini yerel ortamda kullanmak |
| Sızan bir anahtarı hemen döndürmek | Commit'i silip sorunun geçtiğini varsaymak |

## OWASP Top 10 karşısında

| Risk | Önlemimiz |
| --- | --- |
| Erişim kontrolü hataları | Her uç noktada sunucu tarafı yetki kontrolü |
| Enjeksiyon | JPA ve parametreli sorgular; elle birleştirilmiş SQL yok |
| Kimlik doğrulama hataları | BCrypt ile şifre özeti, güçlü şifre kuralı, pasif hesap anında kilitlenir |
| Güvenlik yanlış yapılandırması | CORS yalnızca bilinen kaynaklara açık |
| Hassas veri ifşası | Hata mesajlarında iç ayrıntı yok |

> [!ONEMLI]
> Bir güvenlik açığı fark ederseniz herkese açık kanala yazmayın; doğrudan takım liderine bildirin.
