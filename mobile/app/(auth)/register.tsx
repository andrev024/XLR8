import { useState } from "react";
import { Link, router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import {
  useLoginMutation,
  useRegisterMutation,
} from "../../src/features/auth/hooks";
import {
  registerSchema,
  type RegisterFormValues,
} from "../../src/features/auth/schemas";
import { getApiErrorMessage } from "../../src/lib/api/error";

export default function RegisterScreen() {
  const { control, handleSubmit } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", displayName: "" },
  });
  const registerMutation = useRegisterMutation();
  const loginMutation = useLoginMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = (values: RegisterFormValues) => {
    setApiError(null);
    registerMutation.mutate(values, {
      onSuccess: () => {
        loginMutation.mutate(
          { email: values.email, password: values.password },
          {
            onSuccess: () => router.replace("/(app)"),
            onError: () => router.replace("/(auth)/login"),
          },
        );
      },
      onError: (error) =>
        setApiError(
          getApiErrorMessage(error, "No se pudo completar el registro"),
        ),
    });
  };

  const submitting = registerMutation.isPending || loginMutation.isPending;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>XLR8</Text>
        <Text style={styles.subtitle}>Crea tu cuenta</Text>
      </View>

      <TextField
        control={control}
        name="displayName"
        label="Nombre"
        placeholder="Piloto XLR8"
        autoCapitalize="words"
      />
      <TextField
        control={control}
        name="email"
        label="Email"
        placeholder="piloto@xlr8.app"
        keyboardType="email-address"
      />
      <TextField
        control={control}
        name="password"
        label="Contraseña"
        secureTextEntry
      />

      {apiError ? <Text style={styles.errorBanner}>{apiError}</Text> : null}

      <Button
        label="Registrarme"
        onPress={handleSubmit(onSubmit)}
        loading={submitting}
      />

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
    marginTop: 48,
  },
  brand: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
  },
  errorBanner: {
    color: colors.danger,
    marginBottom: 16,
    textAlign: "center",
  },
  link: {
    marginTop: 20,
    alignSelf: "center",
  },
  linkText: {
    color: colors.textSecondary,
  },
});
