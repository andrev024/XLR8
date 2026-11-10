import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
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
import { routeSegments } from "../../src/features/circuits/segments";
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
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.loading}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
          <RouteSegments
            onSegmentPress={(id) => router.push(`/(app)/segments/${id}`)}
          />
        </ScrollView>
      </Screen>
    );
  }

  if (circuitsQuery.isError) {
    return (
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content}>
          <ErrorState
            message="No se pudieron cargar los circuitos guardados."
            onRetry={() => void circuitsQuery.refetch()}
          />
          <RouteSegments
            onSegmentPress={(id) => router.push(`/(app)/segments/${id}`)}
          />
        </ScrollView>
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
            {(circuits.length > 0 ||
              routeSegments.some((segment) => segment.path)) && (
              <CircuitMap
                circuits={circuits}
                routeSegments={routeSegments}
                height={260}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aún no hay circuitos"
            description="Los circuitos guardados aparecerán aquí. Consulta abajo los segmentos compartidos."
          />
        }
        ListFooterComponent={
          <RouteSegments
            onSegmentPress={(id) => router.push(`/(app)/segments/${id}`)}
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

function RouteSegments({
  onSegmentPress,
}: {
  onSegmentPress: (id: string) => void;
}) {
  return (
    <View style={styles.segmentSection}>
      <Text style={styles.sectionTitle}>Rutas compartidas</Text>
      <Text style={styles.segmentNotice}>
        Son recorridos de referencia en vías públicas: se muestran para
        grabación personal y no participan en rankings competitivos.
      </Text>
      {routeSegments.map((segment) => (
        <Pressable
          key={segment.id}
          accessibilityRole="button"
          accessibilityState={{ disabled: !segment.path }}
          disabled={!segment.path}
          onPress={() => onSegmentPress(segment.id)}
          style={({ pressed }) => [
            styles.segmentCard,
            pressed && styles.pressed,
            !segment.path && styles.disabledSegment,
          ]}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>
              {segment.name} ·{" "}
              {segment.isClosedRoute ? "Ruta cerrada" : "Segmento"}
            </Text>
            <Text style={styles.distance}>
              ~{formatDistance(segment.distanceMeters)}
            </Text>
          </View>
          <Text style={styles.description}>
            {segment.start} → {segment.finish}
          </Text>
          <Text style={styles.segmentAction}>
            {segment.path
              ? "Abrir mapa y registrar recorrido personal"
              : "Mapa pendiente de georreferenciar"}
          </Text>
        </Pressable>
      ))}
    </View>
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
  segmentSection: { gap: 10, marginTop: 16 },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  segmentNotice: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  segmentCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  disabledSegment: { opacity: 0.65 },
  segmentAction: { color: colors.accent, fontSize: 13, fontWeight: "600" },
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
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
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
