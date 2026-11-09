import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Button } from "../../src/components/Button";
import { LoadingState } from "../../src/components/LoadingState";
import { colors } from "../../src/theme/colors";
import { useLogoutMutation, useMeQuery } from "../../src/features/auth/hooks";

export default function ProfileScreen() {
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();

  if (meQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando perfil…" />
      </Screen>
    );
  }

  const user = meQuery.data;

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.displayName ?? "Piloto XLR8"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.legalCard}>
        <Text style={styles.legalTitle}>Aviso legal</Text>
        <Text style={styles.legalText}>
          Proyecto educativo. Respeta siempre las normas de tránsito y los
          límites de velocidad.
        </Text>
      </View>

      <Button
        label="Cerrar sesión"
        variant="danger"
        onPress={() => logoutMutation.mutate()}
        loading={logoutMutation.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legalTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  legalText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
