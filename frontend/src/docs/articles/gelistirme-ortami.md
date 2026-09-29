---
title: Geliştirme Ortamı Kurulumu
category: baslarken
order: 2
summary: Projeyi yerel makinenizde Docker ile ayağa kaldırmak, ortam değişkenlerini ayarlamak ve sık karşılaşılan sorunları çözmek.
author: Mustafa Koç
updated: 2026-09-10
tags: docker, kurulum, ortam
---

Tüm servisler Docker içinde çalışır. Makinenizde Node veya MySQL kurmanıza gerek yoktur; yalnızca JDK 21 (backend'i derlemek için) ve Docker Desktop yeterlidir.

## Gereksinimler

| Araç | Sürüm | Not |
| --- | --- | --- |
| Docker Desktop | 4.30+ | WSL 2 arka ucu önerilir |
| JDK | 21 | Temurin dağıtımı |
| Git | 2.40+ | `core.autocrlf=input` ayarlı olmalı |
| IDE | IntelliJ IDEA / VS Code | Lombok eklentisi gerekli |

## Projeyi ayağa kaldırma

Backend imajı hazır jar dosyasını kopyaladığı için önce jar derlenir, sonra tüm servisler başlatılır:

```bash
git clone https://git.example.com/devhub/devhub.git
cd devhub/devhub
./gradlew bootJar -x test
docker compose up -d --build
```

Birkaç saniye sonra servisler şu adreslerde hazırdır:

- Web arayüzü: `http://localhost:5173`
- API: `http://localhost:8081`
- Veritabanı: `localhost:3306` (kullanıcı `root`)

> [!UYARI]
> Windows'ta proje klasörünü WSL dosya sistemi yerine `C:\` altında tutuyorsanız, Vite dosya değişikliklerini ancak polling ile görebilir. Bu ayar `vite.config.ts` içinde açıktır; kapatmayın.

## Ortam değişkenleri

Varsayılan değerler geliştirme için yeterlidir. Farklı bir değer gerekiyorsa `devhub/.env.example` dosyasını `.env` olarak kopyalayın:

```properties
JWT_SECRET=en-az-32-karakterlik-rastgele-bir-deger
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/devhub
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=root
```

> [!ONEMLI]
> `.env` dosyası asla depoya eklenmez. Gerçek ortamların sırları kasada (vault) tutulur ve dağıtım sırasında enjekte edilir.

## Sık karşılaşılan sorunlar

### Backend "Connection refused" hatasıyla kapanıyor

MySQL konteyneri henüz hazır değildir. `docker compose ps` ile veritabanının durumunun `healthy` olmasını bekleyin, ardından backend'i yeniden başlatın:

```bash
docker compose restart backend
```

### Yaptığım değişiklik arayüzde görünmüyor

Frontend değişiklikleri anında yansır. Backend değişiklikleri için jar'ı yeniden derleyip konteyneri yeniden oluşturmanız gerekir:

```bash
./gradlew bootJar -x test && docker compose up -d --build backend
```
