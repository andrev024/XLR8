import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  PrismaClient,
  PowerCategory,
  VehicleType,
} from '../generated/prisma';
import circuitData from './data/circuits.json';
import {
  detectCircuitAttempts,
  type GateLine,
} from '../src/circuits/attempt-detector';
import { generateRouteScenario } from '../src/simulation/route-generator';
import { haversineDistanceMeters } from '../src/common/geo';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'xlr8-demo-password';

async function withPostgis<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET LOCAL search_path TO public, extensions`;
    return operation(transaction);
  });
}

interface CircuitSeed {
  name: string;
  description: string;
  startLineWkt: string;
  finishLineWkt: string;
  referencePathWkt: string;
  lengthMeters: number;
  referencePath: { lat: number; lng: number }[];
  startLine: GateLine;
  finishLine: GateLine;
}

type CircuitCoordinate = [number, number];

function lineStringWkt(coordinates: CircuitCoordinate[]): string {
  return `LINESTRING(${coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})`;
}

function parseCoordinate(
  coordinate: number[],
  circuitName: string,
): CircuitCoordinate {
  if (
    coordinate.length !== 2 ||
    !coordinate.every((value) => Number.isFinite(value))
  ) {
    throw new Error(`Coordenada inválida en ${circuitName}.`);
  }
  return [coordinate[0], coordinate[1]];
}

function parseGateLine(coordinates: number[][], circuitName: string): GateLine {
  if (coordinates.length !== 2) {
    throw new Error(`Línea de salida/meta inválida en ${circuitName}.`);
  }
  const first = parseCoordinate(coordinates[0], circuitName);
  const second = parseCoordinate(coordinates[1], circuitName);
  return [
    { lat: first[1], lng: first[0] },
    { lat: second[1], lng: second[0] },
  ];
}

const CIRCUITS: CircuitSeed[] = circuitData.map((source) => {
  const referencePath = source.referencePath.map((coordinate) =>
    parseCoordinate(coordinate, source.name),
  );
  const startCoordinates = source.startLine.map((coordinate) =>
    parseCoordinate(coordinate, source.name),
  );
  const finishCoordinates = source.finishLine.map((coordinate) =>
    parseCoordinate(coordinate, source.name),
  );
  return {
    ...source,
    startLineWkt: lineStringWkt(startCoordinates),
    finishLineWkt: lineStringWkt(finishCoordinates),
    referencePathWkt: lineStringWkt(referencePath),
    referencePath: referencePath.map(([lng, lat]) => ({ lat, lng })),
    startLine: parseGateLine(source.startLine, source.name),
    finishLine: parseGateLine(source.finishLine, source.name),
  };
});

interface DemoUserSeed {
  email: string;
  displayName: string;
  vehicle: {
    type: VehicleType;
    brand: string;
    model: string;
    year: number;
    horsepower: number;
    powerCategory: PowerCategory;
  };
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: 'ana.ligera@xlr8.app',
    displayName: 'Ana Ligera',
    vehicle: {
      type: VehicleType.MOTORCYCLE,
      brand: 'Honda',
      model: 'CB125F',
      year: 2021,
      horsepower: 10,
      powerCategory: PowerCategory.LOW,
    },
  },
  {
    email: 'carlos.medio@xlr8.app',
    displayName: 'Carlos Medio',
    vehicle: {
      type: VehicleType.MOTORCYCLE,
      brand: 'Yamaha',
      model: 'MT-07',
      year: 2023,
      horsepower: 73,
      powerCategory: PowerCategory.MID,
    },
  },
  {
    email: 'diego.potente@xlr8.app',
    displayName: 'Diego Potente',
    vehicle: {
      type: VehicleType.MOTORCYCLE,
      brand: 'Kawasaki',
      model: 'Ninja ZX-10R',
      year: 2022,
      horsepower: 200,
      powerCategory: PowerCategory.HIGH,
    },
  },
  {
    email: 'laura.citycar@xlr8.app',
    displayName: 'Laura City Car',
    vehicle: {
      type: VehicleType.CAR,
      brand: 'Chevrolet',
      model: 'Spark GT',
      year: 2020,
      horsepower: 82,
      powerCategory: PowerCategory.LOW,
    },
  },
  {
    email: 'mario.deportivo@xlr8.app',
    displayName: 'Mario Deportivo',
    vehicle: {
      type: VehicleType.CAR,
      brand: 'Mazda',
      model: 'MX-5',
      year: 2022,
      horsepower: 181,
      powerCategory: PowerCategory.MID,
    },
  },
  {
    email: 'sofia.supercar@xlr8.app',
    displayName: 'Sofia Supercar',
    vehicle: {
      type: VehicleType.CAR,
      brand: 'Porsche',
      model: '911 Carrera',
      year: 2023,
      horsepower: 379,
      powerCategory: PowerCategory.HIGH,
    },
  },
];

async function upsertCircuit(seedData: CircuitSeed): Promise<string> {
  const existing = await prisma.circuit.findFirst({
    where: { name: seedData.name },
    select: { id: true },
  });
  const id = existing?.id ?? randomUUID();

  if (existing) {
    await withPostgis(
      (transaction) =>
        transaction.$executeRaw`
        UPDATE "Circuit"
        SET
          "description" = ${seedData.description},
          "startLine" = ST_GeomFromText(${seedData.startLineWkt}, 4326),
          "finishLine" = ST_GeomFromText(${seedData.finishLineWkt}, 4326),
          "referencePath" = ST_GeomFromText(${seedData.referencePathWkt}, 4326),
          "lengthMeters" = ${seedData.lengthMeters}
        WHERE "id" = ${id}
      `,
    );
    return id;
  }

  await withPostgis(
    (transaction) =>
      transaction.$executeRaw`
      INSERT INTO "Circuit" ("id", "name", "description", "startLine", "finishLine", "referencePath", "lengthMeters", "createdAt")
      VALUES (
        ${id},
        ${seedData.name},
        ${seedData.description},
        ST_GeomFromText(${seedData.startLineWkt}, 4326),
        ST_GeomFromText(${seedData.finishLineWkt}, 4326),
        ST_GeomFromText(${seedData.referencePathWkt}, 4326),
        ${seedData.lengthMeters},
        now()
      )
    `,
  );
  return id;
}

async function upsertDemoUser(
  seedData: DemoUserSeed,
  passwordHash: string,
): Promise<{ userId: string; vehicleId: string }> {
  const user = await prisma.user.upsert({
    where: { email: seedData.email },
    update: { displayName: seedData.displayName, passwordHash },
    create: {
      email: seedData.email,
      passwordHash,
      displayName: seedData.displayName,
    },
  });

  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      userId: user.id,
      brand: seedData.vehicle.brand,
      model: seedData.vehicle.model,
    },
    select: { id: true },
  });
  const vehicle = existingVehicle
    ? await prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: seedData.vehicle,
      })
    : await prisma.vehicle.create({
        data: { userId: user.id, ...seedData.vehicle },
      });

  return { userId: user.id, vehicleId: vehicle.id };
}

async function ensureCircuitAttempt(
  circuitId: string,
  circuit: CircuitSeed,
  userId: string,
  vehicleId: string,
  vehicle: DemoUserSeed['vehicle'],
): Promise<void> {
  const startedAt = new Date('2026-01-01T00:00:00.000Z');
  const existingAttempts = await prisma.circuitAttempt.findMany({
    where: {
      circuitId,
      userId,
      activity: { is: { startedAt } },
    },
    select: { id: true, activityId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const [existing, ...duplicateAttempts] = existingAttempts;

  const generated = generateRouteScenario(circuit.referencePath, {
    scenario: 'VALID',
    startLine: circuit.startLine,
    finishLine: circuit.finishLine,
    circuitLengthMeters: circuit.lengthMeters,
    startedAt,
    noiseMeters: 0.5,
    seed: userId.length + circuit.name.length,
  });
  const points = generated.points;
  const [attempt] = detectCircuitAttempts(
    points,
    circuit.startLine,
    circuit.finishLine,
    circuit.lengthMeters,
  );
  if (!attempt?.isValid) {
    throw new Error(
      `La ruta de prueba de ${circuit.name} no genera un intento válido`,
    );
  }

  let distanceMeters = 0;
  let maxSpeedKmh = 0;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    maxSpeedKmh = Math.max(maxSpeedKmh, (point.speedMs ?? 0) * 3.6);
    if (index > 0) {
      distanceMeters += haversineDistanceMeters(points[index - 1], point);
    }
  }

  const endedAt = points[points.length - 1].recordedAt;
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const avgSpeedKmh = distanceMeters / 1000 / (durationSeconds / 3600);

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SET LOCAL search_path TO public, extensions`;
    const activityData = {
      userId,
      vehicleId,
      startedAt,
      endedAt,
      distanceMeters,
      durationSeconds,
      avgSpeedKmh,
      maxSpeedKmh,
    };
    const activity = existing
      ? await transaction.activity.update({
          where: { id: existing.activityId },
          data: activityData,
        })
      : await transaction.activity.create({
          data: activityData,
        });

    if (existing) {
      await transaction.trackPoint.deleteMany({
        where: { activityId: existing.activityId },
      });
    }

    await transaction.trackPoint.createMany({
      data: points.map((point, sequence) => ({
        activityId: activity.id,
        lat: point.lat,
        lng: point.lng,
        speedMs: point.speedMs,
        recordedAt: point.recordedAt,
        sequence,
      })),
    });

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
        WHERE "activityId" = ${activity.id}
      )
      WHERE "id" = ${activity.id}
    `;

    const attemptData = {
      circuitId,
      activityId: activity.id,
      userId,
      vehicleId,
      vehicleType: vehicle.type,
      powerCategory: vehicle.powerCategory,
      durationMs: attempt.durationMs,
      maxSpeedKmh: attempt.maxSpeedKmh,
      isValid: true,
      invalidReason: null,
      startedAt: attempt.startedAt,
    };
    if (existing) {
      await transaction.circuitAttempt.update({
        where: { id: existing.id },
        data: attemptData,
      });
    } else {
      await transaction.circuitAttempt.create({ data: attemptData });
    }

    for (const duplicate of duplicateAttempts) {
      await transaction.circuitAttempt.delete({
        where: { id: duplicate.id },
      });
      const remainingAttempts = await transaction.circuitAttempt.count({
        where: { activityId: duplicate.activityId },
      });
      if (remainingAttempts === 0) {
        await transaction.activity.delete({
          where: { id: duplicate.activityId },
        });
      }
    }
  });
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const circuitIds = await Promise.all(CIRCUITS.map(upsertCircuit));
  const users = await Promise.all(
    DEMO_USERS.map((seed) => upsertDemoUser(seed, passwordHash)),
  );

  for (let circuitIndex = 0; circuitIndex < CIRCUITS.length; circuitIndex++) {
    const circuit = CIRCUITS[circuitIndex];
    for (let userIndex = 0; userIndex < DEMO_USERS.length; userIndex++) {
      await ensureCircuitAttempt(
        circuitIds[circuitIndex],
        circuit,
        users[userIndex].userId,
        users[userIndex].vehicleId,
        DEMO_USERS[userIndex].vehicle,
      );
    }
  }

  console.log('Seed completado:', {
    circuits: CIRCUITS.length,
    demoUsers: DEMO_USERS.length,
    validAttempts: CIRCUITS.length * DEMO_USERS.length,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
