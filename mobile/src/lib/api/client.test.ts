import MockAdapter from "axios-mock-adapter";
import { client } from "./client";
import { http } from "./http";
import { useAuthStore } from "../../features/auth/store";

describe("client (interceptor de refresh)", () => {
  let clientMock: MockAdapter;
  let httpMock: MockAdapter;

  beforeEach(async () => {
    clientMock = new MockAdapter(client);
    httpMock = new MockAdapter(http);
    await useAuthStore
      .getState()
      .setSession({
        accessToken: "expired-token",
        refreshToken: "refresh-token",
      });
  });

  afterEach(async () => {
    clientMock.restore();
    httpMock.restore();
    await useAuthStore.getState().clearSession();
  });

  it("adjunta el accessToken en cada petición", async () => {
    clientMock.onGet("/vehicles").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer expired-token");
      return [200, []];
    });

    await client.get("/vehicles");
  });

  it("ante un 401 refresca una sola vez y reintenta la petición original", async () => {
    let attempt = 0;
    clientMock.onGet("/vehicles").reply(() => {
      attempt += 1;
      if (attempt === 1) {
        return [401];
      }
      return [200, [{ id: "v1" }]];
    });
    httpMock.onPost("/auth/refresh").reply(200, {
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    const response = await client.get("/vehicles");

    expect(response.data).toEqual([{ id: "v1" }]);
    expect(useAuthStore.getState().accessToken).toBe("new-access-token");
    expect(httpMock.history.post).toHaveLength(1);
  });

  it("pone en cola peticiones concurrentes mientras se refresca una sola vez", async () => {
    let refreshCalls = 0;
    let vehiclesAttempts = 0;
    let profileAttempts = 0;

    clientMock.onGet("/vehicles").reply(() => {
      vehiclesAttempts += 1;
      return vehiclesAttempts === 1 ? [401] : [200, ["vehicle"]];
    });
    clientMock.onGet("/users/me").reply(() => {
      profileAttempts += 1;
      return profileAttempts === 1 ? [401] : [200, { id: "u1" }];
    });
    httpMock.onPost("/auth/refresh").reply(() => {
      refreshCalls += 1;
      return [
        200,
        { accessToken: "new-access-token", refreshToken: "new-refresh-token" },
      ];
    });

    const [vehiclesRes, profileRes] = await Promise.all([
      client.get("/vehicles"),
      client.get("/users/me"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(vehiclesRes.data).toEqual(["vehicle"]);
    expect(profileRes.data).toEqual({ id: "u1" });
  });

  it("cierra la sesión si el refresh falla", async () => {
    clientMock.onGet("/vehicles").reply(401);
    httpMock.onPost("/auth/refresh").reply(401);

    await expect(client.get("/vehicles")).rejects.toBeTruthy();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
