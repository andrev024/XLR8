import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NearbyCircuitsQueryDto } from './dto/nearby-circuits-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import type { PowerCategory, VehicleType } from '../../generated/prisma';

export interface CircuitListItem {
  id: string;
  name: string;
  description: string | null;
  lengthMeters: number;
  createdAt: Date;
  distanceMeters?: number;
  location: { lng: number; lat: number } | null;
  referencePath: {
    type: 'LineString';
    coordinates: [number, number][];
  } | null;
}

export interface CircuitDetail {
  id: string;
  name: string;
  description: string | null;
  lengthMeters: number;
  createdAt: Date;
  startLine: unknown;
  finishLine: unknown;
  referencePath: unknown;
}

export interface LeaderboardEntry {
  position: number;
  attemptId: string;
  userId: string;
  displayName: string;
  durationMs: number;
  vehicleBrand: string;
  vehicleModel: string;
  date: Date;
}

export interface MyLeaderboardSummary {
  bestTimeMs: number | null;
  position: number | null;
}

export interface MyAttemptEntry {
  id: string;
  durationMs: number;
  maxSpeedKmh: number;
  isValid: boolean;
  invalidReason: string | null;
  vehicleType: VehicleType;
  powerCategory: PowerCategory;
  startedAt: Date;
  createdAt: Date;
}

@Injectable()
export class CircuitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: NearbyCircuitsQueryDto): Promise<CircuitListItem[]> {
    const hasAny =
      query.lat !== undefined ||
      query.lng !== undefined ||
      query.radiusKm !== undefined;
    const hasAll =
      query.lat !== undefined &&
      query.lng !== undefined &&
      query.radiusKm !== undefined;

    if (hasAny && !hasAll) {
      throw new BadRequestException(
        'Para filtrar por cercanía debes enviar lat, lng y radiusKm',
      );
    }

    const rows = await this.prisma.withPostgis(async (transaction) => {
      if (hasAll) {
        return transaction.$queryRaw<
          (Omit<CircuitListItem, 'location' | 'referencePath'> & {
            locationJson: string | null;
            referencePathJson: string | null;
          })[]
        >`
          SELECT
            "id",
            "name",
            "description",
            "lengthMeters",
            "createdAt",
            ST_Distance(
              "referencePath"::geography,
              ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography
            ) as "distanceMeters",
            ST_AsGeoJSON(COALESCE(
              ST_LineInterpolatePoint("referencePath", 0.5),
              ST_LineInterpolatePoint(
                ST_MakeLine(ST_StartPoint("startLine"), ST_StartPoint("finishLine")),
                0.5
              )
            )) as "locationJson",
            ST_AsGeoJSON("referencePath") as "referencePathJson"
          FROM "Circuit"
          WHERE ST_DWithin(
            "referencePath"::geography,
            ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
            ${query.radiusKm! * 1000}
          )
          ORDER BY "distanceMeters" ASC
        `;
      }

      return transaction.$queryRaw<
        (Omit<CircuitListItem, 'location' | 'referencePath'> & {
          locationJson: string | null;
          referencePathJson: string | null;
        })[]
      >`
          SELECT
            "id",
            "name",
            "description",
            "lengthMeters",
            "createdAt",
            ST_AsGeoJSON(COALESCE(
              ST_LineInterpolatePoint("referencePath", 0.5),
              ST_LineInterpolatePoint(
                ST_MakeLine(ST_StartPoint("startLine"), ST_StartPoint("finishLine")),
                0.5
              )
            )) as "locationJson",
            ST_AsGeoJSON("referencePath") as "referencePathJson"
          FROM "Circuit"
          ORDER BY "name" ASC
      `;
    });

