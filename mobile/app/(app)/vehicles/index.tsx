import { useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../../src/components/Screen";
import { LoadingState } from "../../../src/components/LoadingState";
import { ErrorState } from "../../../src/components/ErrorState";
import { EmptyState } from "../../../src/components/EmptyState";
import { PowerCategoryBadge } from "../../../src/components/PowerCategoryBadge";
import { colors } from "../../../src/theme/colors";
import {
  useDeleteVehicleMutation,
  useVehiclesQuery,
} from "../../../src/features/vehicles/hooks";
import type { Vehicle } from "../../../src/features/vehicles/types";
import { getApiErrorMessage } from "../../../src/lib/api/error";

const typeLabels: Record<Vehicle["type"], string> = {
  MOTORCYCLE: "Moto",
  CAR: "Carro",
};

export default function VehiclesListScreen() {
  const vehiclesQuery = useVehiclesQuery();
  const deleteMutation = useDeleteVehicleMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      "Eliminar vehículo",
      `¿Eliminar ${vehicle.brand} ${vehicle.model}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            setDeletingId(vehicle.id);
            deleteMutation.mutate(vehicle.id, {
              onError: (error) => {
                Alert.alert(
                  "No se pudo eliminar",
                  getApiErrorMessage(error, "Intenta nuevamente"),
                );
              },
              onSettled: () => setDeletingId(null),
            });
          },
        },
      ],
    );
  };

  if (vehiclesQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando vehículos…" />
      </Screen>
    );
  }

  if (vehiclesQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message={getApiErrorMessage(
            vehiclesQuery.error,
            "No se pudieron cargar los vehículos",
          )}
          onRetry={() => void vehiclesQuery.refetch()}
        />
      </Screen>
    );
  }

  const vehicles = vehiclesQuery.data ?? [];

  return (
    <Screen padded={false}>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="Aún no tienes vehículos"
            description="Agrega tu primera moto o carro para empezar."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(app)/vehicles/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {item.brand} {item.model}
              </Text>
              <View style={styles.cardHeaderRight}>
                <PowerCategoryBadge category={item.powerCategory} />
                <Pressable
                  hitSlop={8}
                  onPress={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.danger}
                  />
                </Pressable>
              </View>
            </View>
            <Text style={styles.cardDetail}>
              {typeLabels[item.type]} · {item.year} · {item.horsepower} hp
            </Text>
          </Pressable>
        )}
      />
      <Pressable
        style={styles.fab}
        onPress={() => router.push("/(app)/vehicles/new")}
      >
        <Ionicons name="add" size={28} color={colors.background} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  cardDetail: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
