export type RecordingStatus = "idle" | "recording" | "paused" | "finished";

export interface TrackPoint {
  lat: number;
  lng: number;
  recordedAt: string;
  speedMs: number | null;
  accuracy: number | null;
}

export interface RecordingStats {
  elapsedMs: number;
  distanceMeters: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
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

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    maxSpeedKmh = Math.max(maxSpeedKmh, (point.speedMs ?? 0) * 3.6);
    if (index > 0) {
      distanceMeters += haversineDistanceMeters(points[index - 1], point);
    }
  }

  const latest = points[points.length - 1];
  return {
    elapsedMs: Math.max(0, elapsedMs),
    distanceMeters,
    currentSpeedKmh: Math.max(0, (latest?.speedMs ?? 0) * 3.6),
    averageSpeedKmh: elapsedMs > 0 ? (distanceMeters / elapsedMs) * 3_600 : 0,
    maxSpeedKmh,
  };
}

export function filterTrackPoints(points: TrackPoint[]): TrackPoint[] {
  return points.filter(
    (point) =>
      point.accuracy === null ||
      !Number.isFinite(point.accuracy) ||
      point.accuracy <= 50,
  );
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
