import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
});
