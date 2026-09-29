---
title: Test Stratejisi
category: kalite
order: 1
summary: Test piramidi, birim ve entegrasyon testleri, test isimlendirme ve CI'da testlerin çalışması.
author: Zeynep Öztürk
updated: 2026-09-12
tags: test, junit, kalite
---

Testler hızlı geri bildirim için vardır. Bir değişikliğin bir şeyi bozup bozmadığını dakikalar içinde, üretimden önce öğrenmek isteriz.

## Test piramidi

| Katman | Oran | Ne test eder | Araç |
| --- | --- | --- | --- |
| Birim | ~%70 | Tek bir sınıfın iş kuralı | JUnit 5, Mockito |
| Entegrasyon | ~%25 | Controller → veritabanı akışı | Spring Boot Test, Testcontainers |
| Uçtan uca | ~%5 | Kritik kullanıcı akışları | Playwright |

## Neyi test ederiz?

İş kuralı içeren her servis metodu birim testine sahip olmalıdır. Özellikle:

- İzin günü hesabı: hafta sonu, resmî tatil, yıl dönümü
- Yetki kuralları: çalışan başkasının görevini değiştirememeli
- Durum geçişleri: izinli kişi kendi durumunu değiştirememeli

## Örnek birim testi

```java
@Test
void haftaSonuVeResmiTatilIsGunuSayilmaz() {
    // 28 Ekim Çarşamba – 2 Kasım Pazartesi, 29 Ekim resmî tatil
    holidays.add(LocalDate.of(2026, 10, 29));

    int days = workdayService.countWorkdays(
        LocalDate.of(2026, 10, 28), LocalDate.of(2026, 11, 2));

    assertThat(days).isEqualTo(3); // Çar, Cum, Pzt
}
```

> [!IPUCU]
> Test adları Türkçe ve cümle gibi yazılır; test başarısız olduğunda rapordaki ad, neyin bozulduğunu tek başına anlatmalıdır.

## Entegrasyon testleri

Entegrasyon testleri gerçek bir MySQL ile çalışır. Testcontainers her test sınıfı için geçici bir veritabanı başlatır ve migration'ları uygular:

```java
@SpringBootTest
@Testcontainers
class LeaveControllerIT {
    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");
}
```

> [!UYARI]
> Testler geliştiricinin yerel veritabanına bağlanmamalıdır. Yerel veriyi değiştiren bir test, bir sonraki sunumdan önce fark edilmeyen hatalara yol açar.

## CI'da testler

Her pull request'te sırasıyla şunlar çalışır ve biri başarısız olursa PR birleştirilemez:

1. `./gradlew test`: backend birim ve entegrasyon testleri
2. `npm run build`: TypeScript kontrolü ve üretim derlemesi
3. `npm run lint`: oxlint kuralları
