import { Request, Response, NextFunction } from "express";
import { sendCommand, getCommandsForCity } from "../../services/command.service";
import { AuthRequest } from "../../middleware/auth";
import { CommandType, UnitName } from "@prisma/client";

export const sendCommandHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId     = req.userId!;
    const fromCityId = req.params.cityId as string;
    const { type, targetCityId, units = {}, resources = {} } = req.body;

    if (!["ATTACK", "SUPPORT", "RESOURCES"].includes(type)) {
      return res.status(400).json({ error: "INVALID_TYPE" });
    }

    const result = await sendCommand(
      fromCityId,
      targetCityId,
      type as CommandType,
      userId,
      units as Partial<Record<UnitName, number>>,
      {
        money:  Number(resources.money  ?? 0),
        energy: Number(resources.energy ?? 0),
        ammo:   Number(resources.ammo   ?? 0),
      }
    );

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
    if (code?.startsWith("INSUFFICIENT_UNITS")) return res.status(400).json({ error: code });
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
