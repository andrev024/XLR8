import {
  createLocalSession,
  discardLocalSession,
  finishLocalSession,
  getAutoRecordingConfig,
  getLocalPoints,
  getUnfinishedSession,
  saveAutoRecordingSettings,
  updateLocalSession,
} from "./database";
import type { AutoRecordingSettings } from "./database";
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "./location-task";
import { syncActivityUploadQueue } from "./upload-queue";
import { useRecordingStore } from "./store";

export async function beginRecording(vehicleId: string): Promise<void> {
  const autoConfig = await getAutoRecordingConfig();
  await saveAutoRecordingSettings({
    enabled: false,
    vehicleId: autoConfig.vehicleId,
    inactivityTimeoutMs: autoConfig.inactivityTimeoutMs,
  });
  const startedAt = new Date().toISOString();
  const session = await createLocalSession(vehicleId, startedAt);
  useRecordingStore.getState().setSession({
    sessionId: session.id,
    vehicleId,
    startedAt,
    status: "idle",
  });
  try {
    useRecordingStore.getState().start();
    await updateLocalSession(session.id, { status: "recording" });
    await startBackgroundLocationUpdates();
  } catch (error) {
    await discardLocalSession(session.id);
    useRecordingStore.getState().reset();
    throw error;
  }
}

export async function enableAutomaticRecording(
  settings: AutoRecordingSettings,
): Promise<void> {
  if (!settings.vehicleId) {
    throw new Error("Selecciona un vehículo para la detección automática.");
  }
  if (await getUnfinishedSession()) {
    throw new Error(
      "Finaliza o descarta la grabación activa antes de activar la detección automática.",
    );
  }

  await saveAutoRecordingSettings({ ...settings, enabled: true });
  try {
    await startBackgroundLocationUpdates("automatic");
  } catch (error) {
    await saveAutoRecordingSettings({ ...settings, enabled: false });
    throw error;
  }
}

export async function disableAutomaticRecording(): Promise<void> {
  const config = await getAutoRecordingConfig();
  if (await getUnfinishedSession()) {
    throw new Error(
      "Finaliza o pausa la actividad activa antes de desactivar la detección automática.",
    );
  }
  await saveAutoRecordingSettings({ ...config, enabled: false });
  await stopBackgroundLocationUpdates();
}

export async function restoreAutomaticRecording(): Promise<boolean> {
  const config = await getAutoRecordingConfig();
  if (!config.enabled || !config.vehicleId || (await getUnfinishedSession())) {
    return false;
  }
  await startBackgroundLocationUpdates("automatic");
  return true;
}

export async function pauseRecording(): Promise<void> {
  const store = useRecordingStore.getState();
  if (!store.sessionId) {
    throw new Error("No hay una sesión de grabación activa.");
  }
  await disableAutoRecordingPreference();
  const now = Date.now();
  const elapsedMs =
    store.elapsedMs + Math.max(0, now - (store.activeSinceMs ?? now));
  await updateLocalSession(store.sessionId, {
    status: "paused",
    elapsedMs,
  });
  store.pause(now);
  await stopBackgroundLocationUpdates();
}

export async function resumeRecording(): Promise<void> {
  const store = useRecordingStore.getState();
  if (!store.sessionId) {
    throw new Error("No hay una sesión para reanudar.");
  }
  store.resume();
  await updateLocalSession(store.sessionId, { status: "recording" });
  try {
    await startBackgroundLocationUpdates();
  } catch (error) {
    useRecordingStore.getState().pause();
    await updateLocalSession(store.sessionId, {
      status: "paused",
      elapsedMs: useRecordingStore.getState().elapsedMs,
    });
    throw error;
  }
}

export async function finishRecording(
  endedAtOverride?: string,
  responsibleDrivingConfirmed = false,
): Promise<void> {
  const beforeFinish = useRecordingStore.getState();
  if (!beforeFinish.sessionId || !beforeFinish.vehicleId) {
    throw new Error("No hay una sesión de grabación activa.");
  }
  if (beforeFinish.status !== "recording" && beforeFinish.status !== "paused") {
    throw new Error("La sesión no se puede finalizar en su estado actual.");
  }
  await disableAutoRecordingPreference();
  await stopBackgroundLocationUpdates();
  const points = await getLocalPoints(beforeFinish.sessionId);
  if (points.length < 2) {
    const now = Date.now();
    const elapsedMs =
      beforeFinish.elapsedMs +
      Math.max(0, now - (beforeFinish.activeSinceMs ?? now));
    await updateLocalSession(beforeFinish.sessionId, {
      status: "paused",
      elapsedMs,
    });
    if (beforeFinish.status === "recording") {
      beforeFinish.pause(now);
    }
    throw new Error(
      "Se necesitan al menos dos puntos GPS para guardar la ruta.",
    );
  }

  const finishedTimestamp = Date.now();
  const finishedAt = new Date(finishedTimestamp).toISOString();
  const elapsedMs =
    beforeFinish.elapsedMs +
    (beforeFinish.status === "recording"
      ? Math.max(
          0,
          finishedTimestamp - (beforeFinish.activeSinceMs ?? finishedTimestamp),
        )
      : 0);
  const sessionId = beforeFinish.sessionId;
  const vehicleId = beforeFinish.vehicleId;
  if (!sessionId || !vehicleId) {
    throw new Error("La sesión de grabación no tiene vehículo asociado.");
  }
  await finishLocalSession(sessionId, finishedAt, elapsedMs, {
    vehicleId,
    startedAt: beforeFinish.startedAt ?? points[0].recordedAt,
    endedAt: endedAtOverride ?? finishedAt,
    responsibleDrivingConfirmed,
    points,
  });
  useRecordingStore.getState().finish(finishedTimestamp);
  await syncActivityUploadQueue();
}

export async function restoreUnfinishedRecording(): Promise<boolean> {
  const session = await getUnfinishedSession();
  if (!session) {
    return false;
  }
  const points = await getLocalPoints(session.id);
  if (session.status === "recording") {
    await stopBackgroundLocationUpdates();
    await updateLocalSession(session.id, { status: "paused" });
  }
  useRecordingStore.getState().setSession({
    sessionId: session.id,
    vehicleId: session.vehicleId,
    startedAt: session.startedAt,
    status: "paused",
    elapsedMs: session.elapsedMs,
    points,
  });
  return true;
}

export async function discardRecording(): Promise<void> {
  const sessionId = useRecordingStore.getState().sessionId;
  if (sessionId) {
    await disableAutoRecordingPreference();
    await stopBackgroundLocationUpdates();
    await discardLocalSession(sessionId);
  }
  useRecordingStore.getState().reset();
}

async function disableAutoRecordingPreference(): Promise<void> {
  const config = await getAutoRecordingConfig();
  if (config.enabled) {
    await saveAutoRecordingSettings({ ...config, enabled: false });
  }
}
