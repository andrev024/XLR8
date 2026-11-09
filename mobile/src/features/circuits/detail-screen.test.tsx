import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import MockAdapter from "axios-mock-adapter";
import { client } from "../../lib/api/client";
import { useAuthStore } from "../auth/store";
import CircuitDetailScreen from "../../../app/(app)/circuits/[id]";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "circuit-1" }),
}));

jest.mock("./components/CircuitMap", () => ({
  CircuitMap: () => null,
}));

describe("circuit detail screen", () => {
  let api: MockAdapter;

  beforeEach(async () => {
    api = new MockAdapter(client);
    await useAuthStore.getState().setSession({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
    });
    api.onGet("/circuits/circuit-1").reply(200, {
      id: "circuit-1",
      name: "Circuito de prueba",
      description: "Ruta de demostración",
      lengthMeters: 2400,
      createdAt: "2026-01-01T00:00:00.000Z",
      startLine: {
        type: "LineString",
        coordinates: [
          [-74.09, 4.63],
          [-74.089, 4.63],
        ],
      },
      finishLine: {
        type: "LineString",
        coordinates: [
          [-74.09, 4.65],
          [-74.089, 4.65],
        ],
      },
      referencePath: {
        type: "LineString",
        coordinates: [
          [-74.09, 4.63],
          [-74.09, 4.65],
        ],
      },
    });
    api.onGet("/vehicles").reply(200, []);
    api.onGet("/users/me").reply(200, {
      id: "user-1",
      email: "rider@example.com",
      displayName: "Piloto",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    api.onGet("/circuits/circuit-1/leaderboard").reply(200, [
      {
        position: 1,
        attemptId: "attempt-1",
        userId: "user-1",
        displayName: "Piloto",
        durationMs: 65_432,
        vehicleBrand: "Yamaha",
        vehicleModel: "MT-07",
        date: "2026-01-02T00:00:00.000Z",
      },
    ]);
    api.onGet("/circuits/circuit-1/leaderboard/me").reply(200, {
      bestTimeMs: 65_432,
      position: 1,
    });
    api.onGet("/circuits/circuit-1/my-attempts").reply(200, [
      {
        id: "attempt-1",
        durationMs: 65_432,
        maxSpeedKmh: 120,
        isValid: true,
        invalidReason: null,
        vehicleType: "MOTORCYCLE",
        powerCategory: "LOW",
        startedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  afterEach(async () => {
    api.restore();
    await useAuthStore.getState().clearSession();
  });

  it("loads the circuit, ranking and personal attempts from the mocked API", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <CircuitDetailScreen />
      </QueryClientProvider>,
    );

    try {
      expect(await view.findByText("Circuito de prueba")).toBeTruthy();
      expect(await view.findByText("Válido")).toBeTruthy();
      expect(await view.findAllByText("01:05.432")).toHaveLength(2);
      expect(
        await view.findByText("01:05.432 · posición #1"),
      ).toBeTruthy();
      expect(await view.findByText("Piloto")).toBeTruthy();
      expect(api.history.get).toHaveLength(6);
    } finally {
      await view.unmount();
      queryClient.clear();
    }
  });
});
