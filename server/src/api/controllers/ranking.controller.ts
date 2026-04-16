import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getRankings } from "../../services/ranking.service";

export const getRankingsHandler = async (_req: AuthRequest, res: Response) => {
  const rankings = await getRankings();
  return res.json(rankings);
};
