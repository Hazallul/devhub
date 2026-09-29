---
title: Sistem Mimarisi
category: mimari
order: 1
summary: DevHub'ı oluşturan servisler, katmanlar, kimlik doğrulama akışı ve servisler arası iletişim.
author: Ayşe Kaya
updated: 2026-09-20
tags: mimari, backend, frontend
---

DevHub; bir React tek sayfa uygulaması, bir Spring Boot REST API ve bir MySQL veritabanından oluşur. Tüm parçalar Docker konteynerlerinde çalışır.

## Genel bakış

```text
 Tarayıcı ──HTTPS──▶ Web Arayüzü (React + Vite)
                         │  JSON / JWT
                         ▼
                    Backend API (Spring Boot 4, Java 21)
                         │  JDBC
                         ▼
                    MySQL 8 (Flyway ile yönetilen şema)
```

| Servis | Teknoloji | Port |
| --- | --- | --- |
| Web arayüzü | React 19, TypeScript, Tailwind, React Query | 5173 |
| Backend API | Spring Boot 4, Spring Security, JPA | 8081 |
| Veritabanı | MySQL 8.0 | 3306 |

## Backend katmanları

Her istek aynı katmanlardan geçer ve katmanlar yalnızca bir alttakini çağırır:

1. **Controller:** İsteği alır, gövdeyi doğrular, yetkiyi kontrol eder.
2. **Service:** İş kuralları. Birden fazla controller'ın ihtiyaç duyduğu mantık burada yaşar.
3. **Repository:** Spring Data JPA arayüzleri; SQL yazılmaz, gerekirse `@Query` kullanılır.
4. **Entity:** Veritabanı tablolarının karşılığı.

> [!IPUCU]
> Aynı kuralı ikinci kez yazmak üzereyseniz durun: büyük ihtimalle bir servis zaten var. İzin günü hesabı için `WorkdayService`, bildirimler için `NotificationService`, loglar için `ActionLogService` kullanılır.

## Kimlik doğrulama

Kimlik doğrulama durumsuzdur (stateless). Giriş başarılı olunca istemciye bir JWT verilir ve sonraki her istekte başlıkta gönderilir:

```http
GET /api/tasks HTTP/1.1
Host: localhost:8081
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

Filtre zinciri token'ı doğrular, kullanıcının aktif olduğunu kontrol eder ve güvenlik bağlamına yerleştirir. Pasifleştirilmiş kullanıcının eski token'ı da anında geçersiz olur.

## Zamanlanmış işler

| İş | Zaman | Ne yapar |
| --- | --- | --- |
| İzin durumu | Her gün 00:05 | İzni başlayanları İzinli, bitenleri Aktif yapar |
| Görev hatırlatma | Her gün 08:00 | Son günü bugün/yarın olan görevler için bildirim |
| Sistem örnekleme | 10 saniyede bir | Servislerin sağlık ve kaynak verisini toplar |
