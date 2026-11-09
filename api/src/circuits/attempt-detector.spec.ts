import path from 'node:path';
import {
  detectCircuitAttempts,
  type AttemptTrackPoint,
  type GateLine,
} from './attempt-detector';
import { loadRouteFixtureData } from '../../test/fixtures/load-route-fixture';

const METERS_PER_DEGREE_LAT = 111_320;

function metersToLatDelta(meters: number): number {
  return meters / METERS_PER_DEGREE_LAT;
}

/** Construye un punto a partir de una latitud base + un desplazamiento en metros. */
function point(
  baseLat: number,
  offsetMeters: number,
  lng: number,
  recordedAt: Date,
  speedMs?: number,
): AttemptTrackPoint {
  return {
    lat: baseLat + metersToLatDelta(offsetMeters),
    lng,
    recordedAt,
    speedMs,
  };
}

const TEST_LENGTH_METERS = 2226;
const TEST_LNG = -74.09;
const TEST_START_LAT = 1.0;
const TEST_FINISH_LAT = TEST_START_LAT + metersToLatDelta(TEST_LENGTH_METERS);
const GATE_LNG_OFFSET = 0.0005;

const startLine: GateLine = [
  { lat: TEST_START_LAT, lng: TEST_LNG - GATE_LNG_OFFSET },
  { lat: TEST_START_LAT, lng: TEST_LNG + GATE_LNG_OFFSET },
];
const finishLine: GateLine = [
  { lat: TEST_FINISH_LAT, lng: TEST_LNG - GATE_LNG_OFFSET },
  { lat: TEST_FINISH_LAT, lng: TEST_LNG + GATE_LNG_OFFSET },
];

const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');

describe('detectCircuitAttempts', () => {
  it.each([
    'circuit-autopista-norte-route.geojson',
    'circuit-avenida-boyaca-route.geojson',
    'circuit-autopista-sur-route.geojson',
  ])('detecta un intento válido en la ruta real %s', (fixture) => {
    const data = loadRouteFixtureData(
      path.join(__dirname, '../../test/fixtures', fixture),
    );
    const attempts = detectCircuitAttempts(
      data.points,
      data.startLine,
      data.finishLine,
      data.lengthMeters,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].isValid).toBe(true);
    expect(attempts[0].invalidReason).toBeNull();
    expect(attempts[0].durationMs).toBeGreaterThan(0);
    expect(attempts[0].finishedAt.getTime()).toBeGreaterThan(
      attempts[0].startedAt.getTime(),
    );
  });

  it('no detecta ningún intento si la ruta nunca cruza la línea de meta', () => {
    // Cruza la salida pero se detiene a mitad de camino, sin llegar a la meta.
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        20,
      ),
      point(
        TEST_START_LAT,
        800,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 60_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(0);
  });

  it('no detecta ningún intento si las líneas se cruzan en orden inverso', () => {
    // Recorrido físico de meta hacia salida: se cruza primero la meta y luego la salida.
    const points: AttemptTrackPoint[] = [
      point(TEST_FINISH_LAT, 200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_FINISH_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        20,
      ),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 140_000),
        20,
      ),
      point(
        TEST_START_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 160_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(0);
  });

  it('marca el intento como inválido cuando hay un salto imposible de GPS', () => {
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        20,
      ),
      // Salto imposible: miles de metros en 1 segundo.
      point(
        TEST_START_LAT,
        50_200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 21_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 140_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].isValid).toBe(false);
    expect(attempts[0].invalidReason).toBe('SPEED_IMPLAUSIBLE');
  });

  it('marca como inválido un reporte de velocidad superior a 350 km/h', () => {
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        100,
      ),
      point(
        TEST_FINISH_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 140_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 160_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].maxSpeedKmh).toBe(360);
    expect(attempts[0].isValid).toBe(false);
    expect(attempts[0].invalidReason).toBe('SPEED_IMPLAUSIBLE');
  });

  it('interpola los timestamps exactos de los cruces de salida y meta', () => {
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -100, TEST_LNG, new Date(BASE_TIME.getTime())),
      point(
        TEST_START_LAT,
        100,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 2_000),
      ),
      point(
        TEST_FINISH_LAT,
        -100,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 120_000),
      ),
      point(
        TEST_FINISH_LAT,
        100,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 122_000),
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].startedAt.getTime()).toBe(BASE_TIME.getTime() + 1_000);
    expect(attempts[0].finishedAt.getTime()).toBe(
      BASE_TIME.getTime() + 121_000,
    );
  });

  it('marca como inválido un intento con huecos GPS superiores a 30 segundos', () => {
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 80_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 100_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].isValid).toBe(false);
    expect(attempts[0].invalidReason).toBe('GPS_GAP');
  });

  it('marca el intento como inválido cuando la duración es menor al mínimo plausible', () => {
    // Recorrido a velocidad constante de 310 km/h (> 300 km/h): la duración real del
    // intento queda matemáticamente por debajo del mínimo plausible para la longitud del circuito.
    const speedMs = 310 / 3.6;
    const offsetsMeters = [
      -200,
      200,
      TEST_LENGTH_METERS - 200,
      TEST_LENGTH_METERS + 200,
    ];

    let elapsedMs = 0;
    const points: AttemptTrackPoint[] = offsetsMeters.map((offset, index) => {
      if (index > 0) {
        const distance = offset - offsetsMeters[index - 1];
        elapsedMs += (distance / speedMs) * 1000;
      }
      return point(
        TEST_START_LAT,
        offset,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + elapsedMs),
        speedMs,
      );
    });

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(1);
    expect(attempts[0].isValid).toBe(false);
    expect(attempts[0].invalidReason).toBe('DURATION_TOO_SHORT');
  });

  it('detecta dos intentos distintos dentro de la misma actividad', () => {
    const points: AttemptTrackPoint[] = [
      point(TEST_START_LAT, -200, TEST_LNG, new Date(BASE_TIME.getTime()), 20),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 20_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 140_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 160_000),
        20,
      ),
      // Vuelve a la salida y repite el recorrido para un segundo intento.
      point(
        TEST_START_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 300_000),
        20,
      ),
      point(
        TEST_START_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 320_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        -200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 440_000),
        20,
      ),
      point(
        TEST_FINISH_LAT,
        200,
        TEST_LNG,
        new Date(BASE_TIME.getTime() + 460_000),
        20,
      ),
    ];

    const attempts = detectCircuitAttempts(
      points,
      startLine,
      finishLine,
      TEST_LENGTH_METERS,
    );

    expect(attempts).toHaveLength(2);
    expect(attempts[1].startedAt.getTime()).toBeGreaterThan(
      attempts[0].finishedAt.getTime(),
    );
  });
});
