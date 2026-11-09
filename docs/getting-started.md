# Primeros pasos — XLR8

> Proyecto educativo de portafolio. Respeta siempre las normas de tránsito.

Esta guía describe cómo levantar el entorno de desarrollo. **No se instala
ninguna dependencia automáticamente**: cada comando debe ejecutarlo la
persona desarrolladora.

## 1. Variables de entorno

```bash
cp .env.example .env
cp api/.env.example api/.env
```

Ajusta los valores si lo necesitas (usuario, contraseña, puertos).

## 2. Base de datos (Docker Compose)

```bash
docker compose up -d
```

Esto levanta Postgres con PostGIS y crea la base `xlr8_db`.

## 3. Backend (`/api`)

```bash
cd api
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

## 4. Mobile (`/mobile`)

```bash
cd mobile
npm install
npx expo start
```

## Notas

- El bundle id / package de Android es `com.xlr8.app`.
- Los paquetes del monorepo se llaman `@xlr8/api` y `@xlr8/mobile`.
