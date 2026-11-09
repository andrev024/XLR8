import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import {
  fetchCircuit,
  fetchCircuits,
  fetchLeaderboard,
  fetchMyCircuitAttempts,
  fetchMyLeaderboardSummary,
} from "./api";
import type { LeaderboardCategory } from "./types";

const circuitsKey = ["circuits"] as const;

export function useCircuitsQuery(
  location: Location.LocationObjectCoords | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [...circuitsKey, location?.latitude, location?.longitude],
    queryFn: () => fetchCircuits(location),
    enabled,
  });
}

export function useCircuitQuery(id: string) {
  return useQuery({
    queryKey: [...circuitsKey, id],
    queryFn: () => fetchCircuit(id),
    enabled: Boolean(id),
  });
}

export function useCircuitLeaderboardQuery(
  id: string,
  category: LeaderboardCategory,
) {
  return useQuery({
    queryKey: [...circuitsKey, id, "leaderboard", category],
    queryFn: () => fetchLeaderboard(id, category),
    enabled: Boolean(id),
  });
}

export function useMyLeaderboardSummaryQuery(
  id: string,
  category: LeaderboardCategory,
) {
  return useQuery({
    queryKey: [...circuitsKey, id, "leaderboard", "me", category],
    queryFn: () => fetchMyLeaderboardSummary(id, category),
    enabled: Boolean(id),
  });
}

export function useMyCircuitAttemptsQuery(id: string) {
  return useQuery({
    queryKey: [...circuitsKey, id, "my-attempts"],
    queryFn: () => fetchMyCircuitAttempts(id),
    enabled: Boolean(id),
  });
}
