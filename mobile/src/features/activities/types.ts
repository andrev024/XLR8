export interface ActivityVehicle {
  id: string;
  type: "MOTORCYCLE" | "CAR";
  brand: string;
  model: string;
}

export interface CircuitAttempt {
  id: string;
  durationMs: number;
  isValid: boolean;
  invalidReason: string | null;
  circuit: { id: string; name: string };
}

export interface Activity {
  id: string;
  vehicleId: string;
  vehicle: ActivityVehicle;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  simplifiedPath?: {
    type: "LineString";
    coordinates: [number, number][];
  } | null;
  circuitAttempts?: CircuitAttempt[];
}

export interface PaginatedActivities {
  items: Activity[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateActivityInput {
  vehicleId: string;
  startedAt: string;
  endedAt: string;
  points: {
    lat: number;
    lng: number;
    recordedAt: string;
    speedMs: number | null;
    accuracy: number | null;
  }[];
}

export interface ActivityCreationResult {
  activity: Activity;
  detectedAttempts: {
    id: string;
    circuitId: string;
    durationMs: number;
    isValid: boolean;
    invalidReason: string | null;
  }[];
}
