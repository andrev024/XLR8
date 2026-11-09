import { isAxiosError } from "axios";

/** Extrae un mensaje de error legible desde una respuesta de la API de NestJS. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado",
): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) {
      return data.message.join("\n");
    }
    if (typeof data?.message === "string") {
      return data.message;
    }
  }
  return fallback;
}
