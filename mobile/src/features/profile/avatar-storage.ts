import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const PROFILE_PHOTO_KEY = "xlr8_profile_photo_uri";

export async function loadProfilePhoto(): Promise<string | null> {
  const uri = await SecureStore.getItemAsync(PROFILE_PHOTO_KEY);
  if (!uri) {
    return null;
  }

  const file = await FileSystem.getInfoAsync(uri);
  if (!file.exists) {
    await SecureStore.deleteItemAsync(PROFILE_PHOTO_KEY);
    return null;
  }
  return uri;
}

export async function saveProfilePhoto(
  sourceUri: string,
  mimeType: string | null,
): Promise<string> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    throw new Error("No se pudo acceder al almacenamiento de fotos.");
  }

  const previousUri = await SecureStore.getItemAsync(PROFILE_PHOTO_KEY);
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const uri = `${documentDirectory}xlr8-profile-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: uri });

  try {
    await SecureStore.setItemAsync(PROFILE_PHOTO_KEY, uri);
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
      (cleanupError: unknown) => {
        console.error(
          "No se pudo limpiar la foto de perfil temporal:",
          cleanupError,
        );
      },
    );
    throw error;
  }

  if (previousUri?.startsWith(documentDirectory)) {
    await FileSystem.deleteAsync(previousUri, { idempotent: true }).catch(
      (error: unknown) => {
        console.error("No se pudo limpiar la foto de perfil anterior:", error);
      },
    );
  }
  return uri;
}

export async function removeProfilePhoto(): Promise<void> {
  const documentDirectory = FileSystem.documentDirectory;
  const previousUri = await SecureStore.getItemAsync(PROFILE_PHOTO_KEY);
  await SecureStore.deleteItemAsync(PROFILE_PHOTO_KEY);
  if (documentDirectory && previousUri?.startsWith(documentDirectory)) {
    await FileSystem.deleteAsync(previousUri, { idempotent: true });
  }
}
