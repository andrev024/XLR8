import {
  formatLeaderboardTime,
  getInitialLeaderboardCategory,
  updateLeaderboardCategory,
} from "./logic";

describe("circuit category and display logic", () => {
  it("initializes the leaderboard filters from the first user vehicle", () => {
    expect(
      getInitialLeaderboardCategory([
        {
          id: "vehicle-1",
          userId: "user-1",
          type: "CAR",
          brand: "Mazda",
          model: "MX-5",
          horsepower: 181,
          powerCategory: "MID",
          year: 2022,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]),
    ).toEqual({
      vehicleType: "CAR",
      powerCategory: "MID",
      period: "ALL_TIME",
    });
  });

  it("uses a safe default without vehicles and preserves unchanged filters", () => {
    const initial = getInitialLeaderboardCategory([]);
    expect(initial).toEqual({
      vehicleType: "MOTORCYCLE",
      powerCategory: "LOW",
      period: "ALL_TIME",
    });
    expect(
      updateLeaderboardCategory(initial, { powerCategory: "HIGH" }),
    ).toEqual({
      vehicleType: "MOTORCYCLE",
      powerCategory: "HIGH",
      period: "ALL_TIME",
    });
  });

  it("formats leaderboard times as mm:ss.mmm", () => {
    expect(formatLeaderboardTime(65_432)).toBe("01:05.432");
    expect(formatLeaderboardTime(9)).toBe("00:00.009");
    expect(formatLeaderboardTime(3_661_999)).toBe("61:01.999");
  });
});
