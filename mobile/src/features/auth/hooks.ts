import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, loginRequest, logoutRequest, registerRequest } from "./api";
import { useAuthStore } from "./store";
import type { LoginFormValues, RegisterFormValues } from "./schemas";

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterFormValues) => registerRequest(input),
  });
}

export function useLoginMutation() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: LoginFormValues) => loginRequest(input),
    onSuccess: async (tokens) => {
      await setSession(tokens);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    },
    onSettled: async () => {
      await clearSession();
      queryClient.clear();
    },
  });
}

export function useMeQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["users", "me"],
    queryFn: fetchMe,
    enabled: isAuthenticated,
  });
}
