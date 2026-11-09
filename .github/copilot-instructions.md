# Instrucciones para Copilot — XLR8

XLR8 es una app tipo Strava para motos y carros (proyecto educativo de portafolio).
Registra rutas GPS, calcula estadísticas y mantiene un top 3 de tiempos por
circuito, segmentado por tipo de vehículo y rango de potencia.

## Identificadores del proyecto

- Nombre visible: `XLR8`
- Slug: `xlr8`
- Paquetes: `@xlr8/mobile` y `@xlr8/api`
- Bundle ID / package Android: `com.xlr8.app`
- Base de datos: `xlr8_db`

## Stack

- `/mobile`: React Native + Expo + TypeScript, Expo Router, TanStack Query, Zustand.
- `/api`: NestJS + TypeScript + Prisma + PostgreSQL con PostGIS.
- `/docs`: documentación del proyecto.
- Docker Compose para levantar la base de datos localmente.

## Convenciones generales

- TypeScript estricto en todo el monorepo. Nunca usar `any`; preferir tipos
  explícitos, genéricos o `unknown` con narrowing.
- Código y nombres (variables, funciones, clases, archivos) en **inglés**.
- Comentarios y documentación (README, docs) en **español**.
- Commits siguiendo **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`, etc.).
- Nunca hardcodear secretos o credenciales. Usar variables de entorno y mantener
  un archivo `.env.example` actualizado junto a cada `.env` real (ignorado por git).

## Backend (`/api`)

- Cada módulo de NestJS debe incluir: `controller`, `service`, DTOs validados
  con `class-validator`/`class-transformer`, y tests unitarios (`*.spec.ts`).
- Usar Prisma como ORM contra PostgreSQL + PostGIS.
- Validar siempre los datos de entrada en los DTOs, nunca confiar en el payload crudo.
- Separar lógica de negocio del controller; los controllers solo orquestan.

## Mobile (`/mobile`)

- Componentes funcionales (sin clases).
- Extraer lógica de estado/efectos a **hooks** personalizados.
- Organizar el código por **feature** (carpeta por feature, no por tipo de archivo).
- Usar TanStack Query para estado de servidor y Zustand para estado de cliente/UI.
- Navegación con Expo Router.

## Seguridad

- Nunca commitear archivos `.env`, claves, tokens ni credenciales.
- Validar y sanear toda entrada proveniente del cliente en el backend.
- Seguir buenas prácticas de OWASP Top 10 en el diseño de endpoints y manejo de datos.
