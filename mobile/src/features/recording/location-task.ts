import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { appendLocalPoints, getUnfinishedSession } from "./database";
import type { TrackPoint } from "./recording-logic";
import { useRecordingStore } from "./store";

export const LOCATION_TASK_NAME = "xlr8-background-route-recording";

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
    }));

    try {
      const session = await getUnfinishedSession();
      if (!session || session.status !== "recording") {
        return;
      }
      const savedPoints = await appendLocalPoints(session.id, points);
      const store = useRecordingStore.getState();
      if (savedPoints.length > 0 && store.sessionId === session.id) {
        store.setPoints([...store.points, ...savedPoints]);
      }
    } catch (writeError) {
      console.error(
        "No se pudo guardar una ubicación de XLR8 en SQLite:",
        writeError,
      );
    }
  });
}

export async function startBackgroundLocationUpdates(): Promise<void> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    throw new Error("Debes permitir el acceso a la ubicación para grabar.");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    throw new Error(
      "Permite la ubicación en segundo plano para mantener la grabación activa.",
    );
  }

  const alreadyStarted =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    timeInterval: 3_000,
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
