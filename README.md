# XLR8

XLR8 es una aplicación educativa de seguimiento de rutas para motos y carros,
inspirada en las aplicaciones de actividad deportiva. Registra recorridos GPS,
calcula estadísticas, detecta intentos en circuitos y compara los mejores
tiempos por categoría de vehículo y potencia.

> **Proyecto educativo. Respeta siempre las normas de tránsito y los límites de velocidad.**

## Capturas

<!-- Captura pendiente: pantalla de inicio con el historial de actividades. -->
<!-- Captura pendiente: grabación GPS con el mapa y las estadísticas en vivo. -->
<!-- Captura pendiente: detalle de circuito y podio del leaderboard. -->

## Stack

| Área | Tecnologías |
| --- | --- |
| Aplicación móvil | React Native, Expo, TypeScript, Expo Router |
| Estado y datos | TanStack Query, Zustand, SQLite |
| Mapas y ubicación | MapLibre, OpenFreeMap, Expo Location y Task Manager |
| API | NestJS, TypeScript, Prisma |
| Persistencia geoespacial | PostgreSQL, PostGIS |
| Calidad | Jest, ESLint, TypeScript, GitHub Actions |

## Arquitectura

```text
mobile/
  app/                 Rutas y navegación con Expo Router
  src/features/        auth, vehicles, recording, activities y circuits
  src/components/      componentes compartidos y mapas de rutas
  SQLite               puntos GPS locales y cola de sincronización

api/
  src/                 módulos NestJS, DTOs y lógica de negocio
  prisma/              esquema, migraciones y seed idempotente
  test/                pruebas unitarias y flujo end-to-end

PostgreSQL + PostGIS   geometrías de rutas y circuitos
```

La app móvil organiza el código por funcionalidad. TanStack Query administra
los datos remotos y Zustand el estado de grabación. La ruta se almacena punto
a punto en SQLite antes de enviarse a la API, por lo que una interrupción de
red no elimina una actividad. La API valida los DTOs, separa controladores y
servicios y usa PostGIS para persistir geometrías y detectar cruces.

La grabación puede iniciarse manualmente o con detección automática optativa.
Esta última exige movimiento sostenido (al menos 12 km/h, tres muestras durante
10 segundos y 30 m acumulados) y finaliza tras 1, 3 o 5 minutos sin movimiento.
Los puntos GPS se filtran por precisión, orden temporal y saltos implausibles;
la altitud y precisión disponibles se guardan junto con las estadísticas de
tiempo en movimiento y detenido.
El historial permite filtrar recorridos por fecha, distancia y vehículo, y
resume la actividad por semana, mes y año. Los logros son personales y se basan
en constancia, distancia, recorridos y exploración aproximada de rutas. El
tiempo de conducción responsable solo se cuenta cuando el usuario lo declara
al finalizar; no se infiere seguridad a partir de la velocidad GPS.

## Modelo de datos

- **User**: cuenta, identidad y relaciones con vehículos, actividades e intentos.
- **Vehicle**: tipo (moto o carro), marca, modelo, año, potencia, cilindraje,
  motor, peso y consumo opcionales, además de su categoría de potencia.
- **Activity**: vehículo, fechas, distancia, duración total y efectiva,
  velocidades, desnivel, precisión GPS y consumo estimado cuando se conoce.
- **TrackPoint**: posición, velocidad, altitud, precisión, instante y secuencia
  de cada punto GPS.
- **Circuit**: nombre, longitud, ruta de referencia, líneas de salida y meta, y
  aprobación explícita para rankings en instalaciones cerradas autorizadas.
- **CircuitAttempt**: tiempo, validez, motivo y categoría de vehículo copiada al
  momento del intento.
- **RefreshToken**: credenciales de renovación almacenadas con su hash.

## Requisitos

- Node.js LTS y npm.
- Docker y Docker Compose para iniciar PostgreSQL con PostGIS.
- Android Studio para compilar Android; Xcode en macOS para compilar iOS.
- Un archivo `.env` local basado en los `.env.example` de cada paquete.

## Iniciar la API

```powershell
docker compose up -d postgres
cd api
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

La API queda disponible en `http://localhost:3000`. Para poblar los circuitos
y datos de demostración:

```powershell
npx tsx prisma/seed.ts
```

El seed es idempotente. La configuración de la base de datos se define en
`api/.env` mediante `DATABASE_URL`; consulta [api/.env.example](api/.env.example).
En Supabase, activa PostGIS antes de ejecutar las migraciones. La API contempla
la extensión en los esquemas `public` y `extensions`, que es donde Supabase suele
instalarla.

## Iniciar la app móvil

Configura `mobile/.env` a partir de
[mobile/.env.example](mobile/.env.example). Para Android Emulator suele usarse
`http://10.0.2.2:3000`; para iOS Simulator, `http://localhost:3000`.

```powershell
cd mobile
npm install
npx expo prebuild
npx expo run:android
```

En macOS, usa `npx expo run:ios`. También se puede generar un development
build con EAS:

```powershell
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Para instalar una APK de prueba en un teléfono Android, consulta la guía de
[generación e instalación de APK](mobile/README.md#apk-de-prueba-para-android).
La app requiere que la API esté accesible desde el teléfono a través de la red
local.

La grabación en segundo plano, SQLite y MapLibre requieren un development
build, no Expo Go. El mapa utiliza el estilo público sin llave
`https://tiles.openfreemap.org/styles/liberty`.

## Decisiones técnicas

- **Cruces de circuito:** el detector evalúa la geometría de los segmentos GPS
  contra las líneas de salida y meta. Interpola el instante exacto del cruce
  entre los timestamps de los puntos que lo encierran, lo que produce tiempos
  comparables incluso cuando la frecuencia GPS es baja.
- **Calidad y validez:** los intentos se invalidan ante velocidades superiores
  a 350 km/h, distancias incompatibles con la longitud del circuito, huecos GPS
  mayores de 30 segundos y duraciones implausibles. Los intentos inválidos se
  conservan con el motivo para que el usuario pueda consultarlos.
- **Rankings:** el leaderboard muestra los tres mejores tiempos válidos por
  circuito, tipo de vehículo y rango de potencia. Se conserva solo el mejor
  intento de cada usuario para determinar su posición en cada categoría. La
  clasificación y la detección de intentos competitivos están deshabilitadas
  por defecto y solo se habilitan para circuitos cerrados con autorización
  verificada; los tramos viales incluidos en los datos de demostración no
  generan tiempos ni rankings.
- **Tolerancia a desconexiones:** los puntos se escriben primero en SQLite y
  las actividades finalizadas se mantienen en una cola local hasta sincronizar.
- **Ubicación responsable:** se solicita permiso de ubicación en primer plano
  para mostrar circuitos cercanos. La ubicación en segundo plano se solicita
  únicamente cuando el usuario inicia una grabación o activa la detección
  automática; esta última usa precisión y frecuencia reducidas para limitar el
  consumo de batería.

## Validación y CI

La integración continua ejecuta lint, comprobación de tipos y pruebas unitarias
para API y móvil en cada push. Las pruebas e2e de la API se ejecutan contra
PostgreSQL/PostGIS.

```powershell
# En api/
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e

# En mobile/
npm run lint
npx tsc --noEmit
npm test
npx expo export
```
