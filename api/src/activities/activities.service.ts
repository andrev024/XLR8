import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CircuitAttemptsDetectorService } from '../circuits/circuit-attempts-detector.service';
import {
  haversineDistanceMeters,
  MAX_PLAUSIBLE_SPEED_KMH,
} from '../common/geo';
import {
  CreateActivityDto,
  CreateTrackPointDto,
} from './dto/create-activity.dto';
import { ListActivitiesQueryDto } from './dto/list-activities-query.dto';
import type { Activity, CircuitAttempt, Prisma } from '../../generated/prisma';

const MAX_ACCURACY_METERS = 50;
const TRACK_POINT_BATCH_SIZE = 1000;

export type ActivityListItem = Omit<Activity, 'path'>;

export interface ActivityVehicleSummary {
  id: string;
  type: 'MOTORCYCLE' | 'CAR';
  brand: string;
  model: string;
}

export type ActivityListItemWithVehicle = ActivityListItem & {
  vehicle: ActivityVehicleSummary;
};

export interface ActivityDetail extends ActivityListItem {
  simplifiedPath: GeoJsonLineString | null;
  vehicle: ActivityVehicleSummary;
  circuitAttempts: {
    id: string;
    durationMs: number;
    isValid: boolean;
    invalidReason: string | null;
    circuit: { id: string; name: string };
  }[];
}

export interface ActivityCreationResult {
  activity: ActivityListItemWithVehicle;
  detectedAttempts: CircuitAttempt[];
}

export interface PaginatedActivities {
  items: ActivityListItemWithVehicle[];
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

export interface ActivityAchievement {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  unlocked: boolean;
}

export interface FilteredPoint {
  lat: number;
  lng: number;
  recordedAt: Date;
  speedMs?: number;
  accuracy?: number;
  altitudeMeters?: number;
}

interface GeoJsonLineString {
  type: string;
  coordinates: [number, number][];
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptsDetector: CircuitAttemptsDetectorService,
  ) {}

