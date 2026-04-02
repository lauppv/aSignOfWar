import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { startRecruitment, cancelRecruitment } from "../../services/recruitment.service";
import { UnitName } from "@prisma/client";

export const recruitUnits = async (req: AuthRequest, res: Response) => {
  try {
    const cityId   = req.params.cityId as string;
    const unitName = req.body.unitName as UnitName;
    const quantity = Number(req.body.quantity);

    if (!unitName || !Object.values(UnitName).includes(unitName)) {
      return res.status(400).json({ mesaj: "Unitate invalida" });
    }

    const result = await startRecruitment(cityId, unitName, quantity, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      return res.status(500).json({ mesaj: "Eroare necunoscuta" });
    }

    if (err.message === "CITY_NOT_FOUND")           return res.status(404).json({ mesaj: "Orasul nu exista" });
    if (err.message === "UNAUTHORIZED")              return res.status(403).json({ mesaj: "Nu ai acces la acest oras" });
    if (err.message === "INVALID_QUANTITY")          return res.status(400).json({ mesaj: "Cantitate invalida" });
    if (err.message === "MILITARY_BASE_REQUIRED")    return res.status(400).json({ mesaj: "Necesita Baza militara nivel 1" });
    if (err.message === "INSUFFICIENT_RESOURCES")    return res.status(400).json({ mesaj: "Resurse insuficiente" });
    if (err.message === "INSUFFICIENT_POPULATION")   return res.status(400).json({ mesaj: "Populatie insuficienta" });

    if (err.message.startsWith("HQ_REQUIRED:")) {
      const level = err.message.split(":")[1];
      return res.status(400).json({ mesaj: `Necesita Headquarters nivel ${level}` });
    }
    if (err.message.startsWith("MB_REQUIRED:")) {
      const level = err.message.split(":")[1];
      return res.status(400).json({ mesaj: `Necesita Baza militara nivel ${level}` });
    }

    throw err;
  }
};

export const cancelRecruitmentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const result = await cancelRecruitment(orderId, req.userId!);
    return res.json(result);
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      return res.status(500).json({ mesaj: "Eroare necunoscuta" });
    }
    if (err.message === "ORDER_NOT_FOUND") return res.status(404).json({ mesaj: "Comanda nu exista" });
    if (err.message === "UNAUTHORIZED")    return res.status(403).json({ mesaj: "Nu ai acces" });
    throw err;
  }
};