    return rows.map(({ locationJson, referencePathJson, ...circuit }) => {
      const location = locationJson
        ? (JSON.parse(locationJson) as {
            type: 'Point';
            coordinates: [number, number];
          })
        : null;
      return {
        ...circuit,
        location: location
          ? { lng: location.coordinates[0], lat: location.coordinates[1] }
          : null,
        referencePath: referencePathJson
          ? (JSON.parse(referencePathJson) as CircuitListItem['referencePath'])
          : null,
      };
    });
  }

  async findOne(id: string): Promise<CircuitDetail> {
    const rows = await this.prisma.withPostgis(
      (transaction) =>
        transaction.$queryRaw<
          {
            id: string;
            name: string;
            description: string | null;
            lengthMeters: number;
            createdAt: Date;
            startLine: string;
            finishLine: string;
            referencePath: string | null;
          }[]
        >`
        SELECT
          "id",
          "name",
          "description",
          "lengthMeters",
          "createdAt",
          ST_AsGeoJSON("startLine") as "startLine",
          ST_AsGeoJSON("finishLine") as "finishLine",
          ST_AsGeoJSON("referencePath") as "referencePath"
        FROM "Circuit"
        WHERE "id" = ${id}
      `,
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Circuito no encontrado');
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      lengthMeters: row.lengthMeters,
      createdAt: row.createdAt,
      startLine: JSON.parse(row.startLine) as unknown,
      finishLine: JSON.parse(row.finishLine) as unknown,
      referencePath: row.referencePath
        ? (JSON.parse(row.referencePath) as unknown)
        : null,
    };
  }

  async leaderboard(
    id: string,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardEntry[]> {
    await this.ensureCircuitExists(id);

    const rows = await this.prisma.$queryRaw<
      {
        attemptId: string;
        userId: string;
        displayName: string;
        durationMs: number;
        brand: string;
        model: string;
        startedAt: Date;
      }[]
    >`
      SELECT * FROM (
        SELECT DISTINCT ON (ca."userId")
          ca."userId" as "userId",
          ca."id" as "attemptId",
          u."displayName" as "displayName",
          ca."durationMs" as "durationMs",
          v."brand" as "brand",
          v."model" as "model",
          ca."startedAt" as "startedAt"
        FROM "CircuitAttempt" ca
        INNER JOIN "User" u ON u."id" = ca."userId"
        INNER JOIN "Vehicle" v ON v."id" = ca."vehicleId"
        WHERE ca."circuitId" = ${id}
          AND ca."vehicleType" = ${query.vehicleType}::"VehicleType"
          AND ca."powerCategory" = ${query.powerCategory}::"PowerCategory"
          AND ca."isValid" = true
        ORDER BY
          ca."userId",
          ca."durationMs" ASC,
          ca."startedAt" ASC,
          ca."id" ASC
      ) best
      ORDER BY "durationMs" ASC, "displayName" ASC, "userId" ASC
      LIMIT 3
    `;

    return rows.map((row, index) => ({
      position: index + 1,
      attemptId: row.attemptId,
      userId: row.userId,
      displayName: row.displayName,
      durationMs: row.durationMs,
      vehicleBrand: row.brand,
      vehicleModel: row.model,
      date: row.startedAt,
    }));
  }

  async myLeaderboardSummary(
    id: string,
    userId: string,
    query: LeaderboardQueryDto,
  ): Promise<MyLeaderboardSummary> {
    await this.ensureCircuitExists(id);

    const rows = await this.prisma.$queryRaw<
      { bestTimeMs: number; position: number }[]
    >`
      WITH best AS (
        SELECT DISTINCT ON (ca."userId")
          ca."userId" as "userId",
          ca."durationMs" as "durationMs",
          u."displayName" as "displayName"
        FROM "CircuitAttempt" ca
        INNER JOIN "User" u ON u."id" = ca."userId"
        WHERE ca."circuitId" = ${id}
          AND ca."vehicleType" = ${query.vehicleType}::"VehicleType"
          AND ca."powerCategory" = ${query.powerCategory}::"PowerCategory"
          AND ca."isValid" = true
        ORDER BY
          ca."userId",
          ca."durationMs" ASC,
          ca."startedAt" ASC,
          ca."id" ASC
      ),
      ranked AS (
        SELECT
          "userId",
          "durationMs" as "bestTimeMs",
          CAST(
            ROW_NUMBER() OVER (
              ORDER BY "durationMs" ASC, "displayName" ASC, "userId" ASC
            ) AS INTEGER
          ) as "position"
        FROM best
      )
      SELECT "bestTimeMs", "position"
      FROM ranked
      WHERE "userId" = ${userId}
    `;

    const personalBest = rows[0];
    return personalBest
      ? { bestTimeMs: personalBest.bestTimeMs, position: personalBest.position }
      : { bestTimeMs: null, position: null };
  }

  async myAttempts(id: string, userId: string): Promise<MyAttemptEntry[]> {
    await this.ensureCircuitExists(id);

    return this.prisma.circuitAttempt.findMany({
      where: { circuitId: id, userId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        durationMs: true,
        maxSpeedKmh: true,
        isValid: true,
        invalidReason: true,
        vehicleType: true,
        powerCategory: true,
        startedAt: true,
        createdAt: true,
      },
    });
  }

  private async ensureCircuitExists(id: string): Promise<void> {
    const circuit = await this.prisma.circuit.findUnique({ where: { id } });
    if (!circuit) {
      throw new NotFoundException('Circuito no encontrado');
    }
  }
}
