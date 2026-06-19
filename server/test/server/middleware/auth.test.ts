import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/core/env", () => ({
  default: { jwtSecret: "test-secret" },
}));
vi.mock("../../../src/core/db", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

import jwt from "jsonwebtoken";
import { authMiddleware, AuthRequest } from "../../../src/middleware/auth";
import prisma from "../../../src/core/db";

const findUnique = (prisma as any).user.findUnique as ReturnType<typeof vi.fn>;

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

const tokenFor = (id: string) => jwt.sign({ id }, "test-secret");

beforeEach(() => {
  findUnique.mockReset();
});

describe("authMiddleware", () => {
  it("rejects a missing Authorization header", async () => {
    const req = { headers: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("TOKEN_MISSING");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a header without the Bearer prefix", async () => {
    const req = { headers: { authorization: "Token abc" } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("TOKEN_MISSING");
  });

  it("rejects a token that fails verification", async () => {
    const req = {
      headers: { authorization: "Bearer not-a-real-token" },
    } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("TOKEN_INVALID");
  });

  it("accepts a valid token, sets userId, and caches the lookup", async () => {
    findUnique.mockResolvedValue({ id: "user-cached" });
    const req = {
      headers: { authorization: `Bearer ${tokenFor("user-cached")}` },
    } as AuthRequest;
    const next = vi.fn();

    await authMiddleware(req, mockRes(), next);
    expect(req.userId).toBe("user-cached");
    expect(next).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledOnce();

    // Second call within the TTL must hit the cache, not the DB.
    const req2 = {
      headers: { authorization: `Bearer ${tokenFor("user-cached")}` },
    } as AuthRequest;
    const next2 = vi.fn();
    await authMiddleware(req2, mockRes(), next2);
    expect(next2).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledOnce();
  });

  it("rejects a valid token whose user no longer exists", async () => {
    findUnique.mockResolvedValue(null);
    const req = {
      headers: { authorization: `Bearer ${tokenFor("user-gone")}` },
    } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("TOKEN_INVALID");
    expect(next).not.toHaveBeenCalled();
  });
});
