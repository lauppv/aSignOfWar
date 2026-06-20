import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  api,
  setToken,
  clearToken,
  getActiveCityId,
  setActiveCityId,
  clearActiveCityId,
  getCurrentUserId,
} from "@/shared/api/client";

type FetchResult = { ok: boolean; status: number; json: () => Promise<unknown> };

function mockFetch(result: FetchResult | (() => FetchResult)) {
  const fn = vi.fn(async () =>
    typeof result === "function" ? result() : result
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  // jsdom doesn't implement navigation; provide a writable stub so the
  // session-expired redirect doesn't blow up.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token + active-city helpers", () => {
  it("stores and clears the auth token", () => {
    setToken("abc");
    expect(localStorage.getItem("token")).toBe("abc");
    clearToken();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("stores, reads, and clears the active city id with an event", () => {
    const spy = vi.fn();
    window.addEventListener("activeCityChanged", spy);
    setActiveCityId("city-1");
    expect(getActiveCityId()).toBe("city-1");
    expect(spy).toHaveBeenCalledOnce();
    clearActiveCityId();
    expect(getActiveCityId()).toBeNull();
    window.removeEventListener("activeCityChanged", spy);
  });
});

describe("getCurrentUserId", () => {
  it("returns null with no token", () => {
    expect(getCurrentUserId()).toBeNull();
  });

  it("decodes the id from a JWT payload", () => {
    const payload = btoa(JSON.stringify({ id: "user-42" }));
    setToken(`header.${payload}.sig`);
    expect(getCurrentUserId()).toBe("user-42");
  });

  it("returns null for a malformed token", () => {
    setToken("not-a-jwt");
    expect(getCurrentUserId()).toBeNull();
  });
});

describe("api request wrapper", () => {
  it("GETs and parses JSON, without an auth header when unauthenticated", async () => {
    const fetchFn = mockFetch({ ok: true, status: 200, json: async () => ({ value: 1 }) });
    const data = await api.get<{ value: number }>("/thing");
    expect(data).toEqual({ value: 1 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/thing");
    expect((init as any).headers["Content-Type"]).toBe("application/json");
    expect((init as any).headers.Authorization).toBeUndefined();
  });

  it("adds a Bearer header and serializes the body on POST", async () => {
    setToken("tok-1");
    const fetchFn = mockFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await api.post("/do", { a: 1 });
    const [, init] = fetchFn.mock.calls[0];
    expect((init as any).method).toBe("POST");
    expect((init as any).body).toBe(JSON.stringify({ a: 1 }));
    expect((init as any).headers.Authorization).toBe("Bearer tok-1");
  });

  it("returns undefined for a 204 response", async () => {
    mockFetch({ ok: true, status: 204, json: async () => ({}) });
    await expect(api.delete("/gone")).resolves.toBeUndefined();
  });

  it("maps a known error code to a human message", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: "INSUFFICIENT_RESOURCES" }) });
    await expect(api.get("/x")).rejects.toThrow("Insufficient resources");
  });

  it("expands parameterized error codes", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: "HQ_REQUIRED:5" }) });
    await expect(api.get("/a")).rejects.toThrow("Requires Headquarters level 5");

    mockFetch({ ok: false, status: 400, json: async () => ({ error: "MB_REQUIRED:10" }) });
    await expect(api.get("/b")).rejects.toThrow("Requires Military Base level 10");

    mockFetch({ ok: false, status: 400, json: async () => ({ error: "INSUFFICIENT_UNITS:TANK" }) });
    await expect(api.get("/c")).rejects.toThrow("Insufficient tank units");
  });

  it("falls back to a prettified version of an unknown code", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: "SOME_WEIRD_THING" }) });
    await expect(api.get("/y")).rejects.toThrow("Some weird thing");
  });

  it("synthesizes an HTTP code when the error body is unparseable", async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(api.get("/z")).rejects.toThrow("Http 500");
  });

  it("clears session and redirects on TOKEN_INVALID", async () => {
    setToken("stale");
    setActiveCityId("city-9");
    mockFetch({ ok: false, status: 401, json: async () => ({ error: "TOKEN_INVALID" }) });

    await expect(api.patch("/p", {})).rejects.toThrow("Session expired");
    expect(localStorage.getItem("token")).toBeNull();
    expect(getActiveCityId()).toBeNull();
    expect(window.location.href).toBe("/register");
  });
});
