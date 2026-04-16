import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getRankings, getAllianceRankings } from "../../services/ranking.service";

export const getRankingsHandler = async (_req: AuthRequest, res: Response) => {
  const rankings = await getRankings();
  return res.json(rankings);
};

export const getAllianceRankingsHandler = async (_req: AuthRequest, res: Response) => {
  const rankings = await getAllianceRankings();
  return res.json(rankings);
};
