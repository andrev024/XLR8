import { http } from "../../lib/api/http";
import { client } from "../../lib/api/client";
import type { AuthenticatedUser, TokenPair, UserProfile } from "./types";
import type { LoginFormValues, RegisterFormValues } from "./schemas";

export function registerRequest(
  input: RegisterFormValues,
): Promise<AuthenticatedUser> {
  return http
    .post<AuthenticatedUser>("/auth/register", input)
    .then((res) => res.data);
}

export function loginRequest(input: LoginFormValues): Promise<TokenPair> {
  return http.post<TokenPair>("/auth/login", input).then((res) => res.data);
}

export function logoutRequest(refreshToken: string): Promise<void> {
  return http.post("/auth/logout", { refreshToken }).then(() => undefined);
}

export function fetchMe(): Promise<UserProfile> {
  return client.get<UserProfile>("/users/me").then((res) => res.data);
}
