import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Screen } from "../../../src/components/Screen";
import { LoadingState } from "../../../src/components/LoadingState";
import { ErrorState } from "../../../src/components/ErrorState";
import { Button } from "../../../src/components/Button";
import { VehicleForm } from "../../../src/features/vehicles/components/VehicleForm";
import {
  useDeleteVehicleMutation,
  useUpdateVehicleMutation,
  useVehicleQuery,
} from "../../../src/features/vehicles/hooks";
import type { VehicleFormValues } from "../../../src/features/vehicles/schemas";
import { getApiErrorMessage } from "../../../src/lib/api/error";
import { colors } from "../../../src/theme/colors";

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicleQuery(id);
  const updateMutation = useUpdateVehicleMutation(id);
  const deleteMutation = useDeleteVehicleMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  if (vehicleQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando vehículo…" />
      </Screen>
    );
  }

  if (vehicleQuery.isError || !vehicleQuery.data) {
    return (
      <Screen>
        <ErrorState
          message={getApiErrorMessage(
            vehicleQuery.error,
            "No se pudo cargar el vehículo",
          )}
          onRetry={() => void vehicleQuery.refetch()}
        />
      </Screen>
    );
  }

  const vehicle = vehicleQuery.data;

  const onSubmit = (values: VehicleFormValues) => {
    setApiError(null);
    updateMutation.mutate(values, {
      onSuccess: () => router.back(),
      onError: (error) =>
        setApiError(
          getApiErrorMessage(error, "No se pudo actualizar el vehículo"),
        ),
    });
  };

  const onDelete = () => {
    Alert.alert(
      "Eliminar vehículo",
      `¿Eliminar ${vehicle.brand} ${vehicle.model}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(vehicle.id, {
              onSuccess: () => router.back(),
              onError: (error) => {
                Alert.alert(
                  "No se pudo eliminar",
                  getApiErrorMessage(error, "Intenta nuevamente"),
                );
              },
            });
          },
        },
      ],
    );
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
        defaultValues={vehicle}
        onSubmit={onSubmit}
        submitLabel="Guardar cambios"
        submitting={updateMutation.isPending}
      />
      <View style={{ marginTop: 16 }}>
        <Button
          label="Eliminar vehículo"
          variant="danger"
          onPress={onDelete}
          loading={deleteMutation.isPending}
        />
      </View>
    </Screen>
  );
}