  async create(
    userId: string,
    dto: CreateActivityDto,
  ): Promise<ActivityCreationResult> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, userId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehículo no encontrado');
    }

    const sortedPoints = [...dto.points].sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    const filteredPoints = filterPoints(sortedPoints);
    if (filteredPoints.length < 2) {
      throw new BadRequestException(
        'La actividad no tiene suficientes puntos válidos tras filtrar precisión y saltos de GPS',
      );
    }

    const stats = computeActivityStats(
      filteredPoints,
      dto.startedAt,
      dto.endedAt,
      vehicle.fuelConsumptionLitersPer100Km,
    );

    const activity = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SET LOCAL search_path TO public, extensions`;
      const createdActivity = await transaction.activity.create({
        data: {
          userId,
          vehicleId: dto.vehicleId,
          startedAt: new Date(dto.startedAt),
          endedAt: new Date(dto.endedAt),
          distanceMeters: stats.distanceMeters,
          durationSeconds: stats.durationSeconds,
          movingDurationSeconds: stats.movingDurationSeconds,
          stoppedDurationSeconds: stats.stoppedDurationSeconds,
          avgSpeedKmh: stats.avgSpeedKmh,
          maxSpeedKmh: stats.maxSpeedKmh,
          elevationGainMeters: stats.elevationGainMeters,
          averageAccuracyMeters: stats.averageAccuracyMeters,
          estimatedFuelLiters: stats.estimatedFuelLiters,
          responsibleDrivingConfirmed: dto.responsibleDrivingConfirmed === true,
          responsibleDrivingDurationSeconds:
            dto.responsibleDrivingConfirmed === true
              ? stats.movingDurationSeconds
              : 0,
        },
        include: {
          vehicle: {
            select: { id: true, type: true, brand: true, model: true },
          },
        },
      });

      await this.insertTrackPoints(
        transaction,
        createdActivity.id,
        filteredPoints,
      );
      await transaction.$executeRaw`
        UPDATE "Activity"
        SET "path" = (
          SELECT ST_MakeLine(
            ARRAY_AGG(
              ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
              ORDER BY "sequence"
            )
          )
          FROM "TrackPoint"
          WHERE "activityId" = ${createdActivity.id}
        )
        WHERE "id" = ${createdActivity.id}
      `;
      return createdActivity;
    });

    const detectedAttempts = await this.attemptsDetector.detectAndRecord(
      activity.id,
      userId,
      vehicle,
      filteredPoints,
    );

    return { activity, detectedAttempts };
  }

  async findAll(
    userId: string,
    query: ListActivitiesQueryDto,
  ): Promise<PaginatedActivities> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (
      query.dateFrom &&
      query.dateTo &&
      Date.parse(query.dateFrom) > Date.parse(query.dateTo)
    ) {
      throw new BadRequestException('dateFrom debe ser anterior a dateTo');
    }
    if (
      query.minDistanceMeters !== undefined &&
      query.maxDistanceMeters !== undefined &&
      query.minDistanceMeters > query.maxDistanceMeters
    ) {
      throw new BadRequestException(
        'minDistanceMeters no puede ser mayor que maxDistanceMeters',
      );
    }

    const where: Prisma.ActivityWhereInput = { userId };
    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }
    if (query.dateFrom || query.dateTo) {
      where.startedAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (
      query.minDistanceMeters !== undefined ||
      query.maxDistanceMeters !== undefined
    ) {
      where.distanceMeters = {
        ...(query.minDistanceMeters !== undefined
          ? { gte: query.minDistanceMeters }
          : {}),
        ...(query.maxDistanceMeters !== undefined
          ? { lte: query.maxDistanceMeters }
          : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vehicle: {
            select: { id: true, type: true, brand: true, model: true },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async summary(userId: string): Promise<{
    week: ActivityPeriodSummary;
    month: ActivityPeriodSummary;
    year: ActivityPeriodSummary;
  }> {
    const now = new Date();
    const weekStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    weekStart.setUTCDate(
      weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
    );
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const summarize = async (since: Date): Promise<ActivityPeriodSummary> => {
      const aggregate = await this.prisma.activity.aggregate({
        where: { userId, startedAt: { gte: since } },
        _count: { _all: true },
        _sum: {
          distanceMeters: true,
          durationSeconds: true,
          movingDurationSeconds: true,
          stoppedDurationSeconds: true,
          responsibleDrivingDurationSeconds: true,
        },
        _avg: { avgSpeedKmh: true },
        _max: { maxSpeedKmh: true },
      });
      return {
        activityCount: aggregate._count._all,
        distanceMeters: aggregate._sum.distanceMeters ?? 0,
        durationSeconds: aggregate._sum.durationSeconds ?? 0,
        movingDurationSeconds: aggregate._sum.movingDurationSeconds ?? 0,
        stoppedDurationSeconds: aggregate._sum.stoppedDurationSeconds ?? 0,
        responsibleDrivingDurationSeconds:
          aggregate._sum.responsibleDrivingDurationSeconds ?? 0,
        averageSpeedKmh: aggregate._avg.avgSpeedKmh ?? 0,
        maxSpeedKmh: aggregate._max.maxSpeedKmh ?? 0,
      };
    };

    const [week, month, year] = await Promise.all([
      summarize(weekStart),
      summarize(monthStart),
      summarize(yearStart),
    ]);
    return { week, month, year };
  }

  async achievements(userId: string): Promise<ActivityAchievement[]> {
    const [aggregate, dayRows, routeRows] = await Promise.all([
      this.prisma.activity.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: {
          distanceMeters: true,
          responsibleDrivingDurationSeconds: true,
        },
      }),
      this.prisma.$queryRaw<{ days: number }[]>`
        SELECT COUNT(DISTINCT DATE("startedAt"))::INTEGER AS "days"
        FROM "Activity"
        WHERE "userId" = ${userId}
      `,
      this.prisma.withPostgis(
        (transaction) =>
          transaction.$queryRaw<{ routes: number }[]>`
          SELECT COUNT(DISTINCT ST_AsText(ST_SnapToGrid("path", 0.001)))::INTEGER AS "routes"
          FROM "Activity"
          WHERE "userId" = ${userId} AND "path" IS NOT NULL
        `,
      ),
    ]);

    const totalDistanceKm = (aggregate._sum.distanceMeters ?? 0) / 1000;
    const totalActivities = aggregate._count._all;
    const distinctDays = dayRows[0]?.days ?? 0;
    const distinctRoutes = routeRows[0]?.routes ?? 0;
    const responsibleHours =
      (aggregate._sum.responsibleDrivingDurationSeconds ?? 0) / 3600;

    return [
      makeAchievement(
        'distance-25',
        'Primeros 25 km',
        'Acumula distancia en tus recorridos personales.',
        totalDistanceKm,
        25,
        'km',
      ),
      makeAchievement(
        'distance-100',
        '100 km registrados',
        'Sigue construyendo tu historial de rutas.',
        totalDistanceKm,
        100,
        'km',
      ),
      makeAchievement(
        'activities-10',
        'Diez recorridos',
        'Registra diez actividades.',
        totalActivities,
        10,
        'recorridos',
      ),
      makeAchievement(
        'consistency-7',
        'Constancia',
        'Registra recorridos en siete días diferentes.',
        distinctDays,
        7,
        'días',
      ),
      makeAchievement(
        'explorer-3',
        'Explorador',
        'Registra tres rutas distintas; la comparación usa una aproximación GPS.',
        distinctRoutes,
        3,
        'rutas',
      ),
      makeAchievement(
        'responsible-driving-1h',
        'Conducción responsable',
        'Acumula una hora de conducción que declaraste respetuosa de las normas.',
        responsibleHours,
        1,
        'horas declaradas',
      ),
    ];
  }

  async findOne(userId: string, id: string): Promise<ActivityDetail> {
    const activity = await this.prisma.activity.findFirst({
      where: { id, userId },
      include: {
        vehicle: {
          select: { id: true, type: true, brand: true, model: true },
        },
        circuitAttempts: {
          select: {
            id: true,
            durationMs: true,
            isValid: true,
            invalidReason: true,
            circuit: { select: { id: true, name: true } },
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }

    const rows = await this.prisma.withPostgis(
      (transaction) =>
        transaction.$queryRaw<{ geojson: string | null }[]>`
        SELECT ST_AsGeoJSON(COALESCE(
          (
            SELECT CASE
              WHEN "path" IS NULL THEN NULL
              WHEN ST_NPoints(ST_Simplify("path", 0.00005)) >= 2
                THEN ST_Simplify("path", 0.00005)
              ELSE "path"
            END
            FROM "Activity"
            WHERE "id" = ${id}
          ),
          (
            SELECT ST_MakeLine(
              ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
              ORDER BY "sequence"
            )
            FROM "TrackPoint"
            WHERE "activityId" = ${id}
            HAVING COUNT(*) >= 2
          )
        )) as geojson
      `,
    );
    const geojson = rows[0]?.geojson;
    const simplifiedPath = geojson
      ? (JSON.parse(geojson) as GeoJsonLineString)
      : null;

    return { ...activity, simplifiedPath };
  }

  async remove(userId: string, id: string): Promise<void> {
    const activity = await this.prisma.activity.findFirst({
      where: { id, userId },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }
    await this.prisma.activity.delete({ where: { id } });
  }

  private async insertTrackPoints(
    transaction: Prisma.TransactionClient,
    activityId: string,
    points: FilteredPoint[],
  ): Promise<void> {
    for (
      let offset = 0;
      offset < points.length;
      offset += TRACK_POINT_BATCH_SIZE
    ) {
      const batch = points.slice(offset, offset + TRACK_POINT_BATCH_SIZE);
      await transaction.trackPoint.createMany({
        data: batch.map((point, index) => ({
          activityId,
          lat: point.lat,
          lng: point.lng,
          recordedAt: point.recordedAt,
          speedMs: point.speedMs,
          accuracyMeters: point.accuracy,
          altitudeMeters: point.altitudeMeters,
          sequence: offset + index,
        })),
      });
    }
  }
}

function filterPoints(points: CreateTrackPointDto[]): FilteredPoint[] {
  const result: FilteredPoint[] = [];

  for (const raw of points) {
    if (raw.accuracy !== undefined && raw.accuracy > MAX_ACCURACY_METERS) {
      continue;
    }
    if (
      raw.speedMs !== undefined &&
      raw.speedMs * 3.6 > MAX_PLAUSIBLE_SPEED_KMH
    ) {
      continue;
    }

    const candidate: FilteredPoint = {
      lat: raw.lat,
      lng: raw.lng,
      recordedAt: new Date(raw.recordedAt),
      speedMs: raw.speedMs,
      accuracy: raw.accuracy,
      altitudeMeters: raw.altitudeMeters,
    };

    const previous = result[result.length - 1];
    if (previous) {
      const deltaMs =
        candidate.recordedAt.getTime() - previous.recordedAt.getTime();
      if (deltaMs <= 0) {
        continue; // descarta puntos duplicados o fuera de orden
      }
      const distance = haversineDistanceMeters(previous, candidate);
      const impliedSpeedKmh = (distance / (deltaMs / 1000)) * 3.6;
      if (impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
        continue; // salto imposible de GPS
      }
    }

    result.push(candidate);
  }

  return result;
}

export function computeActivityStats(
  points: FilteredPoint[],
  startedAt: string,
  endedAt: string,
  fuelConsumptionLitersPer100Km?: number | null,
): {
  distanceMeters: number;
  durationSeconds: number;
  movingDurationSeconds: number;
  stoppedDurationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainMeters: number;
  averageAccuracyMeters: number | null;
  estimatedFuelLiters: number | null;
} {
  let distanceMeters = 0;
  let maxSpeedKmh = 0;
  let movingDurationMs = 0;
  let elevationGainMeters = 0;
  let accuracyTotal = 0;
  let accuracyCount = 0;
  for (const point of points) {
    if (point.speedMs !== undefined) {
      maxSpeedKmh = Math.max(maxSpeedKmh, point.speedMs * 3.6);
    }
    if (point.accuracy !== undefined) {
      accuracyTotal += point.accuracy;
      accuracyCount += 1;
    }
  }

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const segmentDistance = haversineDistanceMeters(previous, current);
    distanceMeters += segmentDistance;

    const deltaMs =
      current.recordedAt.getTime() - previous.recordedAt.getTime();
    const impliedSpeedKmh =
      deltaMs > 0 ? (segmentDistance / (deltaMs / 1000)) * 3.6 : 0;
    const reportedSpeedKmh =
      current.speedMs !== undefined ? current.speedMs * 3.6 : impliedSpeedKmh;
    maxSpeedKmh = Math.max(maxSpeedKmh, reportedSpeedKmh);
    if (deltaMs > 0 && deltaMs <= 30_000 && impliedSpeedKmh >= 3.6) {
      movingDurationMs += deltaMs;
    }
    if (
      previous.altitudeMeters !== undefined &&
      current.altitudeMeters !== undefined
    ) {
      const elevationDelta = current.altitudeMeters - previous.altitudeMeters;
      if (elevationDelta > 0 && elevationDelta <= 100) {
        elevationGainMeters += elevationDelta;
      }
    }
  }

  const durationSeconds = Math.max(
    1,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  const movingDurationSeconds = Math.min(
    durationSeconds,
    Math.round(movingDurationMs / 1000),
  );
  const stoppedDurationSeconds = Math.max(
    0,
    durationSeconds - movingDurationSeconds,
  );
  const avgSpeedKmh = distanceMeters / 1000 / (durationSeconds / 3600);

  return {
    distanceMeters,
    durationSeconds,
    movingDurationSeconds,
    stoppedDurationSeconds,
    avgSpeedKmh,
    maxSpeedKmh,
    elevationGainMeters,
    averageAccuracyMeters:
      accuracyCount > 0 ? accuracyTotal / accuracyCount : null,
    estimatedFuelLiters:
      fuelConsumptionLitersPer100Km != null
        ? (distanceMeters / 100_000) * fuelConsumptionLitersPer100Km
        : null,
  };
}

function makeAchievement(
  id: string,
  title: string,
  description: string,
  progress: number,
  target: number,
  unit: string,
): ActivityAchievement {
  return {
    id,
    title,
    description,
    progress: Math.min(target, Math.round(progress * 10) / 10),
    target,
    unit,
    unlocked: progress >= target,
  };
}
