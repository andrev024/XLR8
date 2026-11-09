import { create } from "zustand";
import { secureStorage } from "../../lib/storage/secure-storage";
import type { AuthenticatedUser } from "./types";

const ACCESS_TOKEN_KEY = "xlr8_access_token";
const REFRESH_TOKEN_KEY = "xlr8_refresh_token";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthenticatedUser | null;
  isHydrated: boolean;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  setSession: (
    tokens: TokenPairInput,
    user?: AuthenticatedUser | null,
  ) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: AuthenticatedUser | null) => void;
  clearSession: () => Promise<void>;
}

interface TokenPairInput {
  accessToken: string;
  refreshToken: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isHydrated: false,
  isAuthenticated: false,

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.getItem(ACCESS_TOKEN_KEY),
      secureStorage.getItem(REFRESH_TOKEN_KEY),
    ]);
    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && refreshToken),
      isHydrated: true,
    });
  },

  setSession: async (tokens, user = null) => {
    await Promise.all([
      secureStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
      secureStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
      isAuthenticated: true,
    });
  },

  setTokens: async (accessToken, refreshToken) => {
    await Promise.all([
      secureStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
      secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setUser: (user) => set({ user }),

  clearSession: async () => {
    await Promise.all([
      secureStorage.removeItem(ACCESS_TOKEN_KEY),
      secureStorage.removeItem(REFRESH_TOKEN_KEY),
    ]);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
