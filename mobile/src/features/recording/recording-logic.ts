export type RecordingStatus = "idle" | "recording" | "paused" | "finished";

export interface TrackPoint {
  lat: number;
  lng: number;
  recordedAt: string;
  speedMs: number | null;
  accuracy: number | null;
  altitudeMeters?: number | null;
}

export interface AutoRecordingConfig {
  enabled: boolean;
  vehicleId: string | null;
  inactivityTimeoutMs: number;
  candidatePoints: TrackPoint[];
  lastMovementAt: string | null;
}

export interface AutoStartEvaluation {
  candidatePoints: TrackPoint[];
  startedPoints: TrackPoint[] | null;
}

export interface RecordingStats {
  elapsedMs: number;
  distanceMeters: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  movingTimeMs: number;
  stoppedTimeMs: number;
  elevationGainMeters: number;
}

export interface QueuedActivity {
  id: string;
  attempts: number;
  payload: unknown;
}

export interface QueueSyncResult {
  syncedIds: string[];
  failures: { id: string; error: Error }[];
}

export type RecordingEvent =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "FINISH" }
  | { type: "RESET" };

const EARTH_RADIUS_METERS = 6_371_000;
export const DEFAULT_AUTO_INACTIVITY_TIMEOUT_MS = 180_000;
export const AUTO_START_SPEED_KMH = 12;
const AUTO_START_MIN_SAMPLES = 3;
const AUTO_START_MIN_DURATION_MS = 10_000;
const AUTO_START_MIN_DISTANCE_METERS = 30;
const MAX_PLAUSIBLE_SPEED_KMH = 350;

export function transitionRecordingStatus(
  status: RecordingStatus,
  event: RecordingEvent,
): RecordingStatus {
  const transitions: Record<
    RecordingStatus,
    Partial<Record<RecordingEvent["type"], RecordingStatus>>
  > = {
    idle: { START: "recording" },
    recording: { PAUSE: "paused", FINISH: "finished" },
    paused: { RESUME: "recording", FINISH: "finished" },
    finished: { RESET: "idle" },
  };
  const nextStatus = transitions[status][event.type];
  if (!nextStatus) {
    throw new Error(`No se puede aplicar ${event.type} durante ${status}`);
  }
  return nextStatus;
}

export function calculateRecordingStats(
  points: TrackPoint[],
  elapsedMs: number,
): RecordingStats {
  let distanceMeters = 0;
  let maxSpeedKmh = 0;
  let movingTimeMs = 0;
  let elevationGainMeters = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    maxSpeedKmh = Math.max(maxSpeedKmh, (point.speedMs ?? 0) * 3.6);
    if (index > 0) {
      const previous = points[index - 1];
      const segmentDistance = haversineDistanceMeters(previous, point);
      const segmentTimeMs =
        new Date(point.recordedAt).getTime() -
        new Date(previous.recordedAt).getTime();
      distanceMeters += segmentDistance;
      if (segmentTimeMs > 0 && segmentDistance / (segmentTimeMs / 1000) >= 1) {
        movingTimeMs += segmentTimeMs;
      }
      if (
        point.altitudeMeters !== null &&
        point.altitudeMeters !== undefined &&
        previous.altitudeMeters !== null &&
        previous.altitudeMeters !== undefined
      ) {
        const elevationDelta = point.altitudeMeters - previous.altitudeMeters;
        if (elevationDelta > 0 && elevationDelta <= 100) {
          elevationGainMeters += elevationDelta;
        }
      }
    }
  }

  const latest = points[points.length - 1];
  const boundedMovingTimeMs = Math.min(Math.max(0, elapsedMs), movingTimeMs);
  return {
    elapsedMs: Math.max(0, elapsedMs),
    distanceMeters,
    currentSpeedKmh: Math.max(0, (latest?.speedMs ?? 0) * 3.6),
    averageSpeedKmh: elapsedMs > 0 ? (distanceMeters / elapsedMs) * 3_600 : 0,
    maxSpeedKmh,
    movingTimeMs: boundedMovingTimeMs,
    stoppedTimeMs: Math.max(0, elapsedMs - boundedMovingTimeMs),
    elevationGainMeters,
  };
}

