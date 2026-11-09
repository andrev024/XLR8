import { VehicleType, PowerCategory } from '../../generated/prisma';
import { calculatePowerCategory } from './power-category';

describe('calculatePowerCategory', () => {
  describe('MOTORCYCLE', () => {
    it('returns LOW below 50 hp', () => {
      expect(calculatePowerCategory(VehicleType.MOTORCYCLE, 49)).toBe(
        PowerCategory.LOW,
      );
    });

    it('returns MID at the 50 hp boundary', () => {
      expect(calculatePowerCategory(VehicleType.MOTORCYCLE, 50)).toBe(
        PowerCategory.MID,
      );
    });

    it('returns MID at the 100 hp boundary', () => {
      expect(calculatePowerCategory(VehicleType.MOTORCYCLE, 100)).toBe(
        PowerCategory.MID,
      );
    });

    it('returns HIGH above 100 hp', () => {
      expect(calculatePowerCategory(VehicleType.MOTORCYCLE, 101)).toBe(
        PowerCategory.HIGH,
      );
    });
  });

  describe('CAR', () => {
    it('returns LOW below 120 hp', () => {
      expect(calculatePowerCategory(VehicleType.CAR, 119)).toBe(
        PowerCategory.LOW,
      );
    });

    it('returns MID at the 120 hp boundary', () => {
      expect(calculatePowerCategory(VehicleType.CAR, 120)).toBe(
        PowerCategory.MID,
      );
    });

    it('returns MID at the 250 hp boundary', () => {
      expect(calculatePowerCategory(VehicleType.CAR, 250)).toBe(
        PowerCategory.MID,
      );
    });

    it('returns HIGH above 250 hp', () => {
      expect(calculatePowerCategory(VehicleType.CAR, 251)).toBe(
        PowerCategory.HIGH,
      );
    });
  });
});
