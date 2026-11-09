import { PowerCategory, VehicleType } from '../../generated/prisma';

/**
 * Categoriza la potencia de un vehículo según su tipo. Pura, sin dependencias externas.
 * MOTORCYCLE: LOW < 50 hp, MID 50-100 hp, HIGH > 100 hp
 * CAR:        LOW < 120 hp, MID 120-250 hp, HIGH > 250 hp
 */
export function calculatePowerCategory(
  type: VehicleType,
  horsepower: number,
): PowerCategory {
  if (type === VehicleType.MOTORCYCLE) {
    if (horsepower < 50) return PowerCategory.LOW;
    if (horsepower <= 100) return PowerCategory.MID;
    return PowerCategory.HIGH;
  }

  if (horsepower < 120) return PowerCategory.LOW;
  if (horsepower <= 250) return PowerCategory.MID;
  return PowerCategory.HIGH;
}
