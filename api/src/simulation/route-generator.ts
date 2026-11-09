import type { GeoPoint } from '../common/geo';
import type { GateLine } from '../circuits/attempt-detector';
import type { InvalidReason } from '../circuits/attempt-detector';

export const SIMULATION_SCENARIOS = [
  'VALID',
  'FAST_VALID',
  'TOO_FAST',
  'GPS_JUMP',
  'SIGNAL_GAP',
  'WRONG_DIRECTION',
  'SHORT_CUT',
  'NO_CROSSING',
  'DOUBLE_ATTEMPT',
] as const;

export type SimulationScenario = (typeof SIMULATION_SCENARIOS)[number];

export interface SimulationPoint extends GeoPoint {
  recordedAt: Date;
  speedMs: number;
}

export interface ExpectedScenarioAttempt {
  isValid: boolean;
  invalidReason: InvalidReason | null;
}

export interface ScenarioExpectation {
  detected: boolean;
  attempts: ExpectedScenarioAttempt[];
}

export interface RouteScenario {
  scenario: SimulationScenario;
  description: string;
  expected: ScenarioExpectation;
}

export interface RouteGeneratorOptions {
  scenario: SimulationScenario;
  startLine: GateLine;
  finishLine: GateLine;
  circuitLengthMeters: number;
  startedAt?: Date;
  speedKmh?: number;
  maxSpeedKmh?: number;
  noiseMeters?: number;
  seed?: number;
}

export interface GeneratedRoute {
  points: SimulationPoint[];
  expectation: ScenarioExpectation;
}

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_CEILING_KMH = 180;
const DEFAULT_NOISE_METERS = 1.2;
const GPS_JUMP_OFFSET_METERS = 1_000;
const GAP_DURATION_MS = 35_000;

const EXPECTATIONS: Record<SimulationScenario, ScenarioExpectation> = {
  VALID: { detected: true, attempts: [{ isValid: true, invalidReason: null }] },
  FAST_VALID: {
    detected: true,
    attempts: [{ isValid: true, invalidReason: null }],
  },
  TOO_FAST: {
    detected: true,
    attempts: [{ isValid: false, invalidReason: 'SPEED_IMPLAUSIBLE' }],
  },
  GPS_JUMP: {
    detected: true,
    attempts: [{ isValid: false, invalidReason: 'DISTANCE_MISMATCH' }],
  },
  SIGNAL_GAP: {
    detected: true,
    attempts: [{ isValid: false, invalidReason: 'GPS_GAP' }],
  },
  WRONG_DIRECTION: { detected: false, attempts: [] },
  SHORT_CUT: {
    detected: true,
    attempts: [{ isValid: false, invalidReason: 'DISTANCE_MISMATCH' }],
  },
  NO_CROSSING: { detected: false, attempts: [] },
  DOUBLE_ATTEMPT: {
    detected: true,
    attempts: [
      { isValid: true, invalidReason: null },
      { isValid: true, invalidReason: null },
    ],
  },
};

const SCENARIO_DESCRIPTIONS: Record<SimulationScenario, string> = {
  VALID: 'Recorrido realista válido',
  FAST_VALID: 'Intento válido a ritmo cercano al récord',
  TOO_FAST: 'Velocidad implícita superior a 350 km/h',
  GPS_JUMP: 'Salto lateral de GPS de cientos de metros',
  SIGNAL_GAP: 'Interrupción de señal de más de 30 segundos',
  WRONG_DIRECTION: 'Cruza meta antes que salida',
  SHORT_CUT: 'Atajo con distancia incompatible',
  NO_CROSSING: 'Pasa cerca sin cruzar salida ni meta',
  DOUBLE_ATTEMPT: 'Dos pasadas completas en una actividad',
};

interface LocalPoint {
  x: number;
  y: number;
}

interface LocalFrame {
  lat: number;
  lng: number;
}

export function getScenarioDefinition(
  scenario: SimulationScenario,
): RouteScenario {
  return {
    scenario,
    description: SCENARIO_DESCRIPTIONS[scenario],
    expected: EXPECTATIONS[scenario],
  };
}

