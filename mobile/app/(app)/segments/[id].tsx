import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../../src/components/Button";
import { Screen } from "../../../src/components/Screen";
import { CircuitMap } from "../../../src/features/circuits/components/CircuitMap";
import { routeSegments } from "../../../src/features/circuits/segments";
import { colors } from "../../../src/theme/colors";

export default function RouteSegmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const segment = routeSegments.find((item) => item.id === id);

  if (!segment?.path) {
    return (
      <Screen>
        <Text style={styles.title}>Trazado no disponible</Text>
        <Text style={styles.body}>
          Este segmento todavía no tiene una geometría verificada para mostrar
          en el mapa.
        </Text>
        <Button
          label="Volver a circuitos"
          onPress={() => router.back()}
          variant="secondary"
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {segment.name} ·{" "}
            {segment.isClosedRoute ? "Ruta cerrada" : "Segmento"}
          </Text>
          <Text style={styles.subtitle}>
            ~{formatDistance(segment.distanceMeters)} · Vía pública
          </Text>
        </View>
        <CircuitMap routeSegments={[segment]} height={300} />
        <View style={styles.details}>
          <Text style={styles.body}>Inicio: {segment.start}</Text>
          <Text style={styles.body}>Fin: {segment.finish}</Text>
          <Text style={styles.notice}>
            El trazado de referencia se obtuvo con OpenStreetMap a partir de los
            puntos del enlace compartido; puede diferir de la ruta exacta de
            Google Maps. Las rutas compartidas en vías públicas no tienen
            cronómetro competitivo ni ranking.
          </Text>
          <Button
            label="Grabar recorrido personal"
            onPress={() => router.push("/(app)/recording")}
          />
        </View>
      </View>
    </Screen>
  );
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 36 },
  header: { gap: 5 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  details: { gap: 12 },
  body: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  notice: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
