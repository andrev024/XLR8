import * as SQLite from "expo-sqlite";
import { filterTrackPoints, type TrackPoint } from "./recording-logic";

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
            accuracy REAL
          );
          CREATE INDEX IF NOT EXISTS recording_points_session_time_idx
            ON recording_points(session_id, recorded_at);
          CREATE TABLE IF NOT EXISTS activity_upload_queue (
            session_id TEXT PRIMARY KEY NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
          );
        `);
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
  await database.withTransactionAsync(async () => {
    for (const point of points) {
      await database.runAsync(
        `INSERT INTO recording_points
          (session_id, latitude, longitude, recorded_at, speed_ms, accuracy)
         VALUES (?, ?, ?, ?, ?, ?)`,
        sessionId,
        point.lat,
        point.lng,
        point.recordedAt,
        point.speedMs,
        point.accuracy,
      );
    }
  });
  return points;
}

export async function getLocalPoints(sessionId: string): Promise<TrackPoint[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    latitude: number;
    longitude: number;
    recorded_at: string;
    speed_ms: number | null;
    accuracy: number | null;
  }>(
    `SELECT latitude, longitude, recorded_at, speed_ms, accuracy
     FROM recording_points WHERE session_id = ? ORDER BY recorded_at, id`,
    sessionId,
  );
  return rows.map((row) => ({
    lat: row.latitude,
    lng: row.longitude,
    recordedAt: row.recorded_at,
    speedMs: row.speed_ms,
    accuracy: row.accuracy,
  }));
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
