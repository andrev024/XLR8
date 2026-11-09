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
  powerCategory: PowerCategory;
  createdAt: string;
}

export interface CreateVehicleInput {
  type: VehicleType;
  brand: string;
  model: string;
  year: number;
  horsepower: number;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;
