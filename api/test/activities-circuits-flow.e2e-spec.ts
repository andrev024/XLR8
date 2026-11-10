import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  loadRouteFixture,
  loadRouteFixtureData,
} from './fixtures/load-route-fixture';
import {
  generateRouteScenario,
  SIMULATION_SCENARIOS,
} from '../src/simulation/route-generator';

const boyacaFixture = loadRouteFixtureData(
  path.join(__dirname, 'fixtures', 'circuit-avenida-boyaca-route.geojson'),
);
const northFixture = loadRouteFixtureData(
  path.join(__dirname, 'fixtures', 'circuit-autopista-norte-route.geojson'),
);
const circuitLengthMeters = boyacaFixture.lengthMeters;
const simulationCircuitLengthMeters = northFixture.lengthMeters;
const simulationStartLine = northFixture.startLine;
const simulationFinishLine = northFixture.finishLine;
const simulationReferencePath = northFixture.referencePath;
const circuitReferencePathWkt = lineStringWkt(
  boyacaFixture.referencePath.map(({ lng, lat }): [number, number] => [
    lng,
    lat,
  ]),
);
const circuitStartLineWkt = lineStringWkt(
  boyacaFixture.startLine.map(({ lng, lat }): [number, number] => [lng, lat]),
);
const circuitFinishLineWkt = lineStringWkt(
  boyacaFixture.finishLine.map(({ lng, lat }): [number, number] => [lng, lat]),
);
const simulationReferencePathWkt = lineStringWkt(
  northFixture.referencePath.map(({ lng, lat }): [number, number] => [
    lng,
    lat,
  ]),
);
const simulationStartLineWkt = lineStringWkt(
  northFixture.startLine.map(({ lng, lat }): [number, number] => [lng, lat]),
);
const simulationFinishLineWkt = lineStringWkt(
  northFixture.finishLine.map(({ lng, lat }): [number, number] => [lng, lat]),
);
const circuitLocation =
  boyacaFixture.referencePath[
    Math.floor(boyacaFixture.referencePath.length / 2)
  ];

