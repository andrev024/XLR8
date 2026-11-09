import { create } from "zustand";
import {
  transitionRecordingStatus,
  type RecordingStatus,
  type TrackPoint,
} from "./recording-logic";
import type { CompletedCircuitAttempt } from "../circuits/types";

export interface RecordingSessionState {
  status: RecordingStatus;
  sessionId: string | null;
  vehicleId: string | null;
  points: TrackPoint[];
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number;
  activeSinceMs: number | null;
  syncMessage: string | null;
  circuitAttempts: CompletedCircuitAttempt[];
  setSession: (session: {
    sessionId: string;
    vehicleId: string;
    startedAt: string;
    status?: RecordingStatus;
    elapsedMs?: number;
    points?: TrackPoint[];
  }) => void;
  setPoints: (points: TrackPoint[]) => void;
  start: () => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  finish: (now?: number) => void;
  setSyncMessage: (message: string | null) => void;
  setCircuitAttempts: (attempts: CompletedCircuitAttempt[]) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as const,
  sessionId: null,
  vehicleId: null,
  points: [] as TrackPoint[],
  startedAt: null,
  finishedAt: null,
  elapsedMs: 0,
  activeSinceMs: null,
  syncMessage: null,
  circuitAttempts: [] as CompletedCircuitAttempt[],
};

export const useRecordingStore = create<RecordingSessionState>((set, get) => ({
  ...initialState,
  setSession: (session) =>
    set({
      status: session.status ?? "paused",
      sessionId: session.sessionId,
      vehicleId: session.vehicleId,
      startedAt: session.startedAt,
      points: session.points ?? [],
      elapsedMs: session.elapsedMs ?? 0,
      activeSinceMs: null,
      finishedAt: null,
      syncMessage: null,
    }),
  setPoints: (points) => set({ points }),
  start: () => {
    const status = transitionRecordingStatus(get().status, { type: "START" });
    set({ status, activeSinceMs: Date.now() });
  },
  pause: (now = Date.now()) => {
    const state = get();
    const status = transitionRecordingStatus(state.status, { type: "PAUSE" });
    set({
      status,
      elapsedMs:
        state.elapsedMs + Math.max(0, now - (state.activeSinceMs ?? now)),
      activeSinceMs: null,
    });
  },
  resume: (now = Date.now()) => {
    const status = transitionRecordingStatus(get().status, { type: "RESUME" });
    set({ status, activeSinceMs: now });
  },
  finish: (now = Date.now()) => {
    const state = get();
    const status = transitionRecordingStatus(state.status, { type: "FINISH" });
    set({
      status,
      finishedAt: new Date(now).toISOString(),
      elapsedMs:
        state.status === "recording"
          ? state.elapsedMs + Math.max(0, now - (state.activeSinceMs ?? now))
          : state.elapsedMs,
      activeSinceMs: null,
    });
  },
  setSyncMessage: (syncMessage) => set({ syncMessage }),
  setCircuitAttempts: (circuitAttempts) => set({ circuitAttempts }),
  reset: () => set(initialState),
}));
