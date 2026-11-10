jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
}));

jest.mock("expo-task-manager", () => ({
  isTaskDefined: jest.fn(() => true),
  defineTask: jest.fn(),
}));

import * as Location from "expo-location";
import { requestRecordingLocationPermissions } from "./location-task";

describe("recording location permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: true,
    } as Location.LocationPermissionResponse);
    jest.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
      granted: true,
    } as Location.LocationPermissionResponse);
  });

  it("requests background access on Android for background recording", async () => {
    await requestRecordingLocationPermissions("android");

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("requests always-on permission on iOS for background recording", async () => {
    await requestRecordingLocationPermissions("ios");

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("explains when Android background access is not granted", async () => {
    jest.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Location.LocationPermissionResponse);

    await expect(
      requestRecordingLocationPermissions("android"),
    ).rejects.toThrow(
      "En Ajustes > Aplicaciones > XLR8 > Permisos > Ubicación, selecciona Permitir siempre para mantener la grabación activa.",
    );
  });

  it("explains when device location services are disabled", async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);

    await expect(
      requestRecordingLocationPermissions("android"),
    ).rejects.toThrow("Activa los servicios de ubicación para grabar.");
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
