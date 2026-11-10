import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ErrorState } from "../../../src/components/ErrorState";
import { Screen } from "../../../src/components/Screen";
import { CircuitMap } from "../../../src/features/circuits/components/CircuitMap";
import {
  formatLeaderboardTime,
  getInitialLeaderboardCategory,
  POWER_CATEGORIES,
  updateLeaderboardCategory,
  VEHICLE_TYPES,
} from "../../../src/features/circuits/logic";
import {
  useCircuitLeaderboardQuery,
  useCircuitQuery,
  useMyCircuitAttemptsQuery,
  useMyLeaderboardSummaryQuery,
} from "../../../src/features/circuits/hooks";
import type { LeaderboardCategory } from "../../../src/features/circuits/types";
import { useVehiclesQuery } from "../../../src/features/vehicles/hooks";
import { useMeQuery } from "../../../src/features/auth/hooks";
import { colors } from "../../../src/theme/colors";

export default function CircuitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const circuitQuery = useCircuitQuery(id);
  const vehiclesQuery = useVehiclesQuery();
  const meQuery = useMeQuery();
  const [categoryOverride, setCategoryOverride] =
    useState<LeaderboardCategory | null>(null);
  const category =
    categoryOverride ?? getInitialLeaderboardCategory(vehiclesQuery.data ?? []);
  const rankingsEnabled = circuitQuery.data?.isAuthorizedClosed ?? false;
  const leaderboardQuery = useCircuitLeaderboardQuery(
    id,
    category,
    rankingsEnabled,
  );
  const personalQuery = useMyLeaderboardSummaryQuery(
    id,
    category,
    rankingsEnabled,
  );
  const attemptsQuery = useMyCircuitAttemptsQuery(id, rankingsEnabled);

  if (circuitQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.loadingCard} />
        <View style={[styles.loadingCard, styles.shortCard]} />
        <View style={[styles.loadingCard, styles.shortCard]} />
      </Screen>
    );
  }
  if (circuitQuery.isError || !circuitQuery.data) {
    return (
      <Screen>
        <ErrorState
          message="No se pudo cargar el circuito."
          onRetry={() => void circuitQuery.refetch()}
        />
      </Screen>
    );
  }

  const circuit = circuitQuery.data;
  const leaderboardError =
    leaderboardQuery.isError || personalQuery.isError || attemptsQuery.isError;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{circuit.name}</Text>
          <Text style={styles.subtitle}>
            {(circuit.lengthMeters / 1000).toFixed(2)} km
            {circuit.description ? ` · ${circuit.description}` : ""}
          </Text>
        </View>
        <CircuitMap circuit={circuit} height={300} />
        <View style={styles.legend}>
          <Legend color="#55D187" label="Salida" />
          <Legend color="#F06C75" label="Meta" />
          <Legend color={colors.accent} label="Ruta de referencia" />
        </View>

        {circuit.isAuthorizedClosed ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categoría del ranking</Text>
              {vehiclesQuery.isError && (
                <Text style={styles.error}>
                  No se pudieron cargar tus vehículos; puedes seleccionar la
                  categoría manualmente.
                </Text>
              )}
              <Text style={styles.filterLabel}>Tipo de vehículo</Text>
              <View style={styles.selectorRow}>
                {VEHICLE_TYPES.map((type) => (
                  <SelectButton
                    key={type}
                    label={type === "MOTORCYCLE" ? "Moto" : "Carro"}
                    selected={category.vehicleType === type}
                    onPress={() => updateCategory({ vehicleType: type })}
                  />
                ))}
              </View>
              <Text style={styles.filterLabel}>Rango de potencia</Text>
              <View style={styles.selectorRow}>
                {POWER_CATEGORIES.map((power) => (
                  <SelectButton
                    key={power}
                    label={power}
                    selected={category.powerCategory === power}
                    onPress={() => updateCategory({ powerCategory: power })}
                  />
                ))}
              </View>
              <Text style={styles.filterLabel}>Periodo</Text>
              <View style={styles.selectorRow}>
                {(
                  [
                    ["ALL_TIME", "Todo"],
                    ["WEEK", "7 días"],
                    ["MONTH", "30 días"],
                    ["YEAR", "365 días"],
                  ] as const
                ).map(([period, label]) => (
                  <SelectButton
                    key={period}
                    label={label}
                    selected={category.period === period}
                    onPress={() => updateCategory({ period })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RANKING TOP 3</Text>
              {leaderboardError ? (
                <ErrorState
                  message="No se pudo cargar el ranking o tus intentos."
                  onRetry={() => {
                    void leaderboardQuery.refetch();
                    void personalQuery.refetch();
                    void attemptsQuery.refetch();
                  }}
                />
              ) : leaderboardQuery.isLoading ? (
                <View style={styles.loadingCard} />
              ) : leaderboardQuery.data?.length ? (
                leaderboardQuery.data.map((entry) => (
                  <View
                    key={`${entry.userId}-${entry.position}`}
                    style={[
                      styles.rankCard,
                      entry.userId === meQuery.data?.id
                        ? styles.myRankCard
                        : null,
                    ]}
                  >
                    <Text style={styles.rankPosition}>#{entry.position}</Text>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{entry.displayName}</Text>
                      <Text style={styles.rankVehicle}>
                        {entry.vehicleBrand} {entry.vehicleModel} ·{" "}
                        {entry.horsepower} HP ·{" "}
                        {new Date(entry.date).toLocaleDateString("es-CO")}
                      </Text>
                    </View>
                    <Text style={styles.rankTime}>
                      {formatLeaderboardTime(entry.durationMs)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>
                  Aún no hay tiempos válidos en esta categoría.
                </Text>
              )}
              {!personalQuery.isError && !personalQuery.isLoading && (
                <View style={styles.personalCard}>
                  <Text style={styles.personalTitle}>Tu mejor tiempo</Text>
                  {personalQuery.data?.bestTimeMs !== null &&
                  personalQuery.data?.bestTimeMs !== undefined ? (
                    <Text style={styles.personalValue}>
                      {formatLeaderboardTime(personalQuery.data.bestTimeMs)}
                      {personalQuery.data.position
                        ? ` · posición #${personalQuery.data.position}`
                        : " · sin posición"}
                    </Text>
                  ) : (
                    <Text style={styles.empty}>
                      Todavía no tienes un intento válido en esta categoría.
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mis intentos</Text>
              {attemptsQuery.isLoading ? (
                <View style={styles.loadingCard} />
              ) : attemptsQuery.isError ? (
                <ErrorState
                  message="No se pudieron cargar tus intentos."
                  onRetry={() => void attemptsQuery.refetch()}
                />
              ) : attemptsQuery.data?.length ? (
                attemptsQuery.data.map((attempt) => (
                  <View key={attempt.id} style={styles.attemptCard}>
                    <View style={styles.attemptHeading}>
                      <Text style={styles.rankTime}>
                        {formatLeaderboardTime(attempt.durationMs)}
                      </Text>
                      <Text
                        style={[
                          styles.validity,
                          attempt.isValid ? styles.valid : styles.invalid,
                        ]}
                      >
                        {attempt.isValid ? "Válido" : "No válido"}
                      </Text>
                    </View>
                    <Text style={styles.rankVehicle}>
                      {attempt.vehicleType === "MOTORCYCLE" ? "Moto" : "Carro"}{" "}
                      · {attempt.powerCategory} ·{" "}
                      {new Date(attempt.startedAt).toLocaleDateString("es-CO")}
                    </Text>
                    {!attempt.isValid && attempt.invalidReason ? (
                      <Text style={styles.error}>{attempt.invalidReason}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>
                  Aún no tienes intentos registrados en este circuito.
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ranking no disponible</Text>
            <Text style={styles.subtitle}>
              Los tiempos competitivos solo se habilitan en circuitos cerrados
              con autorización verificada. Este recorrido no está habilitado
              para clasificaciones; tus actividades personales siguen
              disponibles en el historial.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );

  function updateCategory(change: Partial<LeaderboardCategory>) {
    setCategoryOverride((current) =>
      updateLeaderboardCategory(
        current ?? getInitialLeaderboardCategory(vehiclesQuery.data ?? []),
        change,
      ),
    );
  }
}

function SelectButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.selector, selected && styles.selectedSelector]}
    >
      <Text style={[styles.selectorText, selected && styles.selectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 36 },
  header: { gap: 5 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontSize: 12 },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: "700" },
  filterLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  selectorRow: { flexDirection: "row", gap: 8 },
  selector: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  selectedSelector: { borderColor: colors.accent, backgroundColor: "#252D1B" },
  selectorText: { color: colors.textSecondary, fontWeight: "600" },
  selectedText: { color: colors.accent },
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: 13,
  },
  myRankCard: { borderColor: colors.accent, borderWidth: 2 },
  rankPosition: {
    color: colors.accent,
    width: 32,
    fontSize: 17,
    fontWeight: "800",
  },
  rankInfo: { flex: 1, gap: 3 },
  rankName: { color: colors.textPrimary, fontWeight: "700" },
  rankVehicle: { color: colors.textSecondary, fontSize: 12 },
  rankTime: { color: colors.accent, fontSize: 17, fontWeight: "700" },
  personalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 5,
  },
  personalTitle: { color: colors.textSecondary, fontSize: 13 },
  personalValue: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  attemptCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  attemptHeading: { flexDirection: "row", justifyContent: "space-between" },
  validity: { fontWeight: "700" },
  valid: { color: colors.success },
  invalid: { color: colors.danger },
  empty: { color: colors.textSecondary, lineHeight: 20 },
  error: { color: colors.danger, lineHeight: 19 },
  loadingCard: {
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortCard: { height: 56 },
});
