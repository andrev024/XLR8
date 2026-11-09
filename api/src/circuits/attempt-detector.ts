import {
  MAX_PLAUSIBLE_SPEED_KMH,
  haversineDistanceMeters,
  type GeoPoint,
} from '../common/geo';

export interface AttemptTrackPoint extends GeoPoint {
  recordedAt: Date;
  speedMs?: number;
}

/** Línea de meta/salida representada por sus dos extremos. */
export type GateLine = [GeoPoint, GeoPoint];

export type InvalidReason =
  'SPEED_IMPLAUSIBLE' | 'DISTANCE_MISMATCH' | 'GPS_GAP' | 'DURATION_TOO_SHORT';

export interface DetectedAttempt {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  maxSpeedKmh: number;
  isValid: boolean;
  invalidReason: InvalidReason | null;
}

const MAX_GPS_GAP_MS = 30_000;
const DISTANCE_TOLERANCE_RATIO = 0.25;
const MIN_PLAUSIBLE_SPEED_KMH = 300;

interface Crossing {
  segmentIndex: number;
  fraction: number;
  timestamp: Date;
}

/**
 * Detecta los intentos de circuito dentro de una secuencia de puntos GPS,
 * cruzando la línea de salida y luego la de meta. Función pura: no accede a
 * base de datos ni a reloj del sistema, solo recibe datos y los procesa.
 */
export function detectCircuitAttempts(
  points: AttemptTrackPoint[],
  startLine: GateLine,
  finishLine: GateLine,
  circuitLengthMeters: number,
): DetectedAttempt[] {
  if (points.length < 2) {
    return [];
  }

  const starts = findCrossings(points, startLine);
  const finishes = findCrossings(points, finishLine);

  const attempts: DetectedAttempt[] = [];
  let finishCursor = 0;

  for (const start of starts) {
    while (
      finishCursor < finishes.length &&
      finishes[finishCursor].timestamp.getTime() <= start.timestamp.getTime()
    ) {
      finishCursor++;
    }
    if (finishCursor >= finishes.length) {
      break;
    }

    const finish = finishes[finishCursor];
    finishCursor++;

    attempts.push(buildAttempt(points, start, finish, circuitLengthMeters));
  }

  return attempts;
}

function findCrossings(
  points: AttemptTrackPoint[],
  gate: GateLine,
): Crossing[] {
  const crossings: Crossing[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const fraction = findSegmentIntersectionFraction(
      points[i],
      points[i + 1],
      gate[0],
      gate[1],
    );
    if (fraction === null) {
      continue;
    }

    const t0 = points[i].recordedAt.getTime();
    const t1 = points[i + 1].recordedAt.getTime();
    crossings.push({
      segmentIndex: i,
      fraction,
      timestamp: new Date(t0 + fraction * (t1 - t0)),
    });
  }

  return crossings;
}

/**
 * Intersección clásica de dos segmentos en el plano (lng=x, lat=y); suficiente
 * aproximación para distancias cortas de un circuito.
 * Devuelve la fracción `t` a lo largo del segmento p1->p2, o null si no cruzan.
 */
function findSegmentIntersectionFraction(
  p1: GeoPoint,
  p2: GeoPoint,
  p3: GeoPoint,
  p4: GeoPoint,
): number | null {
  const denom =
    (p2.lng - p1.lng) * (p4.lat - p3.lat) -
    (p2.lat - p1.lat) * (p4.lng - p3.lng);
  if (denom === 0) {
    return null;
  }

  const t =
    ((p3.lng - p1.lng) * (p4.lat - p3.lat) -
      (p3.lat - p1.lat) * (p4.lng - p3.lng)) /
    denom;
  const u =
    ((p3.lng - p1.lng) * (p2.lat - p1.lat) -
      (p3.lat - p1.lat) * (p2.lng - p1.lng)) /
    denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }
  return t;
}

function interpolatePosition(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function buildAttempt(
  points: AttemptTrackPoint[],
  start: Crossing,
  finish: Crossing,
  circuitLengthMeters: number,
): DetectedAttempt {
  const startPosition = interpolatePosition(
    points[start.segmentIndex],
    points[start.segmentIndex + 1],
    start.fraction,
  );
  const finishPosition = interpolatePosition(
    points[finish.segmentIndex],
    points[finish.segmentIndex + 1],
    finish.fraction,
  );

  const innerPoints = points.slice(
    start.segmentIndex + 1,
    finish.segmentIndex + 1,
  );
  const attemptPoints: AttemptTrackPoint[] = [
    { ...startPosition, recordedAt: start.timestamp },
    ...innerPoints,
    { ...finishPosition, recordedAt: finish.timestamp },
  ];

  const durationMs = finish.timestamp.getTime() - start.timestamp.getTime();

  let distanceMeters = 0;
  let maxSpeedKmh = (attemptPoints[0].speedMs ?? 0) * 3.6;
  let maxSegmentSpeedKmh = 0;
  let maxGapMs = 0;

  for (let i = 0; i < attemptPoints.length - 1; i++) {
    const a = attemptPoints[i];
    const b = attemptPoints[i + 1];
    const segmentDistance = haversineDistanceMeters(a, b);
    distanceMeters += segmentDistance;

    const deltaMs = b.recordedAt.getTime() - a.recordedAt.getTime();
    maxGapMs = Math.max(maxGapMs, deltaMs);

    const impliedSpeedKmh =
      deltaMs > 0 ? (segmentDistance / (deltaMs / 1000)) * 3.6 : 0;
    maxSegmentSpeedKmh = Math.max(maxSegmentSpeedKmh, impliedSpeedKmh);

    const reportedSpeedKmh =
      b.speedMs !== undefined ? b.speedMs * 3.6 : impliedSpeedKmh;
    maxSpeedKmh = Math.max(maxSpeedKmh, reportedSpeedKmh);
  }

  const minPlausibleDurationMs =
    (circuitLengthMeters / (MIN_PLAUSIBLE_SPEED_KMH / 3.6)) * 1000;
  const distanceRatio =
    circuitLengthMeters > 0
      ? Math.abs(distanceMeters - circuitLengthMeters) / circuitLengthMeters
      : 0;

  let invalidReason: InvalidReason | null = null;
  if (
    maxSegmentSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH ||
    maxSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH
  ) {
    invalidReason = 'SPEED_IMPLAUSIBLE';
  } else if (durationMs < minPlausibleDurationMs) {
    invalidReason = 'DURATION_TOO_SHORT';
  } else if (distanceRatio > DISTANCE_TOLERANCE_RATIO) {
    invalidReason = 'DISTANCE_MISMATCH';
  } else if (maxGapMs > MAX_GPS_GAP_MS) {
    invalidReason = 'GPS_GAP';
  }

  return {
    startedAt: start.timestamp,
    finishedAt: finish.timestamp,
    durationMs,
    maxSpeedKmh,
    isValid: invalidReason === null,
    invalidReason,
  };
}