describe('Activities + Circuits flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-activities-${Date.now()}@xlr8.app`;
  const password = 'password123';
  const circuitId = randomUUID();
  const circuitName = `E2E Test Circuit ${Date.now()}`;
  const simulationCircuitId = randomUUID();
  const publicCircuitId = randomUUID();
  let accessToken: string;
  let vehicleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '10mb' }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRaw`
      INSERT INTO "Circuit" ("id", "name", "description", "startLine", "finishLine", "referencePath", "lengthMeters", "isAuthorizedClosed", "createdAt")
      VALUES (
        ${circuitId},
        ${circuitName},
        ${boyacaFixture.description},
        ST_GeomFromText(${circuitStartLineWkt}, 4326),
        ST_GeomFromText(${circuitFinishLineWkt}, 4326),
        ST_GeomFromText(${circuitReferencePathWkt}, 4326),
        ${circuitLengthMeters},
        true,
        now()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "Circuit" ("id", "name", "description", "startLine", "finishLine", "referencePath", "lengthMeters", "isAuthorizedClosed", "createdAt")
      VALUES (
        ${simulationCircuitId},
        ${`${circuitName} Simulation`},
        ${northFixture.description},
        ST_GeomFromText(${simulationStartLineWkt}, 4326),
        ST_GeomFromText(${simulationFinishLineWkt}, 4326),
        ST_GeomFromText(${simulationReferencePathWkt}, 4326),
        ${simulationCircuitLengthMeters},
        true,
        now()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "Circuit" ("id", "name", "description", "startLine", "finishLine", "referencePath", "lengthMeters", "isAuthorizedClosed", "createdAt")
      VALUES (
        ${publicCircuitId},
        ${`${circuitName} Public Road`},
        ${boyacaFixture.description},
        ST_GeomFromText(${circuitStartLineWkt}, 4326),
        ST_GeomFromText(${circuitFinishLineWkt}, 4326),
        ST_GeomFromText(${circuitReferencePathWkt}, 4326),
        ${circuitLengthMeters},
        false,
        now()
      )
    `;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.circuit.deleteMany({
        where: {
          id: { in: [circuitId, simulationCircuitId, publicCircuitId] },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

  it('completa registro, actividad, detección, consultas y eliminación', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'E2E Activities Rider' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = (loginResponse.body as { accessToken: string }).accessToken;
    expect(accessToken).toEqual(expect.any(String));

    const vehicleResponse = await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'MOTORCYCLE',
        brand: 'Yamaha',
        model: 'MT-07',
        year: 2023,
        horsepower: 73,
        engineDisplacementCc: 689,
        engineType: '4 tiempos, bicilíndrico',
        weightKg: 184,
        fuelConsumptionLitersPer100Km: 4.5,
      })
      .expect(201);
    expect(vehicleResponse.body.powerCategory).toBe('MID');
    expect(vehicleResponse.body.engineDisplacementCc).toBe(689);
    vehicleId = vehicleResponse.body.id as string;

    const circuitsResponse = await request(app.getHttpServer())
      .get('/circuits')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const listedCircuits = circuitsResponse.body as {
      id: string;
      isAuthorizedClosed: boolean;
      location: { lng: number; lat: number } | null;
      referencePath: { type: string } | null;
    }[];
    const listedLocation = listedCircuits.find(
      (circuit) => circuit.id === circuitId,
    )?.location;
    expect(listedLocation?.lng).toBeCloseTo(circuitLocation.lng, 2);
    expect(listedLocation?.lat).toBeCloseTo(circuitLocation.lat, 2);
    expect(
      listedCircuits.find((circuit) => circuit.id === circuitId)?.referencePath
        ?.type,
    ).toBe('LineString');
    expect(
      listedCircuits.find((circuit) => circuit.id === publicCircuitId)
        ?.isAuthorizedClosed,
    ).toBe(false);

    const circuitResponse = await request(app.getHttpServer())
      .get(`/circuits/${circuitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(circuitResponse.body.referencePath.type).toBe('LineString');

    const nearbyResponse = await request(app.getHttpServer())
      .get('/circuits')
      .query({
        lat: circuitLocation.lat,
        lng: circuitLocation.lng,
        radiusKm: 5,
      })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(
      nearbyResponse.body.some(
        (circuit: { id: string }) => circuit.id === circuitId,
      ),
    ).toBe(true);

    const fixturePath = path.join(
      __dirname,
      'fixtures',
      'circuit-avenida-boyaca-route.geojson',
    );
    const routePoints = loadRouteFixture(fixturePath);
    const points = routePoints.map((routePoint) => ({
      lat: routePoint.lat,
      lng: routePoint.lng,
      recordedAt: routePoint.recordedAt.toISOString(),
      speedMs: routePoint.speedMs,
      accuracy: 5,
      altitudeMeters: 100,
    }));

    const createResponse = await request(app.getHttpServer())
      .post('/activities')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vehicleId,
        startedAt: points[0].recordedAt,
        endedAt: points[points.length - 1].recordedAt,
        responsibleDrivingConfirmed: true,
        points,
      })
      .expect(201);

    const { activity, detectedAttempts } = createResponse.body as {
      activity: {
        id: string;
        distanceMeters: number;
        durationSeconds: number;
        movingDurationSeconds: number;
        stoppedDurationSeconds: number;
        avgSpeedKmh: number;
        maxSpeedKmh: number;
        averageAccuracyMeters: number;
        estimatedFuelLiters: number;
        responsibleDrivingConfirmed: boolean;
        responsibleDrivingDurationSeconds: number;
      };
      detectedAttempts: Array<{
        id: string;
        circuitId: string;
        isValid: boolean;
        durationMs: number;
      }>;
    };
    expect(activity.id).toEqual(expect.any(String));
    expect(activity.distanceMeters).toBeGreaterThan(0);
    expect(activity.durationSeconds).toBeGreaterThan(0);
    expect(activity.avgSpeedKmh).toBeGreaterThan(0);
    expect(activity.maxSpeedKmh).toBeGreaterThan(0);
    expect(activity.movingDurationSeconds).toBeGreaterThan(0);
    expect(activity.stoppedDurationSeconds).toBeGreaterThanOrEqual(0);
    expect(activity.averageAccuracyMeters).toBe(5);
    expect(activity.estimatedFuelLiters).toBeGreaterThan(0);
    expect(activity.responsibleDrivingConfirmed).toBe(true);
    expect(activity.responsibleDrivingDurationSeconds).toBe(
      activity.movingDurationSeconds,
    );
    const persistedRoute = await prisma.$queryRaw<
      { hasPath: boolean; trackPointCount: bigint; pathPointCount: number }[]
    >`
      SELECT
        a."path" IS NOT NULL AS "hasPath",
        (SELECT COUNT(*) FROM "TrackPoint" WHERE "activityId" = a."id") AS "trackPointCount",
        COALESCE(ST_NPoints(a."path"), 0) AS "pathPointCount"
      FROM "Activity" a
      WHERE a."id" = ${activity.id}
    `;
    expect(persistedRoute[0]).toMatchObject({ hasPath: true });
    expect(persistedRoute[0].trackPointCount).toBeGreaterThanOrEqual(2n);
    expect(persistedRoute[0].pathPointCount).toBeGreaterThanOrEqual(2);
    const targetAttempts = detectedAttempts.filter(
      (attempt) => attempt.circuitId === circuitId,
    );
    expect(
      detectedAttempts.some((attempt) => attempt.circuitId === publicCircuitId),
    ).toBe(false);
    expect(targetAttempts).toHaveLength(1);
    expect(targetAttempts[0].isValid).toBe(true);
    expect(targetAttempts[0].durationMs).toBeGreaterThan(0);

    const firstRecordedAt = new Date(points[0].recordedAt).getTime();
    const fasterPoints = points.map((point) => ({
      ...point,
      recordedAt: new Date(
        firstRecordedAt +
          (new Date(point.recordedAt).getTime() - firstRecordedAt) * 0.8,
      ).toISOString(),
    }));
    const fasterActivityResponse = await request(app.getHttpServer())
      .post('/activities')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vehicleId,
        startedAt: fasterPoints[0].recordedAt,
        endedAt: fasterPoints[fasterPoints.length - 1].recordedAt,
        points: fasterPoints,
      })
      .expect(201);
    const fasterActivity = fasterActivityResponse.body as {
      activity: { id: string };
      detectedAttempts: Array<{
        id: string;
        circuitId: string;
        durationMs: number;
        isValid: boolean;
      }>;
    };
    const fasterTargetAttempts = fasterActivity.detectedAttempts.filter(
      (attempt) => attempt.circuitId === circuitId,
    );
    expect(fasterTargetAttempts).toHaveLength(1);
    expect(fasterTargetAttempts[0].isValid).toBe(true);
    expect(fasterTargetAttempts[0].durationMs).toBeLessThan(
      targetAttempts[0].durationMs,
    );

    const activitiesResponse = await request(app.getHttpServer())
      .get('/activities')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(activitiesResponse.body).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
    });
    expect(
      activitiesResponse.body.items.map((item: { id: string }) => item.id),
    ).toContain(activity.id);

    const activitySummaryResponse = await request(app.getHttpServer())
      .get('/activities/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(activitySummaryResponse.body).toEqual(
      expect.objectContaining({
        week: expect.any(Object),
        month: expect.any(Object),
        year: expect.any(Object),
      }),
    );
    const achievementsResponse = await request(app.getHttpServer())
      .get('/activities/achievements')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(achievementsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'activities-10', unlocked: false }),
        expect.objectContaining({ id: 'responsible-driving-1h' }),
      ]),
    );

    const activityDetailResponse = await request(app.getHttpServer())
      .get(`/activities/${activity.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(activityDetailResponse.body.simplifiedPath).toMatchObject({
      type: 'LineString',
    });
    expect(
      activityDetailResponse.body.simplifiedPath.coordinates.length,
    ).toBeGreaterThanOrEqual(2);
    expect(activityDetailResponse.body.vehicle.model).toBe('MT-07');
    expect(
      activityDetailResponse.body.circuitAttempts.some(
        (attempt: { circuit: { id: string } }) =>
          attempt.circuit.id === circuitId,
      ),
    ).toBe(true);

    const attemptsResponse = await request(app.getHttpServer())
      .get(`/circuits/${circuitId}/my-attempts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(attemptsResponse.body).toHaveLength(2);
    expect(
      attemptsResponse.body.every(
        (attempt: { isValid: boolean }) => attempt.isValid,
      ),
    ).toBe(true);

    const matchingLeaderboardResponse = await request(app.getHttpServer())
      .get(`/circuits/${circuitId}/leaderboard`)
      .query({ vehicleType: 'MOTORCYCLE', powerCategory: 'MID' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(matchingLeaderboardResponse.body).toHaveLength(1);
    expect(matchingLeaderboardResponse.body[0].durationMs).toBe(
      fasterTargetAttempts[0].durationMs,
    );
    expect(matchingLeaderboardResponse.body[0].attemptId).toBe(
      fasterTargetAttempts[0].id,
    );
    expect(matchingLeaderboardResponse.body[0].horsepower).toBe(73);
    const personalLeaderboardResponse = await request(app.getHttpServer())
      .get(`/circuits/${circuitId}/leaderboard/me`)
      .query({ vehicleType: 'MOTORCYCLE', powerCategory: 'MID' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(personalLeaderboardResponse.body).toEqual({
      bestTimeMs: fasterTargetAttempts[0].durationMs,
      position: 1,
    });

    const nonMatchingLeaderboardResponse = await request(app.getHttpServer())
      .get(`/circuits/${circuitId}/leaderboard`)
      .query({ vehicleType: 'MOTORCYCLE', powerCategory: 'HIGH' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(nonMatchingLeaderboardResponse.body).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/circuits/${publicCircuitId}/leaderboard`)
      .query({ vehicleType: 'MOTORCYCLE', powerCategory: 'MID' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/activities/${activity.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const emptyActivitiesResponse = await request(app.getHttpServer())
      .get('/activities')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(emptyActivitiesResponse.body.total).toBe(1);
  });

  it('verifica la suite completa de escenarios del generador contra la API', async () => {
    for (const [index, scenario] of SIMULATION_SCENARIOS.entries()) {
      const generated = generateRouteScenario(simulationReferencePath, {
        scenario,
        startLine: simulationStartLine,
        finishLine: simulationFinishLine,
        circuitLengthMeters: simulationCircuitLengthMeters,
        startedAt: new Date(Date.UTC(2026, 1, 1, 0, index)),
        noiseMeters: 0,
        seed: index + 10,
      });
      const points = generated.points.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        recordedAt: point.recordedAt.toISOString(),
        speedMs: point.speedMs,
        accuracy: 5,
      }));
      const response = await request(app.getHttpServer())
        .post('/activities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          vehicleId,
          startedAt: points[0].recordedAt,
          endedAt: points[points.length - 1].recordedAt,
          points,
        })
        .expect(201);
      const result = response.body as {
        detectedAttempts: {
          circuitId: string;
          isValid: boolean;
          invalidReason: string | null;
        }[];
      };
      const actual = result.detectedAttempts
        .filter((attempt) => attempt.circuitId === simulationCircuitId)
        .map(({ isValid, invalidReason }) => ({ isValid, invalidReason }));
      expect({
        scenario,
        detected: actual.length > 0,
        attempts: actual,
      }).toEqual({
        scenario,
        ...generated.expectation,
      });
    }
  });
});

function lineStringWkt(coordinates: [number, number][]): string {
  return `LINESTRING(${coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
}
