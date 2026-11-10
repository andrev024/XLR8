import {
  calculateRecordingStats,
  evaluateAutoStart,
  filterTrackPoints,
  syncQueuedActivities,
  transitionRecordingStatus,
  type TrackPoint,
} from "./recording-logic";

const point = (
  lat: number,
  lng: number,
  recordedAt: string,
  speedMs: number | null,
  accuracy = 4,
): TrackPoint => ({ lat, lng, recordedAt, speedMs, accuracy });

describe("recording logic", () => {
  it("calculates distance, duration and speeds from GPS points", () => {
    const stats = calculateRecordingStats(
      [
        point(4.6, -74, "2026-01-01T00:00:00.000Z", 10),
        point(4.61, -74, "2026-01-01T00:01:00.000Z", 20),
      ],
      60_000,
    );

    expect(stats.distanceMeters).toBeGreaterThan(1_000);
    expect(stats.currentSpeedKmh).toBe(72);
    expect(stats.maxSpeedKmh).toBe(72);
    expect(stats.averageSpeedKmh).toBeGreaterThan(60);
    expect(stats.elapsedMs).toBe(60_000);
  });

  it("counts moving and stopped time separately", () => {
    const stats = calculateRecordingStats(
      [
        point(4.6, -74, "2026-01-01T00:00:00.000Z", 5),
        point(4.601, -74, "2026-01-01T00:00:10.000Z", 0),
        point(4.601, -74, "2026-01-01T00:00:20.000Z", 0),
      ],
      20_000,
    );

    expect(stats.movingTimeMs).toBe(10_000);
    expect(stats.stoppedTimeMs).toBe(10_000);
  });

  it("starts automatically only after sustained, measured movement", () => {
    const result = evaluateAutoStart(
      [],
      [
        point(4.6, -74, "2026-01-01T00:00:00.000Z", 4),
        point(4.6002, -74, "2026-01-01T00:00:05.000Z", 4),
        point(4.6004, -74, "2026-01-01T00:00:10.000Z", 4),
      ],
    );

    expect(result.candidatePoints).toEqual([]);
    expect(result.startedPoints).toHaveLength(3);
  });

  it("clears automatic start candidates when movement is too slow", () => {
    const result = evaluateAutoStart(
      [
        point(4.6, -74, "2026-01-01T00:00:00.000Z", 4),
        point(4.6002, -74, "2026-01-01T00:00:05.000Z", 4),
      ],
      [point(4.6002, -74, "2026-01-01T00:00:10.000Z", 0.5)],
    );

    expect(result.candidatePoints).toEqual([]);
    expect(result.startedPoints).toBeNull();
  });

  it("allows only valid recording state transitions", () => {
    expect(transitionRecordingStatus("idle", { type: "START" })).toBe(
      "recording",
    );
    expect(transitionRecordingStatus("recording", { type: "PAUSE" })).toBe(
      "paused",
    );
    expect(transitionRecordingStatus("paused", { type: "RESUME" })).toBe(
      "recording",
    );
    expect(transitionRecordingStatus("recording", { type: "FINISH" })).toBe(
      "finished",
    );
    expect(() =>
      transitionRecordingStatus("idle", { type: "PAUSE" }),
    ).toThrow();
  });

  it("filters GPS points whose accuracy is over 50 metres", () => {
    const points = [
      point(4.6, -74, "2026-01-01T00:00:00Z", 4, 50),
      point(4.6, -74, "2026-01-01T00:00:01Z", 4, 51),
    ];
    expect(filterTrackPoints(points)).toEqual([points[0]]);
  });

  it("retains failed uploads in the retry queue and records successful ones", async () => {
    const markSynced = jest.fn().mockResolvedValue(undefined);
    const markFailed = jest.fn().mockResolvedValue(undefined);
    const result = await syncQueuedActivities(
      [
        { id: "ok", attempts: 0, payload: { session: "ok" } },
        { id: "offline", attempts: 2, payload: { session: "offline" } },
      ],
      async (payload) => {
        if ((payload as { session: string }).session === "offline") {
          throw new Error("sin conexión");
        }
        return { activityId: "activity-1" };
      },
      markSynced,
      markFailed,
    );

    expect(result.syncedIds).toEqual(["ok"]);
    expect(result.failures).toHaveLength(1);
    expect(markSynced).toHaveBeenCalledWith("ok", { activityId: "activity-1" });
    expect(markFailed).toHaveBeenCalledWith(
      "offline",
      3,
      expect.objectContaining({ message: "sin conexión" }),
    );
  });
});
