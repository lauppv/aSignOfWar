import { describe, it, expect } from "vitest";
import {
  fmtArrival,
  CMD_LABEL,
  BUILDING_DISPLAY,
  UNIT_DISPLAY,
  CATEGORY_LABEL,
} from "@/shared/lib/labels";

describe("fmtArrival", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");

  it("returns 'arriving...' for past or present timestamps", () => {
    expect(fmtArrival("2025-12-31T23:59:59.000Z", now)).toBe("arriving...");
    expect(fmtArrival("2026-01-01T00:00:00.000Z", now)).toBe("arriving...");
  });

  it("formats hours and minutes when over an hour away", () => {
    const iso = new Date(now + (2 * 3600 + 5 * 60 + 30) * 1000).toISOString();
    expect(fmtArrival(iso, now)).toBe("2h 5m");
  });

  it("formats minutes and seconds when under an hour", () => {
    const iso = new Date(now + (5 * 60 + 30) * 1000).toISOString();
    expect(fmtArrival(iso, now)).toBe("5m 30s");
  });

  it("formats only seconds when under a minute", () => {
    const iso = new Date(now + 42 * 1000).toISOString();
    expect(fmtArrival(iso, now)).toBe("42s");
  });
});

describe("label maps", () => {
  it("exposes display strings for every command type and category", () => {
    expect(CMD_LABEL.ATTACK).toBe("Attack");
    expect(CATEGORY_LABEL.SPY).toBe("Spy");
    expect(BUILDING_DISPLAY.HEADQUARTERS).toBe("Headquarters");
    expect(UNIT_DISPLAY.GOVERNOR).toBe("Governor");
  });
});
