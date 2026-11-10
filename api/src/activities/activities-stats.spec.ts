import { computeActivityStats, type FilteredPoint } from './activities.service';

describe('computeActivityStats', () => {
  it('calculates moving, stopped, elevation, and GPS accuracy statistics', () => {
    const points: FilteredPoint[] = [
      {
        lat: 4.6,
        lng: -74,
        recordedAt: new Date('2026-01-01T00:00:00.000Z'),
        speedMs: 5,
        accuracy: 6,
        altitudeMeters: 100,
      },
      {
        lat: 4.601,
        lng: -74,
        recordedAt: new Date('2026-01-01T00:00:10.000Z'),
        speedMs: 0,
        accuracy: 7,
        altitudeMeters: 110,
      },
      {
        lat: 4.601,
        lng: -74,
        recordedAt: new Date('2026-01-01T00:00:20.000Z'),
        speedMs: 0,
        accuracy: 5,
        altitudeMeters: 110,
      },
    ];

    const stats = computeActivityStats(
      points,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:20.000Z',
      8,
    );

    expect(stats.distanceMeters).toBeGreaterThan(100);
    expect(stats.movingDurationSeconds).toBe(10);
    expect(stats.stoppedDurationSeconds).toBe(10);
    expect(stats.elevationGainMeters).toBe(10);
    expect(stats.averageAccuracyMeters).toBe(6);
    expect(stats.maxSpeedKmh).toBe(18);
    expect(stats.estimatedFuelLiters).toBeCloseTo(
      (stats.distanceMeters / 100_000) * 8,
    );
  });
});
