import { client } from "../../lib/api/client";
import type {
  Activity,
  ActivityAchievement,
  ActivityCreationResult,
  ActivityFilters,
  ActivitySummary,
  CreateActivityInput,
  PaginatedActivities,
} from "./types";

export function fetchActivities(
  page: number,
  limit = 20,
  filters: ActivityFilters = {},
): Promise<PaginatedActivities> {
  return client
    .get<PaginatedActivities>("/activities", {
      params: { page, limit, ...filters },
    })
    .then((response) => response.data);
}

export function fetchActivity(id: string): Promise<Activity> {
  return client
    .get<Activity>(`/activities/${encodeURIComponent(id)}`)
    .then((response) => response.data);
}

export function fetchActivitySummary(): Promise<ActivitySummary> {
  return client
    .get<ActivitySummary>("/activities/summary")
    .then((response) => response.data);
}

export function fetchActivityAchievements(): Promise<ActivityAchievement[]> {
  return client
    .get<ActivityAchievement[]>("/activities/achievements")
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
