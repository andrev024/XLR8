import path from 'node:path';
import {
  detectCircuitAttempts,
  type GateLine,
} from '../circuits/attempt-detector';
import {
  calculatePathLength,
  generateRouteScenario,
  SIMULATION_SCENARIOS,
  type SimulationScenario,
} from './route-generator';
import { loadRouteFixtureData } from '../../test/fixtures/load-route-fixture';

const referencePath = [
  { lat: 4.63, lng: -74.09 },
  { lat: 4.64, lng: -74.075 },
  { lat: 4.65, lng: -74.09 },
];
const startLine = createGate(referencePath[0], { x: 0.555, y: -0.832 });
const finishLine = createGate(referencePath[2], { x: 0.832, y: -0.555 });
const circuitLengthMeters = calculatePathLength(referencePath);

describe('route scenario generator', () => {
  it.each(SIMULATION_SCENARIOS)(
    'generates the declared detector result for %s',
    (scenario) => {
      const generated = generate(scenario);
      const detected = detectCircuitAttempts(
        generated.points,
        startLine,
        finishLine,
        circuitLengthMeters,
      );
      const expectation = generated.expectation;
      expect(detected).toHaveLength(expectation.attempts.length);
      detected.forEach((attempt, index) => {
        expect(attempt.isValid).toBe(expectation.attempts[index].isValid);
        expect(attempt.invalidReason).toBe(
          expectation.attempts[index].invalidReason,
        );
      });
    },
  );

  it.each(SIMULATION_SCENARIOS)(
    '%s has strictly increasing timestamps',
    (scenario) => {
      const points = generate(scenario).points;
      for (let index = 1; index < points.length; index += 1) {
        expect(points[index].recordedAt.getTime()).toBeGreaterThan(
          points[index - 1].recordedAt.getTime(),
        );
      }
    },
  );

  it('uses a smooth launch profile and respects a configurable speed cap', () => {
    const straightPath = [referencePath[0], referencePath[2]];
    const points = generateRouteScenario(straightPath, {
      scenario: 'VALID',
      startLine,
      finishLine,
      circuitLengthMeters: calculatePathLength(straightPath),
      maxSpeedKmh: 95,
      noiseMeters: 0,
    }).points;
    expect(points[0].speedMs * 3.6).toBeLessThan(points[10].speedMs * 3.6);
    expect(
      Math.max(...points.map((point) => point.speedMs * 3.6)),
    ).toBeLessThanOrEqual(95);
  });

  it('keeps routed fixtures at one-second intervals with smooth, capped speeds', () => {
    const fixture = loadRouteFixtureData(
      path.join(
        __dirname,
        '../../test/fixtures/circuit-avenida-boyaca-route.geojson',
      ),
    );
    const speeds = fixture.points.map((point) => (point.speedMs ?? 0) * 3.6);

    for (let index = 1; index < fixture.points.length; index += 1) {
      expect(
        fixture.points[index].recordedAt.getTime() -
          fixture.points[index - 1].recordedAt.getTime(),
      ).toBe(1_000);
      expect(Math.abs(speeds[index] - speeds[index - 1])).toBeLessThanOrEqual(
        9.01,
      );
    }
    expect(Math.max(...speeds)).toBeLessThanOrEqual(105);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(10);
  });

  it('can make the generated position noise deterministic', () => {
    expect(generate('VALID', { noiseMeters: 3, seed: 12 }).points).toEqual(
      generate('VALID', { noiseMeters: 3, seed: 12 }).points,
    );
  });

  it('creates a GPS jump of hundreds of meters without a long signal gap', () => {
    const points = generate('GPS_JUMP').points;
    expect(calculatePathLength(points)).toBeGreaterThan(
      circuitLengthMeters * 1.25,
    );
    const speeds = points.slice(1).map((point, index) => {
      const distance = calculatePathLength([points[index], point]);
      return (distance / 1) * 3.6;
    });
    expect(Math.max(...speeds)).toBeLessThan(350);
    expect(Math.max(...speeds)).toBeGreaterThan(200);
  });
});

function generate(
  scenario: SimulationScenario,
  overrides: { maxSpeedKmh?: number; noiseMeters?: number; seed?: number } = {},
) {
  return generateRouteScenario(referencePath, {
    scenario,
    startLine,
    finishLine,
    circuitLengthMeters,
    noiseMeters: 0,
    ...overrides,
  });
}

function createGate(
  center: { lat: number; lng: number },
  direction: { x: number; y: number },
): GateLine {
  const longitudeMeters = 1 / Math.cos((center.lat * Math.PI) / 180);
  const offsetLng = (direction.x * 80) / (111_320 * longitudeMeters);
  const offsetLat = (direction.y * 80) / 111_320;
  return [
    { lat: center.lat - offsetLat, lng: center.lng - offsetLng },
    { lat: center.lat + offsetLat, lng: center.lng + offsetLng },
  ];
}
