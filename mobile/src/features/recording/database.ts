import * as SQLite from "expo-sqlite";
import {
  DEFAULT_AUTO_INACTIVITY_TIMEOUT_MS,
  filterTrackPoints,
  type AutoRecordingConfig,
  type TrackPoint,
} from "./recording-logic";

export interface StoredSession {
  id: string;
  status: "idle" | "recording" | "paused" | "finished";
  vehicleId: string;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  uploadedActivityId: string | null;
}

export interface PendingUpload {
  id: string;
  attempts: number;
  payload: string;
}

export type AutoRecordingSettings = Pick<
  AutoRecordingConfig,
  "enabled" | "vehicleId" | "inactivityTimeoutMs"
>;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("xlr8-recording.db").then(
      async (database) => {
        await database.execAsync(`
          PRAGMA foreign_keys = ON;
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS recording_sessions (
            id TEXT PRIMARY KEY NOT NULL,
            status TEXT NOT NULL,
            vehicle_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            elapsed_ms INTEGER NOT NULL DEFAULT 0,
            uploaded_activity_id TEXT
          );
          CREATE TABLE IF NOT EXISTS recording_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            recorded_at TEXT NOT NULL,
            speed_ms REAL,
            accuracy REAL,
            altitude_meters REAL
          );
          CREATE INDEX IF NOT EXISTS recording_points_session_time_idx
            ON recording_points(session_id, recorded_at);
          CREATE TABLE IF NOT EXISTS activity_upload_queue (
            session_id TEXT PRIMARY KEY NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
          );
          CREATE TABLE IF NOT EXISTS auto_recording_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER NOT NULL DEFAULT 0,
            vehicle_id TEXT,
            inactivity_timeout_ms INTEGER NOT NULL DEFAULT ${DEFAULT_AUTO_INACTIVITY_TIMEOUT_MS},
            candidate_points TEXT NOT NULL DEFAULT '[]',
            last_movement_at TEXT
          );
          INSERT OR IGNORE INTO auto_recording_config (id)
          VALUES (1);
        `);
        const pointColumns = await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(recording_points)",
        );
        if (!pointColumns.some((column) => column.name === "altitude_meters")) {
          await database.execAsync(
            "ALTER TABLE recording_points ADD COLUMN altitude_meters REAL",
          );
        }
        return database;
      },
    );
  }
  return databasePromise;
}

export async function createLocalSession(
  vehicleId: string,
  startedAt: string,
): Promise<StoredSession> {
  const session: StoredSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: "idle",
    vehicleId,
    startedAt,
    finishedAt: null,
    elapsedMs: 0,
    uploadedActivityId: null,
  };
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO recording_sessions
      (id, status, vehicle_id, started_at, elapsed_ms)
     VALUES (?, ?, ?, ?, 0)`,
    session.id,
    session.status,
    session.vehicleId,
    session.startedAt,
  );
  return session;
}

export async function appendLocalPoints(
  sessionId: string,
  incomingPoints: TrackPoint[],
): Promise<TrackPoint[]> {
  const points = filterTrackPoints(incomingPoints);
  if (points.length === 0) {
    return [];
  }

  const database = await getDatabase();
  let savedPoints: TrackPoint[] = [];
  await database.withTransactionAsync(async () => {
    const previous = await database.getFirstAsync<{
      latitude: number;
      longitude: number;
      recorded_at: string;
      speed_ms: number | null;
      accuracy: number | null;
      altitude_meters: number | null;
    }>(
      `SELECT latitude, longitude, recorded_at, speed_ms, accuracy, altitude_meters
       FROM recording_points WHERE session_id = ?
       ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      sessionId,
    );
    const previousPoint: TrackPoint | null = previous
      ? {
          lat: previous.latitude,
          lng: previous.longitude,
          recordedAt: previous.recorded_at,
          speedMs: previous.speed_ms,
          accuracy: previous.accuracy,
          altitudeMeters: previous.altitude_meters,
        }
      : null;
    const validPoints = filterTrackPoints(
      previousPoint ? [previousPoint, ...points] : points,
    ).slice(previousPoint ? 1 : 0);
    savedPoints = validPoints;

    for (const point of validPoints) {
      await database.runAsync(
        `INSERT INTO recording_points
          (session_id, latitude, longitude, recorded_at, speed_ms, accuracy, altitude_meters)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        point.lat,
        point.lng,
        point.recordedAt,
        point.speedMs,
        point.accuracy,
        point.altitudeMeters ?? null,
      );
    }
  });
  return savedPoints;
}

export async function getLocalPoints(sessionId: string): Promise<TrackPoint[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    latitude: number;
    longitude: number;
    recorded_at: string;
    speed_ms: number | null;
    accuracy: number | null;
    altitude_meters: number | null;
  }>(
    `SELECT latitude, longitude, recorded_at, speed_ms, accuracy, altitude_meters
     FROM recording_points WHERE session_id = ? ORDER BY recorded_at, id`,
    sessionId,
  );
  return rows.map((row) => ({
    lat: row.latitude,
    lng: row.longitude,
    recordedAt: row.recorded_at,
    speedMs: row.speed_ms,
    accuracy: row.accuracy,
    altitudeMeters: row.altitude_meters,
  }));
}

export async function getAutoRecordingConfig(): Promise<AutoRecordingConfig> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    enabled: number;
    vehicle_id: string | null;
    inactivity_timeout_ms: number;
    candidate_points: string;
    last_movement_at: string | null;
  }>(
    `SELECT enabled, vehicle_id, inactivity_timeout_ms, candidate_points, last_movement_at
     FROM auto_recording_config WHERE id = 1`,
  );
  if (!row) {
    throw new Error(
      "No se pudo cargar la configuración de grabación automática.",
    );
  }
  return {
    enabled: row.enabled === 1,
    vehicleId: row.vehicle_id,
    inactivityTimeoutMs: row.inactivity_timeout_ms,
    candidatePoints: JSON.parse(row.candidate_points) as TrackPoint[],
    lastMovementAt: row.last_movement_at,
  };
}

export async function saveAutoRecordingSettings(
  settings: AutoRecordingSettings,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE auto_recording_config
     SET enabled = ?, vehicle_id = ?, inactivity_timeout_ms = ?,
         candidate_points = '[]', last_movement_at = NULL
     WHERE id = 1`,
    settings.enabled ? 1 : 0,
    settings.vehicleId,
    settings.inactivityTimeoutMs,
  );
}

