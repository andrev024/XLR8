import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import type { PowerCategory } from "../features/vehicles/types";

const labels: Record<PowerCategory, string> = {
  LOW: "LOW",
  MID: "MID",
  HIGH: "HIGH",
};

const backgrounds: Record<PowerCategory, string> = {
  LOW: "#2A3140",
  MID: "#3A4A2A",
  HIGH: "#4A2A2A",
};

const textColors: Record<PowerCategory, string> = {
  LOW: colors.textSecondary,
  MID: colors.accent,
  HIGH: colors.danger,
};

export function PowerCategoryBadge({ category }: { category: PowerCategory }) {
  return (
    <View style={[styles.badge, { backgroundColor: backgrounds[category] }]}>
      <Text style={[styles.text, { color: textColors[category] }]}>
        {labels[category]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
