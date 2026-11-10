import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
            defaultValues={{
              type: vehicle.type,
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
              horsepower: vehicle.horsepower,
              engineDisplacementCc: vehicle.engineDisplacementCc ?? undefined,
              engineType: vehicle.engineType ?? undefined,
              weightKg: vehicle.weightKg ?? undefined,
              fuelConsumptionLitersPer100Km:
                vehicle.fuelConsumptionLitersPer100Km ?? undefined,
            }}
            onSubmit={onSubmit}
            submitLabel="Guardar cambios"
            submitting={updateMutation.isPending}
          />
          <View style={styles.deleteButton}>
            <Button
              label="Eliminar vehículo"
              variant="danger"
              onPress={onDelete}
              loading={deleteMutation.isPending}
            />
          </View>
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
  deleteButton: {
    marginTop: 16,
  },
});