export function generateRouteScenario(
  referencePath: GeoPoint[],
  options: RouteGeneratorOptions,
): GeneratedRoute {
  if (referencePath.length < 2) {
    throw new Error('El trazado de referencia necesita al menos dos puntos.');
  }
  if (options.circuitLengthMeters <= 0) {
    throw new Error('La longitud del circuito debe ser mayor que cero.');
  }

  const startedAt = options.startedAt ?? new Date('2026-01-01T00:00:00.000Z');
  const noiseMeters = options.noiseMeters ?? DEFAULT_NOISE_METERS;
  const random = createRandom(options.seed ?? 41);
  const baseSpeed =
    options.speedKmh ??
    (options.scenario === 'FAST_VALID' ? 170 : DEFAULT_CEILING_KMH * 0.42);
  const ceiling = options.maxSpeedKmh ?? DEFAULT_CEILING_KMH;
  const route = createPass(
    referencePath,
    options.startLine,
    options.finishLine,
    options.scenario === 'WRONG_DIRECTION',
  );
  let points = sampleRoute(
    route,
    startedAt,
    Math.min(baseSpeed, ceiling),
    ceiling,
    noiseMeters,
    random,
  );

  switch (options.scenario) {
    case 'VALID':
    case 'FAST_VALID':
      break;
    case 'TOO_FAST':
      points = sampleRoute(
        route,
        startedAt,
        Math.min(baseSpeed, ceiling),
        ceiling,
        noiseMeters,
        random,
      ).map((point) => ({ ...point, speedMs: 120 }));
      break;
    case 'GPS_JUMP':
      points = addGpsJump(points, options.circuitLengthMeters, random);
      break;
    case 'SIGNAL_GAP':
      points = addSignalGap(points);
      break;
    case 'WRONG_DIRECTION':
      break;
    case 'SHORT_CUT':
      points = sampleRoute(
        createShortcutPass(
          referencePath,
          options.startLine,
          options.finishLine,
        ),
        startedAt,
        Math.min(baseSpeed, ceiling),
        ceiling,
        noiseMeters,
        random,
      );
      break;
    case 'NO_CROSSING':
      points = offsetRoute(
        points,
        Math.max(
          gateHalfWidthMeters(options.startLine),
          gateHalfWidthMeters(options.finishLine),
        ) + 8,
      );
      break;
    case 'DOUBLE_ATTEMPT': {
      const frame = { lat: 0, lng: 0 };
      const side = normalize({
        x: -(route[1].y - route[0].y),
        y: route[1].x - route[0].x,
      });
      const bypassDistance =
        Math.max(
          gateHalfWidthMeters(options.startLine),
          gateHalfWidthMeters(options.finishLine),
        ) + 12;
      const firstEnd = toLocal(points[points.length - 1], frame);
      const secondStart = route[0];
      const connector = sampleRoute(
        [
          firstEnd,
          add(firstEnd, scale(side, bypassDistance)),
          add(secondStart, scale(side, bypassDistance)),
          secondStart,
        ],
        new Date(points[points.length - 1].recordedAt.getTime() + 1000),
        60,
        60,
        0,
        random,
      );
      const secondStartedAt = new Date(
        connector[connector.length - 1].recordedAt.getTime() + 1000,
      );
      const secondPass = sampleRoute(
        route,
        secondStartedAt,
        Math.min(baseSpeed, ceiling),
        ceiling,
        noiseMeters,
        random,
      );
      points = [...points, ...connector.slice(1), ...secondPass.slice(1)];
      break;
    }
  }

  return { points, expectation: EXPECTATIONS[options.scenario] };
}

export function calculatePathLength(points: GeoPoint[]): number {
  return points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + haversineDistanceMeters(points[index], point),
      0,
    );
}

function createPass(
  source: GeoPoint[],
  startLine: GateLine,
  finishLine: GateLine,
  reversed: boolean,
): LocalPoint[] {
  const ordered = reversed ? [...source].reverse() : source;
  const frame = { lat: 0, lng: 0 };
  const local = ordered.map((point) => toLocal(point, frame));
  const firstDirection = normalize(subtract(local[1], local[0]));
  const lastDirection = normalize(
    subtract(local[local.length - 1], local[local.length - 2]),
  );
  const firstGate = midpoint(...(reversed ? finishLine : startLine));
  const lastGate = midpoint(...(reversed ? startLine : finishLine));
  const directionStart = reversed ? lastDirection : firstDirection;
  const directionFinish = reversed ? firstDirection : lastDirection;
  const start = toLocal(firstGate, frame);
  const finish = toLocal(lastGate, frame);
  const leading = subtract(start, scale(directionStart, 45));
  const trailing = add(finish, scale(directionFinish, 45));
  return deduplicate([leading, ...local, trailing]);
}

function createShortcutPass(
  referencePath: GeoPoint[],
  startLine: GateLine,
  finishLine: GateLine,
): LocalPoint[] {
  const frame = { lat: 0, lng: 0 };
  const local = referencePath.map((point) => toLocal(point, frame));
  const startDirection = crossingDirection(
    startLine,
    normalize(subtract(local[1], local[0])),
    frame,
  );
  const finishDirection = crossingDirection(
    finishLine,
    normalize(subtract(local[local.length - 1], local[local.length - 2])),
    frame,
  );
  const start = toLocal(midpoint(...startLine), frame);
  const finish = toLocal(midpoint(...finishLine), frame);
  return deduplicate([
    subtract(start, scale(startDirection, 45)),
    add(start, scale(startDirection, 45)),
    subtract(finish, scale(finishDirection, 45)),
    add(finish, scale(finishDirection, 45)),
  ]);
}

