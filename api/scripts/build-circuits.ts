import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Coordinate = [number, number];
type GeoPoint = { lat: number; lng: number };

interface CircuitDefinition {
  name: string;
  description: string;
  waypoints: Coordinate[];
}

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: { geometry?: { coordinates?: Coordinate[] } }[];
}

const CIRCUITS: CircuitDefinition[] = [
  {
    name: 'Autopista Norte - Tramo Calle 100 a Calle 170',
    description:
      'Tramo de la Autopista Norte entre las calles 100 y 170, Bogotá.',
    waypoints: [
      [-74.046, 4.71],
      [-74.045, 4.724],
      [-74.045, 4.739],
      [-74.045, 4.753],
    ],
  },
  {
    name: 'Avenida Boyacá - Tramo Puente Aranda a Suba',
    description:
      'Tramo de la avenida Boyacá entre Puente Aranda y Suba, Bogotá.',
    waypoints: [
      [-74.116, 4.62],
      [-74.112, 4.657],
      [-74.105, 4.697],
      [-74.086, 4.744],
    ],
  },
  {
    name: 'Autopista Sur - Tramo Bosa a Kennedy',
    description: 'Tramo de la Autopista Sur entre Bosa y Kennedy, Bogotá.',
    waypoints: [
      [-74.181, 4.608],
      [-74.169, 4.617],
      [-74.156, 4.627],
      [-74.144, 4.638],
    ],
  },
];

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'prisma',
  'data',
  'circuits.json',
);
const MIN_REQUEST_INTERVAL_MS = 1_000;
let lastRequestStartedAt = 0;

async function main(): Promise<void> {
  const circuits = [];
  for (const circuit of CIRCUITS) {
    const referencePath = await routeThroughWaypoints(circuit.waypoints);
    if (referencePath.length < 2) {
      throw new Error(`OSRM devolvió una ruta vacía para ${circuit.name}.`);
    }

    circuits.push({
      name: circuit.name,
      description: circuit.description,
      waypoints: circuit.waypoints,
      startLine: createGate(referencePath, true),
      finishLine: createGate(referencePath, false),
      referencePath,
      lengthMeters: calculateLengthMeters(referencePath),
    });
    console.log(
      `${circuit.name}: ${referencePath.length} puntos, ${Math.round(circuits[circuits.length - 1].lengthMeters)} m`,
    );
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(circuits, null, 2)}\n`);
  console.log(`Geometrías guardadas en ${OUTPUT_PATH}`);
}

async function routeThroughWaypoints(
  waypoints: Coordinate[],
): Promise<Coordinate[]> {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}`,
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitForRateLimit();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`OSRM respondió HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as OsrmRouteResponse;
      const geometry = payload.routes?.[0]?.geometry?.coordinates;
      if (payload.code !== 'Ok' || !geometry?.length) {
        throw new Error(
          `OSRM no encontró la ruta: ${payload.message ?? payload.code}.`,
        );
      }
      return geometry;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error('Error desconocido de OSRM.');
      if (attempt < 3) {
        await delay(1_000 * 2 ** attempt);
      }
    }
  }

  throw new Error(
    `No se pudo obtener la ruta de OSRM tras 4 intentos: ${lastError?.message ?? 'sin detalle'}`,
  );
}

async function waitForRateLimit(): Promise<void> {
  const remaining =
    MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt);
  if (remaining > 0) {
    await delay(remaining);
  }
  lastRequestStartedAt = Date.now();
}

function createGate(
  pathCoordinates: Coordinate[],
  atStart: boolean,
): [Coordinate, Coordinate] {
  const centerCoordinate = atStart
    ? pathCoordinates[0]
    : pathCoordinates[pathCoordinates.length - 1];
  const adjacentCoordinate = atStart
    ? pathCoordinates[1]
    : pathCoordinates[pathCoordinates.length - 2];
  const center = toLocal(centerCoordinate, centerCoordinate[1]);
  const adjacent = toLocal(adjacentCoordinate, centerCoordinate[1]);
  const tangent = atStart
    ? { x: adjacent.x - center.x, y: adjacent.y - center.y }
    : { x: center.x - adjacent.x, y: center.y - adjacent.y };
  const magnitude = Math.hypot(tangent.x, tangent.y);
  if (magnitude < 0.1) {
    throw new Error(
      'No se pudo calcular la orientación de la línea de salida/meta.',
    );
  }
  const normal = { x: -tangent.y / magnitude, y: tangent.x / magnitude };
  const halfLengthMeters = 15;
  return [
    fromLocal(
      {
        x: center.x - normal.x * halfLengthMeters,
        y: center.y - normal.y * halfLengthMeters,
      },
      centerCoordinate[1],
    ),
    fromLocal(
      {
        x: center.x + normal.x * halfLengthMeters,
        y: center.y + normal.y * halfLengthMeters,
      },
      centerCoordinate[1],
    ),
  ];
}

function calculateLengthMeters(coordinates: Coordinate[]): number {
  return coordinates
    .slice(1)
    .reduce(
      (total, [lng, lat], index) =>
        total +
        haversineDistance(
          { lat, lng },
          { lat: coordinates[index][1], lng: coordinates[index][0] },
        ),
      0,
    );
}

function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toLocal(
  [lng, lat]: Coordinate,
  referenceLatitude: number,
): { x: number; y: number } {
  const earthRadiusMeters = 6_371_000;
  return {
    x:
      ((lng * Math.PI) / 180) *
      earthRadiusMeters *
      Math.cos((referenceLatitude * Math.PI) / 180),
    y: ((lat * Math.PI) / 180) * earthRadiusMeters,
  };
}

function fromLocal(
  point: { x: number; y: number },
  referenceLatitude: number,
): Coordinate {
  const earthRadiusMeters = 6_371_000;
  return [
    (point.x /
      (earthRadiusMeters * Math.cos((referenceLatitude * Math.PI) / 180))) *
      (180 / Math.PI),
    (point.y / earthRadiusMeters) * (180 / Math.PI),
  ];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
