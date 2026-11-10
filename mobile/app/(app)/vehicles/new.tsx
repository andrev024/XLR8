import { useState } from "react";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Screen } from "../../../src/components/Screen";
import { VehicleForm } from "../../../src/features/vehicles/components/VehicleForm";
import { useCreateVehicleMutation } from "../../../src/features/vehicles/hooks";
import type { VehicleFormValues } from "../../../src/features/vehicles/schemas";
import { getApiErrorMessage } from "../../../src/lib/api/error";
import { colors } from "../../../src/theme/colors";

export default function NewVehicleScreen() {
  const createMutation = useCreateVehicleMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = (values: VehicleFormValues) => {
    setApiError(null);
    createMutation.mutate(values, {
      onSuccess: () => router.back(),
      onError: (error) =>
        setApiError(getApiErrorMessage(error, "No se pudo crear el vehículo")),
    });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoiding}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
        >
          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
          <VehicleForm
            onSubmit={onSubmit}
            submitLabel="Crear vehículo"
            submitting={createMutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  apiError: {
    color: colors.danger,
    marginBottom: 16,
    textAlign: "center",
  },
});
