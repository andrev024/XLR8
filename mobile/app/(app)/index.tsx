import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { Screen } from "../../src/components/Screen";
import {
  useActivityAchievementsQuery,
  useActivitiesQuery,
  useActivitySummaryQuery,
} from "../../src/features/activities/hooks";
import {
  formatDistance,
  formatDuration,
} from "../../src/features/activities/format";
import type {
  ActivityFilters,
  Activity,
  ActivityAchievement,
  ActivitySummary,
  ActivityPeriodSummary,
} from "../../src/features/activities/types";
import { useVehiclesQuery } from "../../src/features/vehicles/hooks";
import { colors } from "../../src/theme/colors";

type ActivityDateFilter = "ALL" | "WEEK" | "MONTH" | "YEAR";

export default function HomeScreen() {
  const router = useRouter();
  const vehiclesQuery = useVehiclesQuery();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<ActivityDateFilter>("ALL");
  const [minimumDistanceKm, setMinimumDistanceKm] = useState("");
  const [maximumDistanceKm, setMaximumDistanceKm] = useState("");
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const activitiesQuery = useActivitiesQuery(filters);
  const summaryQuery = useActivitySummaryQuery();
  const achievementsQuery = useActivityAchievementsQuery();
  const activities = useMemo(
    () => activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activitiesQuery.data],
  );

  function applyFilters(): void {
    const minKm = readOptionalDistance(minimumDistanceKm);
    const maxKm = readOptionalDistance(maximumDistanceKm);
    if (
      (minimumDistanceKm && minKm === null) ||
      (maximumDistanceKm && maxKm === null)
    ) {
      setFilterError("Ingresa distancias válidas en kilómetros.");
      return;
    }
    if (minKm !== null && maxKm !== null && minKm > maxKm) {
      setFilterError("La distancia mínima no puede superar la máxima.");
      return;
    }

    const now = new Date();
    const daysByPeriod: Partial<Record<ActivityDateFilter, number>> = {
      WEEK: 7,
      MONTH: 30,
      YEAR: 365,
    };
    const days = daysByPeriod[dateFilter];
    const dateFrom = days
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    setFilters({
      ...(selectedVehicleId ? { vehicleId: selectedVehicleId } : {}),
      ...(dateFrom ? { dateFrom, dateTo: now.toISOString() } : {}),
      ...(minKm !== null ? { minDistanceMeters: minKm * 1000 } : {}),
      ...(maxKm !== null ? { maxDistanceMeters: maxKm * 1000 } : {}),
    });
    setFilterError(null);
  }

  function clearFilters(): void {
    setSelectedVehicleId(null);
    setDateFilter("ALL");
    setMinimumDistanceKm("");
    setMaximumDistanceKm("");
    setFilters({});
    setFilterError(null);
  }

  if (activitiesQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (activitiesQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message="No se pudieron cargar tus actividades."
          onRetry={() => void activitiesQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={activitiesQuery.isRefetching}
            onRefresh={() => void activitiesQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Tus rutas</Text>
            <Text style={styles.subtitle}>
              Todas tus actividades, listas para volver a recorrer.
            </Text>
            <Button
              label="Grabar una ruta"
              onPress={() => router.push("/(app)/recording")}
            />
            {summaryQuery.data ? (
              <ActivitySummaryCards summary={summaryQuery.data} />
            ) : summaryQuery.isError ? (
              <Text style={styles.summaryError}>
                No se pudieron cargar las estadísticas acumuladas.
              </Text>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
            {achievementsQuery.data ? (
              <AchievementCards achievements={achievementsQuery.data} />
            ) : achievementsQuery.isError ? (
              <Text style={styles.summaryError}>
                No se pudieron cargar tus logros.
              </Text>
            ) : (
              <ActivityIndicator color={colors.accent} />
            )}
            <View style={styles.filterPanel}>
              <Text style={styles.sectionTitle}>Filtrar historial</Text>
              <Text style={styles.filterLabel}>Fecha</Text>
              <View style={styles.filterOptions}>
                {(
                  [
                    ["ALL", "Todas"],
                    ["WEEK", "7 días"],
                    ["MONTH", "30 días"],
                    ["YEAR", "365 días"],
                  ] as const
                ).map(([period, label]) => (
                  <FilterChip
                    key={period}
                    label={label}
                    selected={dateFilter === period}
                    onPress={() => setDateFilter(period)}
                  />
                ))}
              </View>
              <Text style={styles.filterLabel}>Vehículo</Text>
              {vehiclesQuery.isError ? (
                <Text style={styles.summaryError}>
                  No se pudieron cargar los vehículos para filtrar.
                </Text>
              ) : (
                <View style={styles.filterOptions}>
                  <FilterChip
                    label="Todos"
                    selected={selectedVehicleId === null}
                    onPress={() => setSelectedVehicleId(null)}
                  />
                  {(vehiclesQuery.data ?? []).map((vehicle) => (
                    <FilterChip
                      key={vehicle.id}
                      label={`${vehicle.brand} ${vehicle.model}`}
                      selected={selectedVehicleId === vehicle.id}
                      onPress={() => setSelectedVehicleId(vehicle.id)}
                    />
                  ))}
                </View>
              )}
              <Text style={styles.filterLabel}>Distancia (km)</Text>
              <View style={styles.distanceInputs}>
                <TextInput
                  accessibilityLabel="Distancia mínima en kilómetros"
                  keyboardType="decimal-pad"
                  onChangeText={setMinimumDistanceKm}
                  placeholder="Mínima"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.distanceInput}
                  value={minimumDistanceKm}
                />
                <TextInput
                  accessibilityLabel="Distancia máxima en kilómetros"
                  keyboardType="decimal-pad"
                  onChangeText={setMaximumDistanceKm}
                  placeholder="Máxima"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.distanceInput}
                  value={maximumDistanceKm}
                />
              </View>
              {filterError ? (
                <Text style={styles.summaryError}>{filterError}</Text>
              ) : null}
              <View style={styles.filterActions}>
                <Button
                  label="Aplicar filtros"
                  onPress={applyFilters}
                  variant="secondary"
                />
                <Button label="Limpiar" onPress={clearFilters} />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              Object.keys(filters).length
                ? "Sin coincidencias"
                : "Aún no tienes actividades"
            }
            description={
              Object.keys(filters).length
                ? "No hay recorridos que coincidan con los filtros seleccionados."
                : "Graba tu primera ruta y aparecerá aquí."
            }
          />
        }
        renderItem={({ item }) => (
          <ActivityCard
            activity={item}
            onPress={() => router.push(`/(app)/activities/${item.id}`)}
          />
        )}
        onEndReached={() => {
          if (
            activitiesQuery.hasNextPage &&
            !activitiesQuery.isFetchingNextPage
          ) {
            void activitiesQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activitiesQuery.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
      />
    </Screen>
  );
}

function FilterChip({
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
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function readOptionalDistance(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const distance = Number(value.replace(",", "."));
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function ActivitySummaryCards({ summary }: { summary: ActivitySummary }) {
  const periods: {
    key: string;
    label: string;
    value: ActivityPeriodSummary;
  }[] = [
    { key: "week", label: "Esta semana", value: summary.week },
    { key: "month", label: "Este mes", value: summary.month },
    { key: "year", label: "Este año", value: summary.year },
  ];

  return (
    <View style={styles.summaryGrid}>
      {periods.map(({ key, label, value }) => (
        <View key={key} style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{label}</Text>
          <Text style={styles.summaryValue}>
            {formatDistance(value.distanceMeters)}
          </Text>
          <Text style={styles.statLabel}>
            {value.activityCount} recorridos ·{" "}
            {formatDuration(value.movingDurationSeconds)} en movimiento
          </Text>
          <Text style={styles.statLabel}>
            {formatDuration(value.responsibleDrivingDurationSeconds)} declarados
            responsables
          </Text>
        </View>
      ))}
    </View>
  );
}

function AchievementCards({
  achievements,
}: {
  achievements: ActivityAchievement[];
}) {
  return (
    <View style={styles.achievementSection}>
      <Text style={styles.sectionTitle}>Logros personales</Text>
      {achievements.map((achievement) => (
        <View
          key={achievement.id}
          style={[
            styles.achievementCard,
            achievement.unlocked && styles.achievementUnlocked,
          ]}
        >
          <Text style={styles.achievementTitle}>
            {achievement.title}
            {achievement.unlocked ? " · Completado" : ""}
          </Text>
          <Text style={styles.statLabel}>{achievement.description}</Text>
          <Text style={styles.statLabel}>
            {achievement.progress} / {achievement.target} {achievement.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActivityCard({
  activity,
  onPress,
}: {
  activity: Activity;
  onPress: () => void;
}) {
  const vehicleName = activity.vehicle
    ? `${activity.vehicle.brand} ${activity.vehicle.model}`
    : "Vehículo";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{vehicleName}</Text>
        <Text style={styles.date}>
          {new Date(activity.startedAt).toLocaleDateString("es-CO")}
        </Text>
      </View>
      <View style={styles.stats}>
        <Stat
          label="Distancia"
          value={formatDistance(activity.distanceMeters)}
        />
        <Stat
          label="Duración"
          value={formatDuration(activity.durationSeconds)}
        />
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 10,
    marginBottom: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    minWidth: "48%",
    flexGrow: 1,
  },
  summaryTitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  summaryError: {
    color: colors.danger,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  achievementSection: {
    gap: 8,
  },
  achievementCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  achievementUnlocked: {
    borderColor: colors.accent,
  },
  achievementTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  filterLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipSelected: {
    borderColor: colors.accent,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: colors.accent,
  },
  distanceInputs: {
    flexDirection: "row",
    gap: 8,
  },
  distanceInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterActions: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  cardHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  date: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  stats: {
    flexDirection: "row",
    gap: 36,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingVertical: 20,
  },
});
