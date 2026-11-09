import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectCircuitAttempts,
  type AttemptTrackPoint,
  type GateLine,
} from './attempt-detector';
import type { CircuitAttempt, Vehicle } from '../../generated/prisma';

interface CandidateCircuitRow {
  id: string;
  lengthMeters: number;
  startLineGeoJson: string;
  finishLineGeoJson: string;
}

interface GeoJsonLineString {
  type: string;
  coordinates: [number, number][];
}

@Injectable()
export class CircuitAttemptsDetectorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca circuitos cuyas líneas de salida y meta intersecten el recorrido
   * ya guardado, detecta los intentos con la geometría pura y los persiste.
   */
  async detectAndRecord(
    activityId: string,
    userId: string,
    vehicle: Vehicle,
    points: AttemptTrackPoint[],
  ): Promise<CircuitAttempt[]> {
    const candidates = await this.prisma.$queryRaw<CandidateCircuitRow[]>`
      SELECT
        c."id" as "id",
        c."lengthMeters" as "lengthMeters",
        ST_AsGeoJSON(c."startLine") as "startLineGeoJson",
        ST_AsGeoJSON(c."finishLine") as "finishLineGeoJson"
      FROM "Circuit" c
      INNER JOIN "Activity" a ON a."id" = ${activityId}
      WHERE a."path" IS NOT NULL
        AND ST_Intersects(c."startLine", a."path")
        AND ST_Intersects(c."finishLine", a."path")
    `;

    const created: CircuitAttempt[] = [];

    for (const candidate of candidates) {
      const startLine = toGateLine(candidate.startLineGeoJson);
      const finishLine = toGateLine(candidate.finishLineGeoJson);

      const attempts = detectCircuitAttempts(
        points,
        startLine,
        finishLine,
        candidate.lengthMeters,
      );

      for (const attempt of attempts) {
        const row = await this.prisma.circuitAttempt.create({
          data: {
            circuitId: candidate.id,
            activityId,
            userId,
            vehicleId: vehicle.id,
            vehicleType: vehicle.type,
            powerCategory: vehicle.powerCategory,
            durationMs: attempt.durationMs,
            maxSpeedKmh: attempt.maxSpeedKmh,
            isValid: attempt.isValid,
            invalidReason: attempt.invalidReason,
            startedAt: attempt.startedAt,
          },
        });
        created.push(row);
      }
    }

    return created;
  }
}

function toGateLine(geoJson: string): GateLine {
  const parsed = JSON.parse(geoJson) as GeoJsonLineString;
  const first = parsed.coordinates[0];
  const last = parsed.coordinates[parsed.coordinates.length - 1];
  return [
    { lat: first[1], lng: first[0] },
    { lat: last[1], lng: last[0] },
  ];
}
