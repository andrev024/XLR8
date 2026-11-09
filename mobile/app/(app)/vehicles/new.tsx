import { useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
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
      {apiError ? (
        <Text
          style={{
            color: colors.danger,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {apiError}
        </Text>
      ) : null}
      <VehicleForm
        onSubmit={onSubmit}
        submitLabel="Crear vehículo"
        submitting={createMutation.isPending}
      />
    </Screen>
  );
}
