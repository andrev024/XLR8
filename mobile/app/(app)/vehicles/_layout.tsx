import { Stack } from "expo-router";
import { colors } from "../../../src/theme/colors";

export default function VehiclesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Vehículos" }} />
      <Stack.Screen name="new" options={{ title: "Nuevo vehículo" }} />
      <Stack.Screen name="[id]" options={{ title: "Editar vehículo" }} />
    </Stack>
  );
}
