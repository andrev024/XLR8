import { useAuthStore } from "./store";

describe("useAuthStore", () => {
  beforeEach(async () => {
    await useAuthStore.getState().clearSession();
    useAuthStore.setState({ isHydrated: false });
  });

  it("empieza sin sesión y sin hidratar", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it("hydrate marca isHydrated true aunque no haya tokens guardados", async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("setSession guarda los tokens y marca al usuario como autenticado", async () => {
    await useAuthStore.getState().setSession(
      { accessToken: "access-1", refreshToken: "refresh-1" },
      {
        id: "u1",
        email: "piloto@xlr8.app",
        displayName: "Piloto",
      },
    );

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("access-1");
    expect(state.refreshToken).toBe("refresh-1");
    expect(state.user?.email).toBe("piloto@xlr8.app");
  });

  it("clearSession borra la sesión", async () => {
    await useAuthStore
      .getState()
      .setSession({ accessToken: "a", refreshToken: "r" });
    await useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("setTokens rota el par de tokens manteniendo la sesión activa", async () => {
    await useAuthStore
      .getState()
      .setSession({ accessToken: "a1", refreshToken: "r1" });
    await useAuthStore.getState().setTokens("a2", "r2");

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("a2");
    expect(state.refreshToken).toBe("r2");
    expect(state.isAuthenticated).toBe(true);
  });
});
