import { api, setToken, clearToken, clearActiveCityId } from "./client.ts";

interface AuthResponse {
  token: string;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await api.post<AuthResponse>("/auth/login", { username, password });
  setToken(res.token);
}

export async function register(username: string, email: string, password: string, cityName: string): Promise<void> {
  const res = await api.post<AuthResponse>("/auth/register", { username, email, password, cityName });
  setToken(res.token);
}

export function logout(): void {
  clearToken();
  clearActiveCityId();
}
