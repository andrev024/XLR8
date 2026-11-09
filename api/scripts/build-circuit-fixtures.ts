import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import circuits from '../prisma/data/circuits.json';
import { generateRouteScenario } from '../src/simulation/route-generator';
import type { GateLine } from '../src/circuits/attempt-detector';

type Coordinate = [number, number];

const FIXTURE_NAMES: Record<string, string> = {
  'Autopista Norte - Tramo Calle 100 a Calle 170':
    'circuit-autopista-norte-route.geojson',
  'Avenida Boyacá - Tramo Puente Aranda a Suba':
    'circuit-avenida-boyaca-route.geojson',
  'Autopista Sur - Tramo Bosa a Kennedy': 'circuit-autopista-sur-route.geojson',
};
const MOBILE_FIXTURES_PATH = path.resolve(
  process.cwd(),
  '..',
  'mobile',
  'src',
  'features',
  'recording',
  'simulation-fixtures.json',
);

async function main(): Promise<void> {
  const fixtureDirectory = path.resolve(process.cwd(), 'test', 'fixtures');
  await mkdir(fixtureDirectory, { recursive: true });
  const mobileFixtures: {
    circuitName: string;
    coordinates: Coordinate[];
  }[] = [];

  for (const rawCircuit of circuits) {
    const filename = FIXTURE_NAMES[rawCircuit.name];
    if (!filename) {
      throw new Error(
        `No hay nombre de fixture configurado para ${rawCircuit.name}.`,
      );
    }
    const startLine = toGateLine(rawCircuit.startLine);
    const finishLine = toGateLine(rawCircuit.finishLine);
    const generated = generateRouteScenario(
      rawCircuit.referencePath.map(([lng, lat]) => ({ lng, lat })),
      {
        scenario: 'VALID',
        startLine,
        finishLine,
        circuitLengthMeters: rawCircuit.lengthMeters,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        speedKmh: 65,
        maxSpeedKmh: 105,
        noiseMeters: 1.2,
        seed: 41,
      },
    );
    const fixture = {
      type: 'Feature',
      properties: {
        circuitName: rawCircuit.name,
        description: rawCircuit.description,
        lengthMeters: rawCircuit.lengthMeters,
        startLine: rawCircuit.startLine,
        finishLine: rawCircuit.finishLine,
        coordTimes: generated.points.map((point) =>
          point.recordedAt.toISOString(),
        ),
        speedsMs: generated.points.map((point) => point.speedMs),
      },
      geometry: {
        type: 'LineString',
        coordinates: generated.points.map(({ lng, lat }): Coordinate => [
          lng,
          lat,
        ]),
      },
    };
    await writeFile(
      path.join(fixtureDirectory, filename),
      `${JSON.stringify(fixture)}\n`,
    );
    mobileFixtures.push({
      circuitName: rawCircuit.name,
      coordinates: fixture.geometry.coordinates,
    });
    console.log(`${filename}: ${generated.points.length} puntos`);
  }
  await writeFile(MOBILE_FIXTURES_PATH, `${JSON.stringify(mobileFixtures)}\n`);
}

function toGateLine(coordinates: number[][]): GateLine {
  if (coordinates.length !== 2) {
    throw new Error('La línea de salida/meta debe tener dos coordenadas.');
  }
  const first = toGeoPoint(coordinates[0]);
  const second = toGeoPoint(coordinates[1]);
  return [first, second];
}

function toGeoPoint(coordinate: number[]): { lat: number; lng: number } {
  if (
    coordinate.length !== 2 ||
    !coordinate.every((value) => Number.isFinite(value))
  ) {
    throw new Error('El circuito contiene una coordenada inválida.');
  }
  return { lng: coordinate[0], lat: coordinate[1] };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
