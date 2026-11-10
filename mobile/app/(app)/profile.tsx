import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../src/components/Screen";
import { Button } from "../../src/components/Button";
import { LoadingState } from "../../src/components/LoadingState";
import { colors } from "../../src/theme/colors";
import { useLogoutMutation, useMeQuery } from "../../src/features/auth/hooks";
import {
  loadProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto,
} from "../../src/features/profile/avatar-storage";

export default function ProfileScreen() {
  const meQuery = useMeQuery();
  const logoutMutation = useLogoutMutation();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    void loadProfilePhoto()
      .then(setPhotoUri)
      .catch((error: unknown) => {
        console.error("No se pudo cargar la foto de perfil:", error);
        setPhotoError("No se pudo cargar la foto de perfil.");
      });
  }, []);

  if (meQuery.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando perfil…" />
      </Screen>
    );
  }

  const user = meQuery.data;

  async function handleChoosePhoto(): Promise<void> {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError("Permite el acceso a tus fotos para elegir una imagen.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const uri = await saveProfilePhoto(
        result.assets[0].uri,
        result.assets[0].mimeType ?? null,
      );
      setPhotoUri(uri);
    } catch (error) {
      console.error("No se pudo guardar la foto de perfil:", error);
      setPhotoError("No se pudo guardar la foto. Inténtalo de nuevo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto(): Promise<void> {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await removeProfilePhoto();
      setPhotoUri(null);
    } catch (error) {
      console.error("No se pudo quitar la foto de perfil:", error);
      setPhotoError("No se pudo quitar la foto. Inténtalo de nuevo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <Pressable
            accessibilityLabel={
              photoUri ? "Cambiar foto de perfil" : "Añadir foto de perfil"
            }
            accessibilityRole="button"
            disabled={photoBusy}
            onPress={() => void handleChoosePhoto()}
            style={styles.avatar}
          >
            {photoBusy ? (
              <ActivityIndicator color={colors.accent} />
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons
                name="person-outline"
                size={34}
                color={colors.textSecondary}
              />
            )}
          </Pressable>
          <View style={styles.identity}>
            <Text style={styles.name}>
              {user?.displayName ?? "Piloto XLR8"}
            </Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={photoBusy}
          onPress={() => void handleChoosePhoto()}
        >
          <Text style={styles.photoAction}>
            {photoUri ? "Cambiar foto" : "Añadir foto opcional"}
          </Text>
        </Pressable>
        {photoUri ? (
          <Pressable
            accessibilityRole="button"
            disabled={photoBusy}
            onPress={() =>
              Alert.alert("Quitar foto", "¿Quieres quitar tu foto de perfil?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Quitar",
                  style: "destructive",
                  onPress: () => void handleRemovePhoto(),
                },
              ])
            }
          >
            <Text style={styles.removePhoto}>Quitar foto</Text>
          </Pressable>
        ) : null}
        {photoError ? (
          <Text style={styles.photoError}>{photoError}</Text>
        ) : null}
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  identity: {
    flex: 1,
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
  photoAction: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  removePhoto: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  photoError: {
    color: colors.danger,
    marginTop: 10,
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
