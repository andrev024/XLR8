import { readFileSync } from 'node:fs';
import type { AttemptTrackPoint } from '../../src/circuits/attempt-detector';

interface RouteFeature {
  properties: {
    circuitName: string;
    description: string;
    lengthMeters: number;
    startLine: [[number, number], [number, number]];
    finishLine: [[number, number], [number, number]];
    coordTimes: string[];
    speedsMs?: number[];
  };
  geometry: {
    coordinates: [number, number][];
  };
}

export interface LoadedRouteFixture {
  circuitName: string;
  description: string;
  lengthMeters: number;
  startLine: [{ lat: number; lng: number }, { lat: number; lng: number }];
  finishLine: [{ lat: number; lng: number }, { lat: number; lng: number }];
  referencePath: { lat: number; lng: number }[];
  points: AttemptTrackPoint[];
}

/** Carga una ruta GPS sintética (GeoJSON Feature con coordTimes) como puntos de intento. */
export function loadRouteFixture(path: string): AttemptTrackPoint[] {
  return loadRouteFixtureData(path).points;
}

export function loadRouteFixtureData(path: string): LoadedRouteFixture {
  const raw = readFileSync(path, 'utf-8');
  const feature = JSON.parse(raw) as RouteFeature;
  if (
    feature.properties.coordTimes.length !==
      feature.geometry.coordinates.length ||
    (feature.properties.speedsMs &&
      feature.properties.speedsMs.length !==
        feature.geometry.coordinates.length)
  ) {
    throw new Error(
      `El fixture ${path} tiene coordenadas y tiempos incompatibles.`,
    );
  }
  const toPoints = (
    line: [[number, number], [number, number]],
  ): LoadedRouteFixture['startLine'] => [
    { lat: line[0][1], lng: line[0][0] },
    { lat: line[1][1], lng: line[1][0] },
  ];

  return {
    circuitName: feature.properties.circuitName,
    description: feature.properties.description,
    lengthMeters: feature.properties.lengthMeters,
    startLine: toPoints(feature.properties.startLine),
    finishLine: toPoints(feature.properties.finishLine),
    referencePath: feature.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    })),
    points: feature.geometry.coordinates.map(([lng, lat], index) => ({
      lat,
      lng,
      recordedAt: new Date(feature.properties.coordTimes[index]),
      speedMs: feature.properties.speedsMs?.[index],
    })),
  };
}
