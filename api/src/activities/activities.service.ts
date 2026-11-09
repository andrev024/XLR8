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

interface FilteredPoint {
  lat: number;
  lng: number;
  recordedAt: Date;
  speedMs?: number;
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

    const stats = computeStats(filteredPoints, dto.startedAt, dto.endedAt);

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
          avgSpeedKmh: stats.avgSpeedKmh,
          maxSpeedKmh: stats.maxSpeedKmh,
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

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vehicle: {
            select: { id: true, type: true, brand: true, model: true },
          },
        },
      }),
      this.prisma.activity.count({ where: { userId } }),
    ]);

    return { items, page, limit, total };
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

    const candidate: FilteredPoint = {
      lat: raw.lat,
      lng: raw.lng,
      recordedAt: new Date(raw.recordedAt),
      speedMs: raw.speedMs,
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

function computeStats(
  points: FilteredPoint[],
  startedAt: string,
  endedAt: string,
): {
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
} {
  let distanceMeters = 0;
  let maxSpeedKmh = 0;

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
  }

  const durationSeconds = Math.max(
    1,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  const avgSpeedKmh = distanceMeters / 1000 / (durationSeconds / 3600);

  return { distanceMeters, durationSeconds, avgSpeedKmh, maxSpeedKmh };
}
