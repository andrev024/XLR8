export type VehicleType = "MOTORCYCLE" | "CAR";
export type PowerCategory = "LOW" | "MID" | "HIGH";

export interface CatalogVersion {
  version: string;
  yearFrom: number;
  yearTo: number | null;
  horsepower: number;
  source: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  horsepower: number;
  engineDisplacementCc?: number | null;
  engineType?: string | null;
  weightKg?: number | null;
  fuelConsumptionLitersPer100Km?: number | null;
  powerCategory: PowerCategory;
  createdAt: string;
}

export interface CreateVehicleInput {
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  horsepower: number;
  engineDisplacementCc?: number;
  engineType?: string;
  weightKg?: number;
  fuelConsumptionLitersPer100Km?: number;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;
