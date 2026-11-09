import * as Location from "expo-location";
import { client } from "../../lib/api/client";
import type {
  Circuit,
  CircuitDetail,
  LeaderboardCategory,
  LeaderboardEntry,
  MyCircuitAttempt,
  PersonalLeaderboardSummary,
} from "./types";

export async function fetchCircuits(
  _location: Location.LocationObjectCoords | null,
): Promise<Circuit[]> {
  const response = await client.get<Circuit[]>("/circuits");
  return response.data;
}

export async function fetchCircuit(id: string): Promise<CircuitDetail> {
  const response = await client.get<CircuitDetail>(
    `/circuits/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function fetchLeaderboard(
  id: string,
  category: LeaderboardCategory,
): Promise<LeaderboardEntry[]> {
  const response = await client.get<LeaderboardEntry[]>(
    `/circuits/${encodeURIComponent(id)}/leaderboard`,
    { params: category },
  );
  return response.data;
}

export async function fetchMyLeaderboardSummary(
  id: string,
  category: LeaderboardCategory,
): Promise<PersonalLeaderboardSummary> {
  const response = await client.get<PersonalLeaderboardSummary>(
    `/circuits/${encodeURIComponent(id)}/leaderboard/me`,
    { params: category },
  );
  return response.data;
}

export async function fetchMyCircuitAttempts(
  id: string,
): Promise<MyCircuitAttempt[]> {
  const response = await client.get<MyCircuitAttempt[]>(
    `/circuits/${encodeURIComponent(id)}/my-attempts`,
  );
  return response.data;
}
