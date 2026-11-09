import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { RouteMap } from "../../src/components/RouteMap";
import { Screen } from "../../src/components/Screen";
import { useVehiclesQuery } from "../../src/features/vehicles/hooks";
import type { Vehicle } from "../../src/features/vehicles/types";
import { calculateRecordingStats } from "../../src/features/recording/recording-logic";
import {
  beginRecording,
  discardRecording,
  finishRecording,
  pauseRecording,
  resumeRecording,
} from "../../src/features/recording/service";
import { useRecordingStore } from "../../src/features/recording/store";
import { formatDistance } from "../../src/features/activities/format";
import { colors } from "../../src/theme/colors";

export default function RecordingScreen() {
  const router = useRouter();
  const vehiclesQuery = useVehiclesQuery();
  const recording = useRecordingStore();
  const [selectedVehicleChoice, setSelectedVehicleChoice] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const elapsedMs =
    recording.elapsedMs +
    (recording.status === "recording" && recording.activeSinceMs !== null
      ? Math.max(0, now - recording.activeSinceMs)
      : 0);
  const calculatedStats = calculateRecordingStats(recording.points, elapsedMs);
  const stats =
    recording.status === "recording"
      ? calculatedStats
      : { ...calculatedStats, currentSpeedKmh: 0 };
  const selectedVehicleId = recording.vehicleId ?? selectedVehicleChoice;
  const selectedVehicle = vehiclesQuery.data?.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  if (vehiclesQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando vehículos…" />
      </Screen>
    );
  }
  if (vehiclesQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message="No se pudieron cargar tus vehículos."
          onRetry={() => void vehiclesQuery.refetch()}
        />
      </Screen>
    );
  }

  const vehicles = vehiclesQuery.data ?? [];
  const active =
    recording.status === "recording" || recording.status === "paused";

  async function handleStart(vehicle: Vehicle): Promise<void> {
    setErrorMessage(null);
    try {
      await beginRecording(vehicle.id);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleAction(action: () => Promise<void>): Promise<void> {
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  function handleDiscard(): void {
    Alert.alert(
      "Descartar grabación",
      "Se eliminarán de este dispositivo la sesión y todos sus puntos GPS.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: () => void handleAction(discardRecording),
        },
      ],
    );
  }

  if (recording.status === "finished") {
    return (
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Resumen de ruta</Text>
          <RouteMap points={recording.points} height={300} />
          <Statistics stats={stats} />
          {recording.circuitAttempts.length > 0 && (
            <View style={styles.summaryAttempts}>
              <Text style={styles.sectionTitle}>Intentos de circuito</Text>
              {recording.circuitAttempts.map((attempt) => (
                <View key={attempt.id} style={styles.summaryAttempt}>
                  <Text style={styles.vehicleName}>{attempt.circuitName}</Text>
                  <Text style={styles.meta}>
                    {(attempt.durationMs / 1000).toFixed(3)} s
                    {!attempt.isValid
                      ? " · intento no válido"
                      : attempt.topThreePosition
                        ? ` · entró al top 3 (#${attempt.topThreePosition})`
                        : " · no entró al top 3"}
                  </Text>
                  {attempt.rankingError ? (
                    <Text style={styles.warning}>
                      No se pudo confirmar el ranking: {attempt.rankingError}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {recording.syncMessage ? (
            <Text style={styles.warning}>{recording.syncMessage}</Text>
          ) : (
            <Text style={styles.success}>
              Actividad guardada y sincronizada.
            </Text>
          )}
          {recording.points.length > 0 && (
            <Text style={styles.meta}>
              Vehículo: {selectedVehicle?.brand ?? "XLR8"}{" "}
              {selectedVehicle?.model ?? ""}
            </Text>
          )}
          <Button
            label="Ver mis actividades"
            onPress={() => router.replace("/(app)")}
          />
          <Button
            label="Grabar otra ruta"
            variant="secondary"
            onPress={() => {
              recording.reset();
              setErrorMessage(null);
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Grabar ruta</Text>
        {!active && (
          <View style={styles.vehicleSection}>
            <Text style={styles.sectionTitle}>Elige un vehículo</Text>
            {vehicles.length === 0 ? (
              <Text style={styles.meta}>
                Primero agrega un vehículo en la pestaña Vehículos.
              </Text>
            ) : (
              vehicles.map((vehicle) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selectedVehicleId === vehicle.id,
                  }}
                  key={vehicle.id}
                  onPress={() => setSelectedVehicleChoice(vehicle.id)}
                  style={[
                    styles.vehicle,
                    selectedVehicleId === vehicle.id && styles.vehicleSelected,
                  ]}
                >
                  <Text style={styles.vehicleName}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                  <Text style={styles.meta}>
                    {vehicle.type === "MOTORCYCLE" ? "Moto" : "Carro"}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <RouteMap
          points={recording.points}
          followLatest={active}
          height={270}
        />
        {active && <Statistics stats={stats} />}
        {recording.syncMessage && (
          <Text style={styles.warning}>{recording.syncMessage}</Text>
        )}
        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        {recording.status === "idle" && selectedVehicle ? (
          <Button
            label="Iniciar grabación"
            onPress={() => void handleStart(selectedVehicle)}
          />
        ) : null}
        {recording.status === "recording" ? (
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button
                label="Pausar"
                variant="secondary"
                onPress={() => void handleAction(pauseRecording)}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                label="Finalizar"
                onPress={() => void handleAction(finishRecording)}
                disabled={recording.points.length < 2}
              />
            </View>
          </View>
        ) : null}
        {recording.status === "paused" ? (
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button
                label="Reanudar"
                onPress={() => void handleAction(resumeRecording)}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                label="Finalizar"
                variant="secondary"
                onPress={() => void handleAction(finishRecording)}
                disabled={recording.points.length < 2}
              />
            </View>
          </View>
        ) : null}
        {active && (
          <Button
            label="Descartar sesión"
            variant="danger"
            onPress={handleDiscard}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Statistics({
  stats,
}: {
  stats: ReturnType<typeof calculateRecordingStats>;
}) {
  return (
    <View style={styles.stats}>
      <Stat label="Tiempo" value={formatClock(stats.elapsedMs)} />
      <Stat label="Distancia" value={formatDistance(stats.distanceMeters)} />
      <Stat label="Actual" value={`${stats.currentSpeedKmh.toFixed(0)} km/h`} />
      <Stat label="Media" value={`${stats.averageSpeedKmh.toFixed(0)} km/h`} />
      <Stat label="Máxima" value={`${stats.maxSpeedKmh.toFixed(0)} km/h`} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatClock(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado.";
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  vehicleSection: {
    gap: 8,
  },
  vehicle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  vehicleSelected: {
    borderColor: colors.accent,
  },
  vehicleName: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  meta: {
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  stat: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: "30%",
    flexGrow: 1,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  summaryAttempts: {
    gap: 8,
  },
  summaryAttempt: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  error: {
    color: colors.danger,
    lineHeight: 20,
  },
  warning: {
    color: "#FFC857",
    lineHeight: 20,
  },
  success: {
    color: colors.success,
    fontWeight: "600",
  },
});
