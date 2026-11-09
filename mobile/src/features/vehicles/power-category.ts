import type { PowerCategory, VehicleType } from "./types";

export function calculatePowerCategory(
  type: VehicleType,
  horsepower: number,
): PowerCategory {
  if (type === "MOTORCYCLE") {
    if (horsepower < 50) return "LOW";
    if (horsepower <= 100) return "MID";
    return "HIGH";
  }

  if (horsepower < 120) return "LOW";
  if (horsepower <= 250) return "MID";
  return "HIGH";
}
