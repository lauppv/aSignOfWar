import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../src/modules/auth/auth.schema";
import { renameCitySchema } from "../../src/modules/city/city.schema";
import { sendCommandSchema } from "../../src/modules/command/command.schema";
import { recruitSchema } from "../../src/modules/recruitment/recruitment.schema";
import {
  depositGovernorSchema,
  recruitGovernorSchema,
} from "../../src/modules/governor/governor.schema";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("auth schemas", () => {
  it("accepts a well-formed registration", () => {
    expect(
      registerSchema.safeParse({
        username: "neo",
        email: "neo@matrix.io",
        password: "secret1",
        cityName: "Zion",
      }).success
    ).toBe(true);
  });

  it("rejects a short username and a bad email", () => {
    expect(
      registerSchema.safeParse({
        username: "ab",
        email: "nope",
        password: "secret1",
        cityName: "Zion",
      }).success
    ).toBe(false);
  });

  it("requires non-empty login credentials", () => {
    expect(loginSchema.safeParse({ username: "a", password: "b" }).success).toBe(
      true
    );
    expect(loginSchema.safeParse({ username: "", password: "" }).success).toBe(
      false
    );
  });
});

describe("renameCitySchema", () => {
  it("trims and bounds the name", () => {
    const parsed = renameCitySchema.parse({ name: "  Capital  " });
    expect(parsed.name).toBe("Capital");
    expect(renameCitySchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("sendCommandSchema", () => {
  it("applies defaults for omitted units and resources", () => {
    const parsed = sendCommandSchema.parse({
      type: "ATTACK",
      targetCityId: UUID,
    });
    expect(parsed.units).toEqual({});
    expect(parsed.resources).toEqual({ money: 0, energy: 0, ammo: 0 });
  });

  it("rejects an unknown command type", () => {
    expect(
      sendCommandSchema.safeParse({ type: "NUKE", targetCityId: UUID }).success
    ).toBe(false);
  });

  it("rejects a non-uuid target", () => {
    expect(
      sendCommandSchema.safeParse({ type: "SPY", targetCityId: "x" }).success
    ).toBe(false);
  });
});

describe("recruitSchema", () => {
  it("requires a known unit and a positive quantity", () => {
    expect(recruitSchema.safeParse({ unitName: "TANK", quantity: 3 }).success).toBe(
      true
    );
    expect(recruitSchema.safeParse({ unitName: "TANK", quantity: 0 }).success).toBe(
      false
    );
    expect(
      recruitSchema.safeParse({ unitName: "WIZARD", quantity: 1 }).success
    ).toBe(false);
  });
});

describe("governor schemas", () => {
  it("validates deposits and recruitment payloads", () => {
    expect(
      depositGovernorSchema.safeParse({
        cityId: UUID,
        resource: "money",
        amount: 50,
      }).success
    ).toBe(true);
    expect(
      depositGovernorSchema.safeParse({
        cityId: UUID,
        resource: "gold",
        amount: 50,
      }).success
    ).toBe(false);
    expect(recruitGovernorSchema.safeParse({ cityId: UUID }).success).toBe(true);
  });
});
