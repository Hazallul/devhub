---
title: Veritabanı ve Migration Kuralları
category: mimari
order: 3
summary: Flyway migration dosyaları, isimlendirme kuralları, indeksler ve güvenli şema değişikliği.
author: Merve Can
updated: 2026-08-22
tags: mysql, flyway, migration
---

Şema yalnızca Flyway migration'larıyla değişir. Hibernate şemayı oluşturmaz, yalnızca doğrular (`ddl-auto=validate`). Entity'de yapılan her değişikliğin bir migration'ı olmalıdır; aksi hâlde uygulama açılmaz.

## Migration dosyaları

```text
src/main/resources/db/migration/
  V1__init.sql
  V2__add_projects_and_logs.sql
  ...
  V10__task_details.sql
```

- Dosya adı `V<numara>__<açıklama>.sql` biçimindedir; açıklama küçük harf ve alt çizgiyle yazılır.
- Birleşmiş bir migration dosyası **asla değiştirilmez**. Hata varsa yeni bir migration yazılır.
- Her migration tek bir amaca hizmet eder ve dosyanın başında neden yazıldığı açıklanır.

> [!UYARI]
> Çalışmış bir migration'ı düzenlerseniz Flyway checksum hatası verir ve uygulama hiçbir ortamda açılmaz.

## İsimlendirme

| Öğe | Kural | Örnek |
| --- | --- | --- |
| Tablo | çoğul, snake_case | `leave_requests` |
| Kolon | snake_case | `created_at` |
| Yabancı anahtar | `fk_<tablo>_<alan>` | `fk_task_project` |
| İndeks | `idx_<tablo>_<alanlar>` | `idx_task_activity_task` |
| Benzersiz kısıt | `uq_<tablo>_<alan>` | `uq_notification_ref` |

## Örnek migration

```sql
-- Görev yorumları ve geçmişi tek tabloda tutulur.
CREATE TABLE task_activity (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    kind ENUM('EVENT', 'COMMENT') NOT NULL,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_activity_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    INDEX idx_task_activity_task (task_id, created_at)
);
```

## Performans

- Sık filtrelenen her kolon için indeks düşünülür; `EXPLAIN` çıktısı PR açıklamasına eklenir.
- Listelerde N+1 sorgusundan kaçınmak için ilişkiler `@EntityGraph` ile tek sorguda çekilir.
- 100.000 satırı geçebilecek tablolara yapılan `ALTER` işlemleri önce staging'de süre ölçülerek denenir.

> [!IPUCU]
> Geliştirme sırasında `spring.jpa.show-sql=true` ile Hibernate'in ürettiği sorguları görebilirsiniz; bir liste ekranı onlarca sorgu üretiyorsa N+1 vardır.
