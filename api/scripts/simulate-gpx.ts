import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '../generated/prisma';
import { generateRouteScenario, SIMULATION_SCENARIOS } from '../src/simulation/route-generator';

interface CircuitGeometry {
  id: string;
  name: string;
  lengthMeters: number;
  startLine: string;
  finishLine: string;
  referencePath: string;
}

interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

const prisma = new PrismaClient();
const outputDirectory = path.resolve('test/fixtures/gpx');

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const circuits = await prisma.$queryRaw<CircuitGeometry[]>`
    SELECT
      "id",
      "name",
      "lengthMeters",
      ST_AsGeoJSON("startLine") AS "startLine",
      ST_AsGeoJSON("finishLine") AS "finishLine",
      ST_AsGeoJSON("referencePath") AS "referencePath"
    FROM "Circuit"
    WHERE "referencePath" IS NOT NULL
    ORDER BY "name"
  `;
  if (circuits.length === 0) {
    throw new Error('No hay circuitos con ruta de referencia para exportar.');
  }

  for (const circuit of circuits) {
    const startLine = toGateLine(JSON.parse(circuit.startLine) as GeoJsonLineString);
    const finishLine = toGateLine(JSON.parse(circuit.finishLine) as GeoJsonLineString);
    const referencePath = (
      JSON.parse(circuit.referencePath) as GeoJsonLineString
    ).coordinates.map(([lng, lat]) => ({ lat, lng }));
    for (const scenario of SIMULATION_SCENARIOS) {
      const generated = generateRouteScenario(referencePath, {
        scenario,
        startLine,
        finishLine,
        circuitLengthMeters: circuit.lengthMeters,
        noiseMeters: 1.2,
        seed: `${circuit.id}:${scenario}`
          .split('')
          .reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0, 0),
      });
      const filename = `${slug(circuit.name)}__${scenario.toLowerCase()}.gpx`;
      await writeFile(
        path.join(outputDirectory, filename),
        toGpx(circuit.name, scenario, generated.points),
        'utf8',
      );
      console.log(`Exportado ${filename} (${generated.points.length} puntos)`);
    }
  }
}

function toGateLine(
  line: GeoJsonLineString,
): [{ lat: number; lng: number }, { lat: number; lng: number }] {
  const first = line.coordinates[0];
  const last = line.coordinates[line.coordinates.length - 1];
  return [
    { lat: first[1], lng: first[0] },
    { lat: last[1], lng: last[0] },
  ];
}

function toGpx(
  circuitName: string,
  scenario: string,
  points: { lat: number; lng: number; recordedAt: Date }[],
): string {
  const trackPoints = points
    .map(
      (point) =>
        `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lng.toFixed(7)}"><time>${point.recordedAt.toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="XLR8 route simulator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(circuitName)} — ${scenario}</name></metadata>
  <trk><name>${escapeXml(circuitName)} — ${scenario}</name><trkseg>
${trackPoints}
  </trkseg></trk>
</gpx>
`;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
