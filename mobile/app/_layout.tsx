import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/api/query-client";
import { useAuthStore } from "../src/features/auth/store";
import { colors } from "../src/theme/colors";
import "./../src/features/recording/location-task";
import { getUnfinishedSession } from "../src/features/recording/database";
import {
  discardRecording,
  restoreUnfinishedRecording,
} from "../src/features/recording/service";
import { syncActivityUploadQueue } from "../src/features/recording/upload-queue";

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        <RecordingLifecycle />
        <FirstLaunchLegalNotice />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function FirstLaunchLegalNotice() {
  const presented = useRef(false);

  useEffect(() => {
    if (presented.current) {
      return;
    }
    presented.current = true;
    void SecureStore.getItemAsync("xlr8_legal_notice_accepted")
      .then((accepted) => {
        if (accepted === "true") {
          return;
        }
        Alert.alert(
          "Aviso legal",
          "Proyecto educativo. Respeta siempre las normas de tránsito y los límites de velocidad.",
          [
            {
              text: "Entendido",
              onPress: () => {
                void SecureStore.setItemAsync(
                  "xlr8_legal_notice_accepted",
                  "true",
                ).catch((error: unknown) => {
                  console.error("No se pudo guardar la aceptación legal:", error);
                  Alert.alert(
                    "Aviso legal",
                    "No se pudo guardar tu preferencia. El aviso volverá a mostrarse al abrir la app.",
                  );
                });
              },
            },
          ],
          { cancelable: false },
        );
      })
      .catch((error: unknown) => {
        console.error("No se pudo comprobar el aviso legal:", error);
        Alert.alert(
          "Aviso legal",
          "Proyecto educativo. Respeta siempre las normas de tránsito y los límites de velocidad.",
          [{ text: "Entendido" }],
          { cancelable: false },
        );
      });
  }, []);

  return null;
}

function RecordingLifecycle() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const prompted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || prompted.current) {
      return;
    }

    void getUnfinishedSession()
      .then((session) => {
        if (!session || prompted.current) {
          return;
        }
        prompted.current = true;
        Alert.alert(
          "Grabación sin finalizar",
          "Hay una ruta guardada en este dispositivo. ¿Quieres reanudarla o descartarla?",
          [
            {
              text: "Descartar",
              style: "destructive",
              onPress: () => {
                void restoreUnfinishedRecording()
                  .then(discardRecording)
                  .catch(showRecoveryError);
              },
            },
            {
              text: "Reanudar",
              onPress: () => {
                void restoreUnfinishedRecording()
                  .then(() => router.push("/(app)/recording"))
                  .catch(showRecoveryError);
              },
            },
          ],
          { cancelable: false },
        );
      })
      .catch(showRecoveryError);
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const syncIfActive = (state: AppStateStatus) => {
      if (state === "active") {
        void syncActivityUploadQueue().catch((error: unknown) =>
          console.error("No se pudo revisar la cola de actividades:", error),
        );
      }
    };

    syncIfActive(AppState.currentState);
    const subscription = AppState.addEventListener("change", syncIfActive);
    const retryTimer = setInterval(() => {
      if (AppState.currentState === "active") {
        syncIfActive("active");
      }
    }, 30_000);

    return () => {
      subscription.remove();
      clearInterval(retryTimer);
    };
  }, [isAuthenticated]);

  return null;
}

function showRecoveryError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : "No se pudo recuperar la grabación.";
  Alert.alert("Error de grabación", message);
}
