import { createActivity } from "../activities/api";
import { fetchCircuit, fetchLeaderboard } from "../circuits/api";
import type { CompletedCircuitAttempt } from "../circuits/types";
import { fetchVehicle } from "../vehicles/api";
import type { Vehicle } from "../vehicles/types";
import {
  getPendingUploads,
  markUploadFailed,
  markUploadSynced,
} from "./database";
import { syncQueuedActivities, type TrackPoint } from "./recording-logic";
import { useRecordingStore } from "./store";

export interface ActivityUploadPayload {
  vehicleId: string;
  startedAt: string;
  endedAt: string;
  points: TrackPoint[];
}

interface ActivityUploadResult {
  activityId: string;
  circuitAttempts: CompletedCircuitAttempt[];
}

let syncInProgress: Promise<void> | null = null;

export function syncActivityUploadQueue(): Promise<void> {
  if (syncInProgress) {
    return syncInProgress;
  }

  syncInProgress = syncQueue().finally(() => {
    syncInProgress = null;
  });
  return syncInProgress;
}

async function syncQueue(): Promise<void> {
  const queue = await getPendingUploads();
  if (queue.length === 0) {
    return;
  }

  const results = await syncQueuedActivities(
    queue.map((item) => ({
      ...item,
      payload: JSON.parse(item.payload) as ActivityUploadPayload,
    })),
    async (payload) => {
      const response = await createActivity(payload as ActivityUploadPayload);
      return {
        activityId: response.activity.id,
        circuitAttempts: await summarizeCircuitAttempts(response.detectedAttempts, payload),
      } satisfies ActivityUploadResult;
    },
    async (sessionId, result) => {
      if (!isActivityUploadResult(result)) {
        throw new Error("La API no devolvió el identificador de la actividad.");
      }
      await markUploadSynced(sessionId, result.activityId);
      if (useRecordingStore.getState().sessionId === sessionId) {
        useRecordingStore.getState().setCircuitAttempts(result.circuitAttempts);
      }
    },
    async (sessionId, attempts, error) => {
      await markUploadFailed(sessionId, attempts, error.message);
    },
  );

  const failedIds = new Set(results.failures.map((failure) => failure.id));
  if (failedIds.size > 0) {
    useRecordingStore
      .getState()
      .setSyncMessage(
        "La actividad quedó guardada en el dispositivo y se reintentará cuando vuelva la conexión.",
      );
  } else if (results.syncedIds.length > 0) {
    useRecordingStore.getState().setSyncMessage(null);
  }

  async function summarizeCircuitAttempts(
    detectedAttempts: {
      id: string;
      circuitId: string;
      durationMs: number;
      isValid: boolean;
      invalidReason: string | null;
    }[],
    payload: unknown,
  ): Promise<CompletedCircuitAttempt[]> {
    let vehicle: Vehicle | null = null;
    if (
      typeof payload === "object" &&
      payload !== null &&
      "vehicleId" in payload &&
      typeof payload.vehicleId === "string"
    ) {
      try {
        vehicle = await fetchVehicle(payload.vehicleId);
      } catch (error) {
        console.error("No se pudo cargar el vehículo para clasificar el intento:", error);
      }
    }

    return Promise.all(
      detectedAttempts.map(async (attempt) => {
        const summary: CompletedCircuitAttempt = {
          ...attempt,
          circuitName: attempt.circuitId,
          topThreePosition: null,
          rankingError: null,
        };
        if (!attempt.isValid) {
          return summary;
        }
        if (!vehicle) {
          return {
            ...summary,
            rankingError: "No se pudo determinar la categoría del vehículo.",
          };
        }
        try {
          const [circuit, leaderboard] = await Promise.all([
            fetchCircuit(attempt.circuitId),
            fetchLeaderboard(attempt.circuitId, {
              vehicleType: vehicle.type,
              powerCategory: vehicle.powerCategory,
            }),
          ]);
          const rankingEntry = leaderboard.find(
            (entry) => entry.attemptId === attempt.id,
          );
          return {
            ...summary,
            circuitName: circuit.name,
            topThreePosition: rankingEntry?.position ?? null,
          };
        } catch (error) {
          return {
            ...summary,
            rankingError:
              error instanceof Error
                ? error.message
                : "No se pudo consultar la posición del intento.",
          };
        }
      }),
    );
  }

  function isActivityUploadResult(value: unknown): value is ActivityUploadResult {
    if (typeof value !== "object" || value === null || !("activityId" in value)) {
      return false;
    }
    return (
      typeof value.activityId === "string" &&
      "circuitAttempts" in value &&
      Array.isArray(value.circuitAttempts)
    );
  }
}
