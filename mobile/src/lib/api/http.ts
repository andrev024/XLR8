import axios from "axios";
import { API_URL } from "../env";

/**
 * Instancia "cruda" sin interceptores, usada para /auth/* (login, register, refresh, logout)
 * para evitar recursión del interceptor de refresh del cliente autenticado.
 */
export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});
