import { Response, NextFunction } from "express";
import { sendCommand, getCommandsForCity, cancelCommand, withdrawStationedSupport } from "../../services/command.service";
import { AuthRequest } from "../../middleware/auth";

export const sendCommandHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Body deja validat de Zod (sendCommandSchema)
    const userId     = req.userId!;
    const fromCityId = req.params.cityId as string;
    const { type, targetCityId, units, resources } = req.body;

    const result = await sendCommand(fromCityId, targetCityId, type, userId, units, resources);
    res.status(201).json(result);
  } catch (err: any) {
    const code = err.message;
    if (code === "SAME_CITY")                  return res.status(400).json({ error: code });
    if (code === "TARGET_CITY_NOT_FOUND")      return res.status(404).json({ error: code });
    if (code === "UNAUTHORIZED")               return res.status(403).json({ error: code });
    if (code === "CANNOT_ATTACK_OWN_CITY")     return res.status(400).json({ error: code });
    if (code === "NO_UNITS")                   return res.status(400).json({ error: code });
    if (code === "NO_RESOURCES")               return res.status(400).json({ error: code });
    if (code === "HARBOR_REQUIRED")            return res.status(400).json({ error: code });
    if (code === "EXCEEDS_HARBOR_CAPACITY")    return res.status(400).json({ error: code });
    if (code === "INSUFFICIENT_RESOURCES")     return res.status(400).json({ error: code });
    if (code === "NEGATIVE_RESOURCES")         return res.status(400).json({ error: code });
    if (code?.startsWith("INSUFFICIENT_UNITS")) return res.status(400).json({ error: code });
    next(err);
  }
};

export const cancelCommandHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId    = req.userId!;
    const commandId = req.params.commandId as string;
    const result = await cancelCommand(commandId, userId);
    res.json(result);
  } catch (err: any) {
    const code = err.message;
    if (code === "COMMAND_NOT_FOUND") return res.status(404).json({ error: code });
    if (code === "UNAUTHORIZED")      return res.status(403).json({ error: code });
    if (code === "NOT_CANCELLABLE")      return res.status(400).json({ error: code });
    if (code === "CANCEL_WINDOW_EXPIRED") return res.status(400).json({ error: code });
    next(err);
  }
};

export const withdrawSupportHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId     = req.userId!;
    const fromCityId = req.params.cityId as string;
    const { targetCityId, mode, units } = req.body as {
      targetCityId: string;
      mode: "all" | "partial";
      units?: Record<string, number>;
    };
    const result = await withdrawStationedSupport(
      fromCityId,
      targetCityId,
      userId,
      mode === "all" ? "all" : (units ?? {}),
    );
    res.json(result);
  } catch (err: any) {
    const code = err.message;
    if (code === "CITY_NOT_FOUND")              return res.status(404).json({ error: code });
    if (code === "UNAUTHORIZED")                return res.status(403).json({ error: code });
    if (code === "NO_STATIONED_UNITS")          return res.status(400).json({ error: code });
    if (code === "NO_UNITS")                    return res.status(400).json({ error: code });
    if (code === "NO_UNITS_WITHDRAWN")          return res.status(400).json({ error: code });
    if (code === "INSUFFICIENT_STATIONED_UNITS") return res.status(400).json({ error: code });
    next(err);
  }
};

export const getCommandsHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const cityId = req.params.cityId as string;
    const result = await getCommandsForCity(cityId, userId);
    res.json(result);
  } catch (err: any) {
    if (err.message === "CITY_NOT_FOUND") return res.status(404).json({ error: "CITY_NOT_FOUND" });
    if (err.message === "UNAUTHORIZED")   return res.status(403).json({ error: "UNAUTHORIZED" });
    next(err);
  }
};
