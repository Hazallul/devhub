# Geliştirme (varsayılan compose): Vite geliştirme sunucusu, kod değişince sayfa kendini yeniler.
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Üretim (docker-compose.prod.yml): uygulama bir kez derlenir, nginx hazır dosyaları sunar; sayfalar anında açılır.
FROM dev AS build
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
