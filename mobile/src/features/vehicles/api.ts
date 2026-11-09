import { client } from "../../lib/api/client";
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "./types";

export function fetchVehicles(): Promise<Vehicle[]> {
  return client.get<Vehicle[]>("/vehicles").then((res) => res.data);
}

export function fetchVehicle(id: string): Promise<Vehicle> {
  return client.get<Vehicle>(`/vehicles/${id}`).then((res) => res.data);
}

export function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return client.post<Vehicle>("/vehicles", input).then((res) => res.data);
}

export function updateVehicle(
  id: string,
  input: UpdateVehicleInput,
): Promise<Vehicle> {
  return client
    .patch<Vehicle>(`/vehicles/${id}`, input)
    .then((res) => res.data);
}

export function deleteVehicle(id: string): Promise<void> {
  return client.delete(`/vehicles/${id}`).then(() => undefined);
}
