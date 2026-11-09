import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: {
    color: colors.textSecondary,
  },
});
