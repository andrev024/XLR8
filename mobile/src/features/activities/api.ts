import { client } from "../../lib/api/client";
import type {
  Activity,
  ActivityCreationResult,
  CreateActivityInput,
  PaginatedActivities,
} from "./types";

export function fetchActivities(
  page: number,
  limit = 20,
): Promise<PaginatedActivities> {
  return client
    .get<PaginatedActivities>("/activities", { params: { page, limit } })
    .then((response) => response.data);
}

export function fetchActivity(id: string): Promise<Activity> {
  return client
    .get<Activity>(`/activities/${encodeURIComponent(id)}`)
    .then((response) => response.data);
}

export function createActivity(
  input: CreateActivityInput,
): Promise<ActivityCreationResult> {
  return client
    .post<ActivityCreationResult>("/activities", input)
    .then((response) => response.data);
}

export async function deleteActivity(id: string): Promise<void> {
  await client.delete(`/activities/${encodeURIComponent(id)}`);
}
