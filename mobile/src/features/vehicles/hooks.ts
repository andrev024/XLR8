import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogBrands,
  fetchCatalogModels,
  fetchCatalogVersions,
} from "./catalog-api";
import {
  createVehicle,
  deleteVehicle,
  fetchVehicle,
  fetchVehicles,
  updateVehicle,
} from "./api";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleType,
} from "./types";

const vehiclesKey = ["vehicles"] as const;
const vehicleKey = (id: string) => ["vehicles", id] as const;
const catalogStaleTime = 24 * 60 * 60 * 1000;

export function useCatalogBrandsQuery(type: VehicleType) {
  return useQuery({
    queryKey: ["catalog", "brands", type],
    queryFn: () => fetchCatalogBrands(type),
    staleTime: catalogStaleTime,
  });
}

export function useCatalogModelsQuery(
  type: VehicleType,
  brand: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["catalog", "models", type, brand],
    queryFn: () => fetchCatalogModels(type, brand),
    enabled: enabled && Boolean(brand),
    staleTime: catalogStaleTime,
  });
}

export function useCatalogVersionsQuery(
  type: VehicleType,
  brand: string,
  model: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["catalog", "versions", type, brand, model],
    queryFn: () => fetchCatalogVersions(type, brand, model),
    enabled: enabled && Boolean(brand && model),
    staleTime: catalogStaleTime,
  });
}

export function useVehiclesQuery() {
  return useQuery({ queryKey: vehiclesKey, queryFn: fetchVehicles });
}

export function useVehicleQuery(id: string) {
  return useQuery({
    queryKey: vehicleKey(id),
    queryFn: () => fetchVehicle(id),
    enabled: Boolean(id),
  });
}

export function useCreateVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => createVehicle(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehiclesKey });
    },
  });
}

export function useUpdateVehicleMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVehicleInput) => updateVehicle(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehiclesKey });
      void queryClient.invalidateQueries({ queryKey: vehicleKey(id) });
    },
  });
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehiclesKey });
    },
  });
}
