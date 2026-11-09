import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "../env";
import { http } from "./http";
import { useAuthStore } from "../../features/auth/store";
import type { TokenPair } from "../../features/auth/types";

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Cliente autenticado: adjunta el accessToken y rota el refresh token ante un 401. */
export const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let pendingQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

function resolveQueue(error: unknown, token: string | null) {
  for (const pending of pendingQueue) {
    if (error || !token) {
      pending.reject(error);
    } else {
      pending.resolve(token);
    }
  }
  pendingQueue = [];
}

client.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.set("Authorization", `Bearer ${token}`);
            resolve(client(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const { refreshToken, clearSession, setTokens } = useAuthStore.getState();
    if (!refreshToken) {
      await clearSession();
      resolveQueue(error, null);
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const { data } = await http.post<TokenPair>("/auth/refresh", {
        refreshToken,
      });
      await setTokens(data.accessToken, data.refreshToken);
      resolveQueue(null, data.accessToken);
      originalRequest.headers.set(
        "Authorization",
        `Bearer ${data.accessToken}`,
      );
      return client(originalRequest);
    } catch (refreshError) {
      resolveQueue(refreshError, null);
      await clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