export function filterTrackPoints(points: TrackPoint[]): TrackPoint[] {
  const filtered: TrackPoint[] = [];
  for (const point of points) {
    if (
      !Number.isFinite(point.lat) ||
      point.lat < -90 ||
      point.lat > 90 ||
      !Number.isFinite(point.lng) ||
      point.lng < -180 ||
      point.lng > 180 ||
      !Number.isFinite(Date.parse(point.recordedAt)) ||
      (point.accuracy !== null &&
        (!Number.isFinite(point.accuracy) || point.accuracy > 50)) ||
      (point.speedMs !== null &&
        (!Number.isFinite(point.speedMs) || point.speedMs < 0))
    ) {
      continue;
    }

    const previous = filtered[filtered.length - 1];
    if (previous) {
      const deltaMs =
        Date.parse(point.recordedAt) - Date.parse(previous.recordedAt);
      if (deltaMs <= 0) {
        continue;
      }
      const impliedSpeedKmh =
        (haversineDistanceMeters(previous, point) / (deltaMs / 1000)) * 3.6;
      if (impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
        continue;
      }
    }
    filtered.push(point);
  }
  return filtered;
}

export function evaluateAutoStart(
  existingCandidates: TrackPoint[],
  incomingPoints: TrackPoint[],
): AutoStartEvaluation {
  let candidates = existingCandidates;

  for (const point of filterTrackPoints(incomingPoints)) {
    const previous = candidates[candidates.length - 1];
    const speedKmh = pointSpeedKmh(point, previous);
    if (speedKmh === null || speedKmh < AUTO_START_SPEED_KMH) {
      candidates = [];
      continue;
    }

    const previousTimestamp = previous ? Date.parse(previous.recordedAt) : null;
    const pointTimestamp = Date.parse(point.recordedAt);
    if (previousTimestamp !== null) {
      const sampleDeltaMs = pointTimestamp - previousTimestamp;
      if (sampleDeltaMs <= 0 || sampleDeltaMs > 30_000) {
        candidates = [];
      }
    }
    candidates = [...candidates, point].slice(-AUTO_START_MIN_SAMPLES);

    const first = candidates[0];
    if (
      candidates.length === AUTO_START_MIN_SAMPLES &&
      pointTimestamp - Date.parse(first.recordedAt) >=
        AUTO_START_MIN_DURATION_MS &&
      pathDistanceMeters(candidates) >= AUTO_START_MIN_DISTANCE_METERS
    ) {
      return { candidatePoints: [], startedPoints: candidates };
    }
  }

  return { candidatePoints: candidates, startedPoints: null };
}

export function pointSpeedKmh(
  point: TrackPoint,
  previous?: TrackPoint,
): number | null {
  if (point.speedMs !== null && Number.isFinite(point.speedMs)) {
    return Math.max(0, point.speedMs * 3.6);
  }
  if (!previous) {
    return null;
  }
  const deltaMs =
    Date.parse(point.recordedAt) - Date.parse(previous.recordedAt);
  if (deltaMs <= 0) {
    return null;
  }
  return (haversineDistanceMeters(previous, point) / (deltaMs / 1000)) * 3.6;
}

function pathDistanceMeters(points: TrackPoint[]): number {
  let distanceMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineDistanceMeters(points[index - 1], points[index]);
  }
  return distanceMeters;
}

export async function syncQueuedActivities(
  queue: QueuedActivity[],
  upload: (payload: unknown) => Promise<unknown>,
  markSynced: (id: string, result: unknown) => Promise<void>,
  markFailed: (id: string, attempts: number, error: Error) => Promise<void>,
): Promise<QueueSyncResult> {
  const result: QueueSyncResult = { syncedIds: [], failures: [] };
  for (const item of queue) {
    try {
      const response = await upload(item.payload);
      await markSynced(item.id, response);
      result.syncedIds.push(item.id);
    } catch (error) {
      const failure =
        error instanceof Error
          ? error
          : new Error("Error desconocido al sincronizar");
      await markFailed(item.id, item.attempts + 1, failure);
      result.failures.push({ id: item.id, error: failure });
    }
  }
  return result;
}

function haversineDistanceMeters(
  a: Pick<TrackPoint, "lat" | "lng">,
  b: Pick<TrackPoint, "lat" | "lng">,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}
