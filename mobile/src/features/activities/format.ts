export function formatDistance(meters: number): string {
  return meters >= 1_000
    ? `${(meters / 1_000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatAttemptDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2).padStart(5, "0");
  return minutes > 0 ? `${minutes}:${seconds}` : `${seconds} s`;
}
