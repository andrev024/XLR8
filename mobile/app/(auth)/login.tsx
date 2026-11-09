import { useState } from "react";
import { Link, router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { useLoginMutation } from "../../src/features/auth/hooks";
import {
  loginSchema,
  type LoginFormValues,
} from "../../src/features/auth/schemas";
import { getApiErrorMessage } from "../../src/lib/api/error";

export default function LoginScreen() {
  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const loginMutation = useLoginMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = (values: LoginFormValues) => {
    setApiError(null);
    loginMutation.mutate(values, {
      onSuccess: () => router.replace("/(app)"),
      onError: (error) =>
        setApiError(getApiErrorMessage(error, "Credenciales inválidas")),
    });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>XLR8</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
      </View>

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
        label="Iniciar sesión"
        onPress={handleSubmit(onSubmit)}
        loading={loginMutation.isPending}
      />

      <Link href="/(auth)/register" style={styles.link}>
        <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
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