function crossingDirection(
  gate: GateLine,
  expectedDirection: LocalPoint,
  frame: LocalFrame,
): LocalPoint {
  const gateStart = toLocal(gate[0], frame);
  const gateEnd = toLocal(gate[1], frame);
  const gateDirection = normalize(subtract(gateEnd, gateStart));
  const normal = { x: -gateDirection.y, y: gateDirection.x };
  const orientation =
    normal.x * expectedDirection.x + normal.y * expectedDirection.y;
  return orientation >= 0 ? normal : scale(normal, -1);
}

function sampleRoute(
  route: LocalPoint[],
  startedAt: Date,
  cruiseKmh: number,
  maxSpeedKmh: number,
  noiseMeters: number,
  random: () => number,
): SimulationPoint[] {
  const lengths = [0];
  for (let index = 1; index < route.length; index += 1) {
    lengths.push(lengths[index - 1] + distance(route[index - 1], route[index]));
  }
  const totalDistance = lengths[lengths.length - 1];
  if (totalDistance <= 0) {
    throw new Error('El trazado de referencia no tiene longitud.');
  }

  const points: SimulationPoint[] = [];
  let progress = 0;
  let elapsedSeconds = 0;
  let previousSpeedKmh = 12;
  const maximumSeconds = Math.ceil(totalDistance / 2.2 + 60);
  while (progress < totalDistance && elapsedSeconds < maximumSeconds) {
    const position = pointAtDistance(route, lengths, progress);
    const targetSpeedKmh = speedAtDistance(
      route,
      lengths,
      progress,
      totalDistance,
      cruiseKmh,
      maxSpeedKmh,
    );
    const speed = limitSpeedChange(previousSpeedKmh, targetSpeedKmh);
    previousSpeedKmh = speed;
    const noisy = applyNoise(position, noiseMeters, random);
    points.push({
      ...fromLocal(noisy, { lat: 0, lng: 0 }),
      recordedAt: new Date(startedAt.getTime() + elapsedSeconds * 1000),
      speedMs: speed / 3.6,
    });
    progress = Math.min(totalDistance, progress + speed / 3.6);
    elapsedSeconds += 1;
  }

  const endpoint = route[route.length - 1];
  const lastPoint = points[points.length - 1];
  if (
    !lastPoint ||
    distance(toLocal(lastPoint, { lat: 0, lng: 0 }), endpoint) > 0.1
  ) {
    const targetSpeedKmh = speedAtDistance(
      route,
      lengths,
      totalDistance,
      totalDistance,
      cruiseKmh,
      maxSpeedKmh,
    );
    const speed = limitSpeedChange(previousSpeedKmh, targetSpeedKmh);
    points.push({
      ...fromLocal(applyNoise(endpoint, noiseMeters, random), {
        lat: 0,
        lng: 0,
      }),
      recordedAt: new Date(startedAt.getTime() + elapsedSeconds * 1000),
      speedMs: speed / 3.6,
    });
  }
  return points;
}

function limitSpeedChange(
  previousSpeedKmh: number,
  targetSpeedKmh: number,
): number {
  return Math.max(
    previousSpeedKmh - 9,
    Math.min(previousSpeedKmh + 3.6, targetSpeedKmh),
  );
}

function speedAtDistance(
  route: LocalPoint[],
  lengths: number[],
  progress: number,
  totalDistance: number,
  cruiseKmh: number,
  maximumKmh: number,
): number {
  const fraction = progress / totalDistance;
  const acceleration = Math.min(1, 0.35 + fraction * 6);
  const braking = Math.min(1, 0.35 + (1 - fraction) * 6);
  const cornerFactor = curvatureFactor(route, lengths, progress, totalDistance);
  return Math.max(
    18,
    Math.min(cruiseKmh * acceleration * braking * cornerFactor, maximumKmh),
  );
}

function curvatureFactor(
  route: LocalPoint[],
  lengths: number[],
  progress: number,
  totalDistance: number,
): number {
  if (route.length < 3) {
    return 1;
  }
  const lookAheadDistance = Math.min(totalDistance, progress + 35);
  const startIndex = Math.max(
    0,
    lengths.findIndex((length) => length >= progress) - 1,
  );
  const endIndex = Math.min(
    route.length - 1,
    lengths.findIndex((length) => length >= lookAheadDistance),
  );
  if (endIndex <= startIndex + 1) {
    return 1;
  }
  const incoming = normalize(
    subtract(route[startIndex + 1], route[startIndex]),
  );
  const outgoing = normalize(subtract(route[endIndex], route[endIndex - 1]));
  const cosine = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y),
  );
  const angleDegrees = (Math.acos(cosine) * 180) / Math.PI;
  return angleDegrees > 8 ? Math.max(0.55, 1 - angleDegrees / 120) : 1;
}

