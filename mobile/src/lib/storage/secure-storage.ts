import * as SecureStore from "expo-secure-store";

/** Wrapper de expo-secure-store: los tokens nunca deben guardarse en AsyncStorage. */
export const secureStorage = {
  getItem: (key: string): Promise<string | null> =>
    SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> =>
    SecureStore.setItemAsync(key, value),
  removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};