export async function updateAutoRecordingProgress(
  candidatePoints: TrackPoint[],
  lastMovementAt: string | null,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE auto_recording_config
     SET candidate_points = ?, last_movement_at = ?
     WHERE id = 1`,
    JSON.stringify(candidatePoints),
    lastMovementAt,
  );
}

export async function updateLocalSession(
  sessionId: string,
  update: {
    status?: StoredSession["status"];
    finishedAt?: string | null;
    elapsedMs?: number;
  },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  if (update.status !== undefined) {
    assignments.push("status = ?");
    values.push(update.status);
  }
  if (update.finishedAt !== undefined) {
    assignments.push("finished_at = ?");
    values.push(update.finishedAt);
  }
  if (update.elapsedMs !== undefined) {
    assignments.push("elapsed_ms = ?");
    values.push(update.elapsedMs);
  }
  if (assignments.length === 0) {
    return;
  }
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE recording_sessions SET ${assignments.join(", ")} WHERE id = ?`,
    ...values,
    sessionId,
  );
}

export async function getUnfinishedSession(): Promise<StoredSession | null> {
  const database = await getDatabase();
  const session = await database.getFirstAsync<{
    id: string;
    status: StoredSession["status"];
    vehicle_id: string;
    started_at: string;
    finished_at: string | null;
    elapsed_ms: number;
    uploaded_activity_id: string | null;
  }>(
    `SELECT id, status, vehicle_id, started_at, finished_at, elapsed_ms, uploaded_activity_id
     FROM recording_sessions WHERE status IN ('recording', 'paused')
     ORDER BY started_at DESC LIMIT 1`,
  );
  return session ? mapSession(session) : null;
}

export async function getLocalSession(
  sessionId: string,
): Promise<StoredSession | null> {
  const database = await getDatabase();
  const session = await database.getFirstAsync<{
    id: string;
    status: StoredSession["status"];
    vehicle_id: string;
    started_at: string;
    finished_at: string | null;
    elapsed_ms: number;
    uploaded_activity_id: string | null;
  }>(
    `SELECT id, status, vehicle_id, started_at, finished_at, elapsed_ms, uploaded_activity_id
     FROM recording_sessions WHERE id = ?`,
    sessionId,
  );
  return session ? mapSession(session) : null;
}

export async function discardLocalSession(sessionId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM recording_sessions WHERE id = ?",
    sessionId,
  );
}

export async function finishLocalSession(
  sessionId: string,
  finishedAt: string,
  elapsedMs: number,
  payload: unknown,
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    const update = await database.runAsync(
      `UPDATE recording_sessions
       SET status = 'finished', finished_at = ?, elapsed_ms = ?
       WHERE id = ?`,
      finishedAt,
      elapsedMs,
      sessionId,
    );
    if (update.changes !== 1) {
      throw new Error("No se encontró la sesión local que se va a finalizar.");
    }
    await database.runAsync(
      `INSERT INTO activity_upload_queue (session_id, payload)
       VALUES (?, ?)
       ON CONFLICT(session_id) DO UPDATE SET payload = excluded.payload`,
      sessionId,
      JSON.stringify(payload),
    );
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    session_id: string;
    attempts: number;
    payload: string;
  }>(
    `SELECT session_id, attempts, payload
     FROM activity_upload_queue ORDER BY rowid`,
  );
  return rows.map((row) => ({
    id: row.session_id,
    attempts: row.attempts,
    payload: row.payload,
  }));
}

export async function markUploadSynced(
  sessionId: string,
  activityId: string,
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "UPDATE recording_sessions SET uploaded_activity_id = ? WHERE id = ?",
      activityId,
      sessionId,
    );
    await database.runAsync(
      "DELETE FROM activity_upload_queue WHERE session_id = ?",
      sessionId,
    );
  });
}

export async function markUploadFailed(
  sessionId: string,
  attempts: number,
  error: string,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE activity_upload_queue
     SET attempts = ?, last_error = ? WHERE session_id = ?`,
    attempts,
    error,
    sessionId,
  );
}

function mapSession(session: {
  id: string;
  status: StoredSession["status"];
  vehicle_id: string;
  started_at: string;
  finished_at: string | null;
  elapsed_ms: number;
  uploaded_activity_id: string | null;
}): StoredSession {
  return {
    id: session.id,
    status: session.status,
    vehicleId: session.vehicle_id,
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    elapsedMs: session.elapsed_ms,
    uploadedActivityId: session.uploaded_activity_id,
  };
}
