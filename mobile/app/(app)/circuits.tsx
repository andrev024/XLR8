import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { Screen } from "../../src/components/Screen";
import { CircuitMap } from "../../src/features/circuits/components/CircuitMap";
import {
  distanceBetweenMeters,
  sortCircuitsByDistance,
} from "../../src/features/circuits/logic";
import { useCircuitsQuery } from "../../src/features/circuits/hooks";
import type { Circuit } from "../../src/features/circuits/types";
import { colors } from "../../src/theme/colors";

export default function CircuitsScreen() {
  const router = useRouter();
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const circuitsQuery = useCircuitsQuery(location);
  const circuits = useMemo(
    () => sortCircuitsByDistance(circuitsQuery.data ?? [], location),
    [circuitsQuery.data, location],
  );

  useEffect(() => {
    let active = true;
    void Location.requestForegroundPermissionsAsync()
      .then(async ({ status }) => {
        if (status !== "granted") {
          if (active) {
            setLocationMessage(
              "Activa la ubicación para ordenar los circuitos por cercanía.",
            );
          }
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (active) {
          setLocation(current.coords);
          setLocationMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLocationMessage(
            error instanceof Error
              ? `No se pudo obtener tu ubicación: ${error.message}`
              : "No se pudo obtener tu ubicación.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (circuitsQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </Screen>
    );
  }

  if (circuitsQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message="No se pudieron cargar los circuitos."
          onRetry={() => void circuitsQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={circuits}
        keyExtractor={(circuit) => circuit.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Circuitos</Text>
            <Text style={styles.subtitle}>
              Explora rutas de referencia y compara tus tiempos.
            </Text>
            {locationMessage ? (
              <Text style={styles.locationMessage}>{locationMessage}</Text>
            ) : null}
            {circuits.length > 0 && (
              <CircuitMap circuits={circuits} height={260} />
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aún no hay circuitos"
            description="Los circuitos disponibles aparecerán aquí."
          />
        }
        renderItem={({ item }) => (
          <CircuitCard
            circuit={item}
            location={location}
            onPress={() => router.push(`/(app)/circuits/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function CircuitCard({
  circuit,
  location,
  onPress,
}: {
  circuit: Circuit;
  location: Location.LocationObjectCoords | null;
  onPress: () => void;
}) {
  const distance =
    location && circuit.location
      ? formatDistance(distanceBetweenMeters(location, circuit.location))
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{circuit.name}</Text>
        {distance && <Text style={styles.distance}>{distance}</Text>}
      </View>
      <Text style={styles.subtitle}>
        {(circuit.lengthMeters / 1000).toFixed(2)} km de recorrido
      </Text>
      {circuit.description ? (
        <Text style={styles.description}>{circuit.description}</Text>
      ) : null}
    </Pressable>
  );
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function SkeletonCard() {
  return (
    <View accessibilityLabel="Cargando circuito" style={styles.skeleton}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonShort]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 6 },
  loading: { gap: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  locationMessage: { color: colors.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", flex: 1 },
  distance: { color: colors.accent, fontWeight: "700" },
  description: { color: colors.textSecondary, fontSize: 13 },
  pressed: { opacity: 0.8 },
  skeleton: {
    height: 82,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    justifyContent: "center",
  },
  skeletonLine: {
    height: 14,
    width: "70%",
    borderRadius: 7,
    backgroundColor: colors.border,
  },
  skeletonShort: { width: "38%", height: 10 },
});
