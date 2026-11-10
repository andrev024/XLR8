import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  appendLocalPoints,
  createLocalSession,
  finishLocalSession,
  getAutoRecordingConfig,
  getLocalPoints,
  getUnfinishedSession,
  updateAutoRecordingProgress,
  updateLocalSession,
} from "./database";
import {
  DEFAULT_AUTO_INACTIVITY_TIMEOUT_MS,
  evaluateAutoStart,
  filterTrackPoints,
  pointSpeedKmh,
  type TrackPoint,
} from "./recording-logic";
import { useRecordingStore } from "./store";
import { syncActivityUploadQueue } from "./upload-queue";

export const LOCATION_TASK_NAME = "xlr8-background-route-recording";
const AUTO_RESUME_SPEED_KMH = 5;

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error("Error en la tarea de ubicación de XLR8:", error);
      return;
    }

    const locations = (
      data as { locations?: Location.LocationObject[] } | undefined
    )?.locations;
    if (!locations?.length) {
      return;
    }

    const points: TrackPoint[] = locations.map((location) => ({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      recordedAt: new Date(location.timestamp).toISOString(),
      speedMs: location.coords.speed,
      accuracy: location.coords.accuracy,
      altitudeMeters: location.coords.altitude,
    }));

    try {
      await processRecordingLocations(points);
    } catch (writeError) {
      console.error(
        "No se pudo guardar una ubicación de XLR8 en SQLite:",
        writeError,
      );
    }
  });
}

export async function processRecordingLocations(
  incomingPoints: TrackPoint[],
): Promise<void> {
  const points = filterTrackPoints(incomingPoints);
  if (points.length === 0) {
    return;
  }

  const config = await getAutoRecordingConfig();
  let session = await getUnfinishedSession();

  if (session?.status === "paused" && !config.enabled) {
    return;
  }

  if (!session) {
    if (!config.enabled || !config.vehicleId) {
      return;
    }

    const detection = evaluateAutoStart(config.candidatePoints, points);
    if (!detection.startedPoints) {
      await updateAutoRecordingProgress(detection.candidatePoints, null);
      return;
    }

    const startedPoints = detection.startedPoints;
    const startedAt = startedPoints[0].recordedAt;
    const latestStartedPoint = startedPoints[startedPoints.length - 1];
    session = await createLocalSession(config.vehicleId, startedAt);
    const initialElapsedMs = Math.max(
      0,
      Date.parse(latestStartedPoint.recordedAt) - Date.parse(startedAt),
    );
    await updateLocalSession(session.id, {
      status: "recording",
      elapsedMs: initialElapsedMs,
    });
    const savedPoints = await appendLocalPoints(session.id, startedPoints);
    useRecordingStore.getState().setSession({
      sessionId: session.id,
      vehicleId: config.vehicleId,
      startedAt,
      status: "idle",
      elapsedMs: initialElapsedMs,
      points: savedPoints,
    });
    useRecordingStore.getState().start();
    await updateAutoRecordingProgress([], latestStartedPoint.recordedAt);

    const remainingPoints = points.filter(
      (point) =>
        Date.parse(point.recordedAt) >
        Date.parse(latestStartedPoint.recordedAt),
    );
    if (remainingPoints.length === 0) {
      return;
    }
    points.splice(0, points.length, ...remainingPoints);
  }

  const savedPoints = await appendLocalPoints(session.id, points);
  const store = useRecordingStore.getState();
  if (savedPoints.length > 0 && store.sessionId === session.id) {
    store.setPoints([...store.points, ...savedPoints]);
  }

  if (!config.enabled) {
    return;
  }

  const localPoints = await getLocalPoints(session.id);
  let lastMovementAt = config.lastMovementAt ?? session.startedAt;
  let previous =
    localPoints.length > savedPoints.length
      ? localPoints[localPoints.length - savedPoints.length - 1]
      : undefined;
  let shouldFinish = false;
  for (const point of savedPoints) {
    const speedKmh = pointSpeedKmh(point, previous);
    if (speedKmh !== null && speedKmh >= AUTO_RESUME_SPEED_KMH) {
      lastMovementAt = point.recordedAt;
    }
    if (
      Date.parse(point.recordedAt) - Date.parse(lastMovementAt) >=
      Math.max(
        1_000,
        config.inactivityTimeoutMs || DEFAULT_AUTO_INACTIVITY_TIMEOUT_MS,
      )
    ) {
      shouldFinish = true;
      break;
    }
    previous = point;
  }

  if (!shouldFinish) {
    await updateAutoRecordingProgress([], lastMovementAt);
    return;
  }

  const finalPoints = localPoints.filter(
    (point) => Date.parse(point.recordedAt) <= Date.parse(lastMovementAt),
  );
  if (finalPoints.length < 2) {
    return;
  }
  const elapsedMs = Math.max(
    0,
    Date.parse(lastMovementAt) - Date.parse(session.startedAt),
  );
  await finishLocalSession(session.id, lastMovementAt, elapsedMs, {
    vehicleId: session.vehicleId,
    startedAt: session.startedAt,
    endedAt: lastMovementAt,
    responsibleDrivingConfirmed: false,
    points: finalPoints,
  });
  if (store.sessionId === session.id) {
    store.finish(Date.parse(lastMovementAt), elapsedMs);
  } else {
    store.setSession({
      sessionId: session.id,
      vehicleId: session.vehicleId,
      startedAt: session.startedAt,
      status: "recording",
      elapsedMs,
      points: finalPoints,
    });
    store.finish(Date.parse(lastMovementAt), elapsedMs);
  }
  await updateAutoRecordingProgress([], null);
  await syncActivityUploadQueue();
}

export async function requestRecordingLocationPermissions(
  platform: typeof Platform.OS = Platform.OS,
): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Activa los servicios de ubicación para grabar.");
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    throw new Error("Debes permitir el acceso a la ubicación para grabar.");
  }

  if (platform === "ios") {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      throw new Error(
        "Permite la ubicación en segundo plano para mantener la grabación activa.",
      );
    }
  }
}

export async function startBackgroundLocationUpdates(
  mode: "manual" | "automatic" = "manual",
): Promise<void> {
  await requestRecordingLocationPermissions();

  const alreadyStarted =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy:
      mode === "automatic"
        ? Location.Accuracy.Balanced
        : Location.Accuracy.BestForNavigation,
    distanceInterval: mode === "automatic" ? 15 : 5,
    timeInterval: mode === "automatic" ? 5_000 : 3_000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "XLR8",
      notificationBody: "XLR8 está grabando tu ruta",
      notificationColor: "#C6FF00",
      killServiceOnDestroy: false,
    },
  });
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
