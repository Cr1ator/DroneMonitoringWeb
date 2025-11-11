# Frontend Dockerfile для React + Vite (Railway)
# Размещение: Client/Dockerfile

# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --legacy-peer-deps

# Копируем исходники
COPY . .

# Build переменные окружения (передаются при сборке)
ARG VITE_API_URL
ARG VITE_HUB_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_HUB_URL=$VITE_HUB_URL

# Собираем приложение
RUN npm run build

# Stage 2: Nginx сервер
FROM nginx:alpine AS final

# Устанавливаем envsubst для подстановки переменных
RUN apk add --no-cache gettext

WORKDIR /usr/share/nginx/html

# Удаляем дефолтные файлы nginx
RUN rm -rf ./*

# Копируем собранное приложение из build stage
COPY --from=build /app/dist .

# Копируем nginx конфигурацию как template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Устанавливаем дефолтный PORT если не задан
ENV PORT=3000

# Nginx автоматически применит envsubst к template при запуске
EXPOSE $PORT

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
