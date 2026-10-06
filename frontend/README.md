# DevHub arayüzü

React 19 + Vite + TypeScript + Tailwind CSS. Kurulum, kullanım ve ekran görüntüleri için depo kökündeki [README](../README.md) dosyasına bakın ([English](../README.en.md)).

- Geliştirme modu: Vite geliştirme sunucusu (`Dockerfile` içindeki `dev` aşaması), kod değişince sayfa kendini yeniler.
- Üretim modu: uygulama derlenir ve nginx ile sunulur (`prod` aşaması, `nginx.conf`); `devhub/docker-compose.prod.yml` ile çalışır.
