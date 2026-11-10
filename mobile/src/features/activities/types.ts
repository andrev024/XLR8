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
  movingDurationSeconds?: number;
  stoppedDurationSeconds?: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainMeters?: number;
  averageAccuracyMeters?: number | null;
  estimatedFuelLiters?: number | null;
  responsibleDrivingConfirmed?: boolean;
  responsibleDrivingDurationSeconds?: number;
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

export interface ActivityPeriodSummary {
  activityCount: number;
  distanceMeters: number;
  durationSeconds: number;
  movingDurationSeconds: number;
  stoppedDurationSeconds: number;
  responsibleDrivingDurationSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
}

export interface ActivitySummary {
  week: ActivityPeriodSummary;
  month: ActivityPeriodSummary;
  year: ActivityPeriodSummary;
}

export interface ActivityAchievement {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  unlocked: boolean;
}

export interface ActivityFilters {
  vehicleId?: string;
  dateFrom?: string;
  dateTo?: string;
  minDistanceMeters?: number;
  maxDistanceMeters?: number;
}

export interface CreateActivityInput {
  vehicleId: string;
  startedAt: string;
  endedAt: string;
  responsibleDrivingConfirmed?: boolean;
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
