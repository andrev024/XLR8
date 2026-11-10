# @xlr8/mobile

App móvil de XLR8 (estilo Strava para motos y carros), construida con Expo +
React Native + TypeScript y Expo Router.

## Requisitos

- Node.js LTS y npm.
- La API de XLR8 (`/api`) corriendo localmente (ver README de ese paquete).
- Expo Go instalado en tu dispositivo físico, o un emulador Android /
  simulador iOS configurado, si no vas a usar un dispositivo físico.

## Instalación

```bash
npm install
```

> Este proyecto usa `legacy-peer-deps=true` (ver `.npmrc`) por un desfase de
> peer dependencies entre React y las herramientas internas de Expo SDK 57.

## Variables de entorno

Copia `.env.example` a `.env`. La configuración predeterminada usa la API
desplegada en Render; para desarrollo local, cambia `EXPO_PUBLIC_API_URL`:

| Entorno de ejecución                     | Valor de `EXPO_PUBLIC_API_URL`          |
| ---------------------------------------- | --------------------------------------- |
| API desplegada en Render | `https://xlr8-bkb5.onrender.com` |
| Web / iOS Simulator      | `http://localhost:3000`          |
| Android Emulator         | `http://10.0.2.2:3000`           |
| Dispositivo físico       | `http://<IP_LAN_DE_TU_MAQUINA>:3000` |

Para el caso de dispositivo físico, el teléfono y tu computadora deben estar
en la misma red Wi-Fi, y debes usar la IP LAN de tu máquina (por ejemplo
`http://192.168.1.50:3000`), ya que `localhost` dentro del dispositivo
apuntaría al propio teléfono y no a tu computadora. Puedes obtener tu IP LAN
con `ipconfig` (Windows) o `ifconfig`/`ip addr` (macOS/Linux).

## Scripts disponibles

```bash
npm start          # inicia el servidor de desarrollo de Expo
npm run android     # inicia en un emulador/dispositivo Android
npm run ios         # inicia en un simulador/dispositivo iOS
npm run web         # inicia la versión web
npm run lint        # ESLint
npm run format      # Prettier (escribe cambios)
npm run format:check
npm run typecheck   # tsc --noEmit
npm test            # Jest
```

## APK de prueba para Android

La grabación en segundo plano, SQLite nativo y MapLibre requieren una build
nativa; no funcionan en Expo Go. Para probar en un Android físico, configura la
URL de la API con la IP LAN de la computadora y compila una APK de depuración:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://<IP_LAN_DE_TU_PC>:3000"
Set-Location android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

La APK se genera en
`android/app/build/outputs/apk/release/app-release.apk`. El comando genera una
APK autocontenida para Android ARM64, firmada con la clave de depuración del
proyecto; sirve para pruebas, no para publicar. Para instalarla por USB, activa
la depuración USB en el teléfono, conéctalo y ejecuta desde `android/`:

```powershell
adb install -r .\app\build\outputs\apk\release\app-release.apk
```

La computadora y el teléfono deben estar en la misma red; la API debe estar en
ejecución y el firewall debe permitir conexiones entrantes al puerto 3000. Esta
APK usa la firma de depuración del proyecto y es para pruebas, no para publicar.
Android muestra una notificación persistente mientras graba. El mapa usa el
estilo sin llave de OpenFreeMap:
`https://tiles.openfreemap.org/styles/liberty`.

## Arquitectura

- `app/`: rutas de Expo Router, organizadas en grupos `(auth)` y `(app)`.
- `src/features/`: lógica por feature (auth, vehicles, recording, activities,
  circuits) — tipos, esquemas de
  validación (zod), llamadas a la API, hooks de TanStack Query y componentes
  específicos de la feature.
- Las rutas GPS se escriben en SQLite en el dispositivo y se sincronizan con la
  API cuando hay conexión.
- `src/components/`: componentes compartidos de UI.
- `src/lib/`: utilidades transversales (cliente HTTP con refresh automático
  de tokens, almacenamiento seguro, query client, manejo de errores de API).
- `src/theme/`: paleta de colores del tema oscuro.

### Catálogo de vehículos

Los formularios de alta y edición consultan `GET /catalog/brands`,
`GET /catalog/models` y `GET /catalog/versions` para ofrecer selectores en
cascada con búsqueda. La versión seleccionada completa el año disponible y la
potencia aproximada; el hp se puede editar y la categoría se actualiza al
instante. La opción **Otro / no está en la lista** permite registrar modelos y
versiones que todavía no estén catalogados. El catálogo no limita los datos que
acepta la API.

El catálogo también incluye modelos sin ficha técnica; para esos vehículos, el
año y la potencia se ingresan manualmente. La foto de perfil es opcional, se
guarda únicamente en el almacenamiento privado del dispositivo y no se envía a
la API.

En Android, iniciar una ruta solicita el permiso de ubicación en primer plano y
usa el servicio de ubicación persistente de la notificación para continuar la
grabación al cambiar de aplicación. En iOS también se solicita permiso de
ubicación en segundo plano.
