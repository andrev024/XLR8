import type { Vehicle } from "../vehicles/types";
import type { LeaderboardCategory, PowerCategory, VehicleType } from "./types";

export const POWER_CATEGORIES: PowerCategory[] = ["LOW", "MID", "HIGH"];
export const VEHICLE_TYPES: VehicleType[] = ["MOTORCYCLE", "CAR"];

export function getInitialLeaderboardCategory(
  vehicles: Vehicle[],
): LeaderboardCategory {
  const preferredVehicle = vehicles[0];
  return preferredVehicle
    ? {
        vehicleType: preferredVehicle.type,
        powerCategory: preferredVehicle.powerCategory,
        period: "ALL_TIME",
      }
    : {
        vehicleType: "MOTORCYCLE",
        powerCategory: "LOW",
        period: "ALL_TIME",
      };
}

export function updateLeaderboardCategory(
  current: LeaderboardCategory,
  change: Partial<LeaderboardCategory>,
): LeaderboardCategory {
  return { ...current, ...change };
}

export function formatLeaderboardTime(milliseconds: number): string {
  const safeMs = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const remainder = safeMs % 1_000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
}

export function distanceBetweenMeters(
  from: { latitude: number; longitude: number },
  to: { lat: number; lng: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.latitude);
  const longitudeDelta = toRadians(to.lng - from.longitude);
  const latitudeA = toRadians(from.latitude);
  const latitudeB = toRadians(to.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(value));
}

export function sortCircuitsByDistance<
  T extends { location: { lat: number; lng: number } | null },
>(
  circuits: T[],
  currentLocation: { latitude: number; longitude: number } | null,
): T[] {
  if (!currentLocation) {
    return [...circuits];
  }
  return [...circuits].sort((a, b) => {
    const distanceA = a.location
      ? distanceBetweenMeters(currentLocation, a.location)
      : Number.POSITIVE_INFINITY;
    const distanceB = b.location
      ? distanceBetweenMeters(currentLocation, b.location)
      : Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });
}
