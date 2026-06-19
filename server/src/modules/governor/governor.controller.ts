import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getGovernorState, depositGovernor, recruitGovernor } from "./governor.service";
import { depositGovernorSchema, recruitGovernorSchema } from "./governor.schema";

export const getGovernor = async (req: AuthRequest, res: Response) => {
  const state = await getGovernorState(req.userId!);
  return res.json(state);
};

export const deposit = async (req: AuthRequest, res: Response) => {
  const parsed = depositGovernorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }
  try {
    const result = await depositGovernor(
      req.userId!,
      parsed.data.cityId,
      parsed.data.resource,
      parsed.data.amount,
    );
    return res.json(result);
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = err.message;
      const bad: Record<string, number> = {
        INVALID_AMOUNT:           400,
        CITY_NOT_FOUND:           404,
        UNAUTHORIZED:             403,
        BAR_ALREADY_FULL:         400,
        INSUFFICIENT_RESOURCES:   400,
        INSUFFICIENT_POPULATION:  400,
      };
      if (code.startsWith("HQ_REQUIRED")) {
        return res.status(400).json({ error: code });
      }
      if (bad[code] != null) {
        return res.status(bad[code]).json({ error: code });
      }
    }
    throw err;
  }
};

export const recruit = async (req: AuthRequest, res: Response) => {
  const parsed = recruitGovernorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }
  try {
    const result = await recruitGovernor(req.userId!, parsed.data.cityId);
    return res.json(result);
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = err.message;
      const bad: Record<string, number> = {
        CITY_NOT_FOUND:             404,
        UNAUTHORIZED:               403,
        BARS_NOT_FULL:              400,
        INSUFFICIENT_POPULATION:    400,
        GOVERNOR_ALREADY_RECRUITING: 409,
        USER_NOT_FOUND:             404,
      };
      if (code.startsWith("HQ_REQUIRED")) {
        return res.status(400).json({ error: code });
      }
      if (bad[code] != null) {
        return res.status(bad[code]).json({ error: code });
      }
    }
    throw err;
  }
};
