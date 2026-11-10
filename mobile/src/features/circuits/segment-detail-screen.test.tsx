import { fireEvent, render } from "@testing-library/react-native";
import RouteSegmentDetailScreen from "../../../app/(app)/segments/[id]";

const mockPush = jest.fn();
let mockSegmentId = "beta";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: mockSegmentId }),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock("./components/CircuitMap", () => ({
  CircuitMap: () => null,
}));

describe("shared route segment detail screen", () => {
  it("shows the map details and offers personal activity recording", async () => {
    const view = await render(<RouteSegmentDetailScreen />);

    expect(view.getByText("Beta · Segmento")).toBeTruthy();
    expect(view.getByText("~435 m · Vía pública")).toBeTruthy();
    expect(view.getByText("Inicio: Caracolitos Uniformes")).toBeTruthy();
    expect(
      view.getByText(/no tienen cronómetro competitivo ni ranking/),
    ).toBeTruthy();

    await fireEvent.press(view.getByText("Grabar recorrido personal"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/recording");
  });

  it("opens the shared closed route without competitive rankings", async () => {
    mockSegmentId = "zeta";
    const view = await render(<RouteSegmentDetailScreen />);

    expect(view.getByText("Zeta · Ruta cerrada")).toBeTruthy();
    expect(view.getByText("~4.3 km · Vía pública")).toBeTruthy();
    expect(
      view.getByText(/no tienen cronómetro competitivo ni ranking/),
    ).toBeTruthy();
  });
});
