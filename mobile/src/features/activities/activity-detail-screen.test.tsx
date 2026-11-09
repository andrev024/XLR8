import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import MockAdapter from "axios-mock-adapter";
import { client } from "../../lib/api/client";
import { useAuthStore } from "../auth/store";
import ActivityDetailScreen from "../../../app/(app)/activities/[id]";

const mockFitBounds = jest.fn();

jest.mock("@maplibre/maplibre-react-native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  function Container({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) {
    return React.createElement(View, { testID }, children);
  }

  const Camera = React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      easeTo: jest.fn(),
      fitBounds: mockFitBounds,
    }));
    return null;
  });
  Camera.displayName = "MockCamera";

  function GeoJSONSource({
    children,
    id,
  }: {
    children?: React.ReactNode;
    id: string;
  }) {
    return React.createElement(View, { testID: `source-${id}` }, children);
  }

  function Layer({ id }: { id: string }) {
    return React.createElement(View, { testID: `map-layer-${id}` });
  }

  return {
    Camera,
    GeoJSONSource,
    Layer,
    Map: Container,
  };
});

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "activity-1" }),
  useRouter: () => ({ replace: jest.fn() }),
}));

describe("activity detail route map", () => {
  let api: MockAdapter;

  beforeEach(async () => {
    mockFitBounds.mockClear();
    api = new MockAdapter(client);
    await useAuthStore.getState().setSession({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
    });
    api.onGet("/activities/activity-1").reply(200, {
      id: "activity-1",
      vehicleId: "vehicle-1",
      vehicle: {
        id: "vehicle-1",
        type: "MOTORCYCLE",
        brand: "Yamaha",
        model: "MT-07",
      },
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:00:20.000Z",
      distanceMeters: 325,
      durationSeconds: 20,
      avgSpeedKmh: 58.5,
      maxSpeedKmh: 71.2,
      simplifiedPath: {
        type: "LineString",
        coordinates: [
          [-74.116, 4.62],
          [-74.113, 4.625],
          [-74.109, 4.631],
        ],
      },
      circuitAttempts: [],
    });
  });

  afterEach(async () => {
    api.restore();
    await useAuthStore.getState().clearSession();
  });

  it("renders a route layer and fits the camera to the route bounds", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <ActivityDetailScreen />
      </QueryClientProvider>,
    );

    try {
      expect(await view.findByText("Yamaha MT-07")).toBeTruthy();
      expect(await view.findByTestId("map-layer-xlr8-route-line")).toBeTruthy();
      expect(mockFitBounds).toHaveBeenCalledWith(
        [-74.116, 4.62, -74.109, 4.631],
        expect.objectContaining({
          padding: { top: 28, right: 28, bottom: 28, left: 28 },
        }),
      );
    } finally {
      await view.unmount();
      queryClient.clear();
    }
  });
});