function addGpsJump(
  points: SimulationPoint[],
  circuitLengthMeters: number,
  random: () => number,
): SimulationPoint[] {
  const index = Math.max(2, Math.floor(points.length * 0.55));
  const frame = { lat: points[index].lat, lng: points[index].lng };
  const before = toLocal(points[index], frame);
  const after = toLocal(points[index + 1], frame);
  const direction = normalize(subtract(after, before));
  const offset = scale(
    { x: direction.y, y: -direction.x },
    GPS_JUMP_OFFSET_METERS,
  );
  const excursionDuration = 60;
  const requestedCycles = Math.max(1, Math.ceil(circuitLengthMeters / 2500));
  const availableCycles = Math.max(
    1,
    Math.floor((points.length - index - 1) / excursionDuration),
  );
  const excursionCycles = Math.min(requestedCycles, availableCycles);
  const displaced = points.map((point, pointIndex) => {
    let location = toLocal(point, frame);
    if (
      pointIndex >= index &&
      pointIndex <= index + excursionDuration * excursionCycles
    ) {
      const fraction =
        ((pointIndex - index) % excursionDuration) / excursionDuration;
      location = interpolateLocal(
        location,
        add(location, offset),
        Math.sin(fraction * Math.PI),
      );
    }
    return {
      ...point,
      ...fromLocal(applyNoise(location, 0.5, random), frame),
    };
  });
  return displaced;
}

function addSignalGap(points: SimulationPoint[]): SimulationPoint[] {
  const gapIndex = Math.max(2, Math.floor(points.length / 2));
  return points.map((point, index) =>
    index < gapIndex
      ? point
      : {
          ...point,
          recordedAt: new Date(point.recordedAt.getTime() + GAP_DURATION_MS),
        },
  );
}

function offsetRoute(
  points: SimulationPoint[],
  meters: number,
): SimulationPoint[] {
  const frame = { lat: points[0].lat, lng: points[0].lng };
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const direction = normalize(
      subtract(toLocal(next, frame), toLocal(previous, frame)),
    );
    const position = add(
      toLocal(point, frame),
      scale({ x: -direction.y, y: direction.x }, meters),
    );
    return { ...point, ...fromLocal(position, frame) };
  });
}

function applyNoise(
  point: LocalPoint,
  deviationMeters: number,
  random: () => number,
): LocalPoint {
  return {
    x: point.x + gaussian(random) * deviationMeters,
    y: point.y + gaussian(random) * deviationMeters,
  };
}

function gaussian(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function gateHalfWidthMeters(gate: GateLine): number {
  return haversineDistanceMeters(gate[0], gate[1]) / 2;
}

function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const latitudeA = radians(a.lat);
  const latitudeB = radians(b.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}

function toLocal(point: GeoPoint, frame: LocalFrame): LocalPoint {
  return {
    x:
      (((point.lng - frame.lng) * Math.PI) / 180) *
      EARTH_RADIUS_METERS *
      Math.cos((frame.lat * Math.PI) / 180),
    y: (((point.lat - frame.lat) * Math.PI) / 180) * EARTH_RADIUS_METERS,
  };
}

function fromLocal(point: LocalPoint, frame: LocalFrame): GeoPoint {
  return {
    lat: frame.lat + (point.y / EARTH_RADIUS_METERS) * (180 / Math.PI),
    lng:
      frame.lng +
      (point.x /
        (EARTH_RADIUS_METERS * Math.cos((frame.lat * Math.PI) / 180))) *
        (180 / Math.PI),
  };
}

function pointAtDistance(
  route: LocalPoint[],
  lengths: number[],
  progress: number,
): LocalPoint {
  const index = lengths.findIndex((length) => length >= progress);
  if (index <= 0) {
    return route[0];
  }
  const segmentLength = lengths[index] - lengths[index - 1];
  const fraction =
    segmentLength > 0 ? (progress - lengths[index - 1]) / segmentLength : 0;
  return interpolateLocal(route[index - 1], route[index], fraction);
}

function deduplicate(points: LocalPoint[]): LocalPoint[] {
  return points.filter(
    (point, index) => index === 0 || distance(point, points[index - 1]) > 0.1,
  );
}

function distance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(point: LocalPoint): LocalPoint {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

function subtract(a: LocalPoint, b: LocalPoint): LocalPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: LocalPoint, b: LocalPoint): LocalPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(point: LocalPoint, factor: number): LocalPoint {
  return { x: point.x * factor, y: point.y * factor };
}

function interpolateLocal(
  a: LocalPoint,
  b: LocalPoint,
  fraction: number,
): LocalPoint {
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
  };
}
