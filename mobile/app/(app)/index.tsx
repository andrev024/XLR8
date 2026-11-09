import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { Screen } from "../../src/components/Screen";
import { useActivitiesQuery } from "../../src/features/activities/hooks";
import {
  formatDistance,
  formatDuration,
} from "../../src/features/activities/format";
import type { Activity } from "../../src/features/activities/types";
import { colors } from "../../src/theme/colors";

export default function HomeScreen() {
  const router = useRouter();
  const activitiesQuery = useActivitiesQuery();
  const activities = useMemo(
    () => activitiesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activitiesQuery.data],
  );

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
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aún no tienes actividades"
            description="Graba tu primera ruta y aparecerá aquí."
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
