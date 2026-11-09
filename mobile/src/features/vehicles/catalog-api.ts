import { client } from "../../lib/api/client";
import type { CatalogVersion, VehicleType } from "./types";

export function fetchCatalogBrands(type: VehicleType): Promise<string[]> {
  return client
    .get<string[]>("/catalog/brands", { params: { type } })
    .then((response) => response.data);
}

export function fetchCatalogModels(
  type: VehicleType,
  brand: string,
): Promise<string[]> {
  return client
    .get<string[]>("/catalog/models", { params: { type, brand } })
    .then((response) => response.data);
}

export function fetchCatalogVersions(
  type: VehicleType,
  brand: string,
  model: string,
): Promise<CatalogVersion[]> {
  return client
    .get<CatalogVersion[]>("/catalog/versions", {
      params: { type, brand, model },
    })
    .then((response) => response.data);
}
