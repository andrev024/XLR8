import { Injectable } from '@nestjs/common';
import { VehicleType } from '../../generated/prisma';
import vehicleCatalog from './data/vehicles.json';

export interface VehicleCatalogEntry {
  type: VehicleType;
  brand: string;
  model: string;
  version?: string;
  yearFrom?: number;
  yearTo?: number | null;
  horsepower?: number;
  source?: string;
}

export interface VehicleCatalogVersion {
  version: string;
  yearFrom: number;
  yearTo: number | null;
  horsepower: number;
  source: string;
}

type VehicleCatalogVersionEntry = VehicleCatalogEntry &
  Required<
    Pick<
      VehicleCatalogEntry,
      'version' | 'yearFrom' | 'yearTo' | 'horsepower' | 'source'
    >
  >;

const catalogEntries = vehicleCatalog as VehicleCatalogEntry[];

@Injectable()
export class CatalogService {
  findBrands(type: VehicleType): string[] {
    return this.uniqueSorted(
      catalogEntries
        .filter((entry) => entry.type === type)
        .map((entry) => entry.brand),
    );
  }

  findModels(type: VehicleType, brand: string): string[] {
    return this.uniqueSorted(
      catalogEntries
        .filter((entry) => entry.type === type && entry.brand === brand)
        .map((entry) => entry.model),
    );
  }

  findVersions(
    type: VehicleType,
    brand: string,
    model: string,
  ): VehicleCatalogVersion[] {
    return catalogEntries
      .filter(
        (entry) =>
          entry.type === type && entry.brand === brand && entry.model === model,
      )
      .filter(
        (entry): entry is VehicleCatalogVersionEntry =>
          entry.version !== undefined &&
          entry.yearFrom !== undefined &&
          entry.yearTo !== undefined &&
          entry.horsepower !== undefined &&
          entry.source !== undefined,
      )
      .map(({ version, yearFrom, yearTo, horsepower, source }) => ({
        version,
        yearFrom,
        yearTo,
        horsepower,
        source,
      }))
      .sort((left, right) => left.yearFrom - right.yearFrom);
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) =>
      left.localeCompare(right, 'es'),
    );
  }
}
