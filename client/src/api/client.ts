const BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Mapare cod eroare -> mesaj human-readable. Serverul trimite coduri masina
// (ex: "INSUFFICIENT_RESOURCES") si clientul le traduce. Asta decupleaza afisarea
// de implementarea serverului — serverul nu trebuie sa stie de i18n, si eu pot
// schimba textul fara sa ating backend-ul.
// Codurile cu parametri (HQ_REQUIRED:5, MB_REQUIRED:10) sunt tratate in humanizeError().
const ERROR_MESSAGES: Record<string, string> = {
  USERNAME_AND_EMAIL_TAKEN: "Username and email are already taken",
  USERNAME_TAKEN: "Username is already taken",
  EMAIL_TAKEN: "Email is already registered",
  MAP_FULL: "The world map is full. No new cities can be placed right now",
  INVALID_CREDENTIALS: "Username or password is incorrect",
  TOKEN_MISSING: "Authentication required",
  TOKEN_INVALID: "Session expired, please log in again",
  INTERNAL_SERVER_ERROR: "Internal server error",
  UNKNOWN_ERROR: "An unknown error occurred",
  CITY_NOT_FOUND: "City not found",
  BUILDING_NOT_FOUND: "Building not found",
  UNAUTHORIZED: "You don't have access",
  UPGRADE_IN_PROGRESS: "An upgrade is already in progress",
  MAX_LEVEL_REACHED: "Maximum level reached",
  INSUFFICIENT_RESOURCES: "Insufficient resources",
  INSUFFICIENT_POPULATION: "Insufficient population",
  ORDER_NOT_FOUND: "Order not found",
  INVALID_QUANTITY: "Invalid quantity",
  MILITARY_BASE_REQUIRED: "Requires Military Base level 1",
  INVALID_NAME: "Invalid name",
  INVALID_PAYLOAD: "Invalid request",
  INVALID_AMOUNT: "Invalid amount",
  BAR_ALREADY_FULL: "Bar is already full",
  BARS_NOT_FULL: "Bars are not full yet",
  GOVERNOR_ALREADY_RECRUITING: "Governor is already being recruited",
  USER_NOT_FOUND: "User not found",
  COMMAND_NOT_FOUND: "Command not found",
  NOT_CANCELLABLE: "This command cannot be cancelled",
  CANCEL_WINDOW_EXPIRED: "Cancel window has expired",
  SAME_CITY: "Cannot send command to the same city",
  TARGET_CITY_NOT_FOUND: "Target city not found",
  CANNOT_ATTACK_OWN_CITY: "Cannot attack your own city",
  CANNOT_SPY_OWN_CITY: "Cannot spy on your own city",
  CANNOT_ATTACK_ALLIANCE_MEMBER: "Cannot attack an alliance member",
  SPY_REQUIRES_HACKERS_ONLY: "Spy missions require hackers only",
  HACKERS_CANNOT_JOIN_BATTLE: "Hackers cannot join battle",
  NO_UNITS: "No units selected",
  NO_RESOURCES: "No resources selected",
  HARBOR_REQUIRED: "Harbor is required",
  EXCEEDS_HARBOR_CAPACITY: "Exceeds harbor capacity",
  NEGATIVE_RESOURCES: "Resource amounts cannot be negative",
  NO_STATIONED_UNITS: "No units stationed",
  NO_UNITS_WITHDRAWN: "No units to withdraw",
  INSUFFICIENT_STATIONED_UNITS: "Insufficient stationed units",
  CITY_UNDER_SIEGE: "City is under siege — actions blocked until the siege ends",
  CANNOT_WITHDRAW_BESIEGER_GARRISON: "You cannot withdraw your garrison while the siege is active",
};

function humanizeError(code: string): string {
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (code.startsWith("HQ_REQUIRED:")) return `Requires Headquarters level ${code.split(":")[1]}`;
  if (code.startsWith("MB_REQUIRED:")) return `Requires Military Base level ${code.split(":")[1]}`;
  if (code.startsWith("INSUFFICIENT_UNITS:")) return `Insufficient ${code.split(":")[1].toLowerCase()} units`;
  return code.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

const ACTIVE_CITY_KEY = "activeCityId";

export function getActiveCityId(): string | null {
  return localStorage.getItem(ACTIVE_CITY_KEY);
}

export function setActiveCityId(id: string): void {
  localStorage.setItem(ACTIVE_CITY_KEY, id);
  window.dispatchEvent(new CustomEvent("activeCityChanged", { detail: id }));
}

export function clearActiveCityId(): void {
  localStorage.removeItem(ACTIVE_CITY_KEY);
}

export function getCurrentUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const seg = token.split(".")[1];
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(pad));
    return payload.id ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = (body as any).error ?? `HTTP ${res.status}`;

    if (code === "TOKEN_INVALID" || code === "TOKEN_MISSING") {
      clearToken();
      clearActiveCityId();
      window.location.href = "/register";
      throw new Error("Session expired");
    }

    throw new Error(humanizeError(code));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
