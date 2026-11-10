import type { PowerCategory, VehicleType } from "../vehicles/types";

export type { PowerCategory, VehicleType };

export interface CircuitLocation {
  lng: number;
  lat: number;
}

export interface Circuit {
  id: string;
  name: string;
  description: string | null;
  isAuthorizedClosed: boolean;
  lengthMeters: number;
  createdAt: string;
  distanceMeters?: number;
  location: CircuitLocation | null;
  referencePath: GeoJsonLineString | null;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteSegment {
  id: string;
  name: string;
  start: string;
  finish: string;
  distanceMeters: number;
  isClosedRoute?: boolean;
  path?: GeoJsonLineString;
}

export interface CircuitDetail extends Omit<Circuit, "location"> {
  startLine: GeoJsonLineString;
  finishLine: GeoJsonLineString;
  referencePath: GeoJsonLineString | null;
}

export interface LeaderboardEntry {
  position: number;
  attemptId: string;
  userId: string;
  displayName: string;
  durationMs: number;
  vehicleBrand: string;
  vehicleModel: string;
  horsepower: number;
  date: string;
}

export interface CompletedCircuitAttempt {
  id: string;
  circuitId: string;
  circuitName: string;
  durationMs: number;
  isValid: boolean;
  invalidReason: string | null;
  topThreePosition: number | null;
  rankingError: string | null;
}

export interface PersonalLeaderboardSummary {
  bestTimeMs: number | null;
  position: number | null;
}

export interface MyCircuitAttempt {
  id: string;
  durationMs: number;
  maxSpeedKmh: number;
  isValid: boolean;
  invalidReason: string | null;
  vehicleType: VehicleType;
  powerCategory: PowerCategory;
  startedAt: string;
  createdAt: string;
}

export interface LeaderboardCategory {
  vehicleType: VehicleType;
  powerCategory: PowerCategory;
  period: LeaderboardPeriod;
}

export type LeaderboardPeriod = "ALL_TIME" | "WEEK" | "MONTH" | "YEAR";
