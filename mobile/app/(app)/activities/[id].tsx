import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../../../src/components/Button";
import { ErrorState } from "../../../src/components/ErrorState";
import { LoadingState } from "../../../src/components/LoadingState";
import { RouteMap } from "../../../src/components/RouteMap";
import { Screen } from "../../../src/components/Screen";
import {
  formatAttemptDuration,
  formatDistance,
  formatDuration,
} from "../../../src/features/activities/format";
import {
  useActivityQuery,
  useDeleteActivityMutation,
} from "../../../src/features/activities/hooks";
import { colors } from "../../../src/theme/colors";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const activityQuery = useActivityQuery(id);
  const deleteMutation = useDeleteActivityMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (activityQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando actividad…" />
      </Screen>
    );
  }
  if (activityQuery.isError || !activityQuery.data) {
    return (
      <Screen>
        <ErrorState
          message="No se pudo cargar esta actividad."
          onRetry={() => void activityQuery.refetch()}
        />
      </Screen>
    );
  }

  const activity = activityQuery.data;
  const points =
    activity.simplifiedPath?.coordinates.map(([lng, lat]) => ({ lng, lat })) ??
    [];

  function confirmDelete(): void {
    Alert.alert(
      "Eliminar actividad",
      "Esta acción eliminará la actividad y sus intentos de circuito.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            setDeleteError(null);
            deleteMutation.mutate(id, {
              onSuccess: () => router.replace("/(app)"),
              onError: (error) => {
                setDeleteError(
                  error instanceof Error
                    ? error.message
                    : "No se pudo eliminar la actividad.",
                );
              },
            });
          },
        },
      ],
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {activity.vehicle
            ? `${activity.vehicle.brand} ${activity.vehicle.model}`
            : "Actividad"}
        </Text>
        <Text style={styles.subtitle}>
          {new Date(activity.startedAt).toLocaleString("es-CO")}
        </Text>
        <RouteMap points={points} height={300} />

        <View style={styles.stats}>
          <Stat
            label="Distancia"
            value={formatDistance(activity.distanceMeters)}
          />
          <Stat
            label="Duración"
            value={formatDuration(activity.durationSeconds)}
          />
          <Stat
            label="Velocidad media"
            value={`${activity.avgSpeedKmh.toFixed(1)} km/h`}
          />
          <Stat
            label="Velocidad máxima"
            value={`${activity.maxSpeedKmh.toFixed(1)} km/h`}
          />
          {activity.movingDurationSeconds !== undefined && (
            <Stat
              label="Tiempo en movimiento"
              value={formatDuration(activity.movingDurationSeconds)}
            />
          )}
          {activity.stoppedDurationSeconds !== undefined && (
            <Stat
              label="Tiempo detenido"
              value={formatDuration(activity.stoppedDurationSeconds)}
            />
          )}
          {activity.elevationGainMeters !== undefined && (
            <Stat
              label="Desnivel positivo"
              value={`${activity.elevationGainMeters.toFixed(0)} m`}
            />
          )}
          {activity.averageAccuracyMeters != null && (
            <Stat
              label="Precisión GPS media"
              value={`${activity.averageAccuracyMeters.toFixed(0)} m`}
            />
          )}
          {activity.estimatedFuelLiters != null && (
            <Stat
              label="Combustible estimado"
              value={`${activity.estimatedFuelLiters.toFixed(2)} L`}
            />
          )}
          {activity.responsibleDrivingConfirmed &&
          activity.responsibleDrivingDurationSeconds !== undefined ? (
            <Stat
              label="Conducción responsable declarada"
              value={formatDuration(activity.responsibleDrivingDurationSeconds)}
            />
          ) : null}
        </View>

        <View style={styles.attempts}>
          <Text style={styles.sectionTitle}>Intentos de circuito</Text>
          {activity.circuitAttempts?.length ? (
            activity.circuitAttempts.map((attempt) => (
              <View key={attempt.id} style={styles.attempt}>
                <View style={styles.attemptHeading}>
                  <Text style={styles.attemptName}>{attempt.circuit.name}</Text>
                  <Text
                    style={[
                      styles.validity,
                      attempt.isValid ? styles.valid : styles.invalid,
                    ]}
                  >
                    {attempt.isValid ? "Válido" : "No válido"}
                  </Text>
                </View>
                <Text style={styles.attemptTime}>
                  {formatAttemptDuration(attempt.durationMs)}
                </Text>
                {!attempt.isValid && attempt.invalidReason && (
                  <Text style={styles.reason}>{attempt.invalidReason}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.subtitle}>
              No se detectaron intentos de circuito en esta ruta.
            </Text>
          )}
        </View>

        {deleteError && <Text style={styles.error}>{deleteError}</Text>}
        <Button
          label="Eliminar actividad"
          variant="danger"
          onPress={confirmDelete}
          loading={deleteMutation.isPending}
        />
      </ScrollView>
    </Screen>
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

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stat: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  attempts: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  attempt: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  attemptHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  attemptName: {
    color: colors.textPrimary,
    fontWeight: "600",
    flexShrink: 1,
  },
  validity: {
    fontWeight: "700",
  },
  valid: {
    color: colors.success,
  },
  invalid: {
    color: colors.danger,
  },
  attemptTime: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  reason: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
  },
});
