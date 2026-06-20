import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "../../../src/middleware/validate";

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

const schema = z.object({ name: z.string().min(2), age: z.number().int() });

describe("validate middleware", () => {
  it("assigns parsed data and calls next on success", () => {
    const req: any = { body: { name: "abc", age: 5 } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: "abc", age: 5 });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 with the field path in the joined message", () => {
    const req: any = { body: { name: "a", age: 1.5 } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("name");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("omits the path prefix for a top-level (pathless) error", () => {
    const req: any = { body: "not-an-object" };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.startsWith(":")).toBe(false);
  });
});
