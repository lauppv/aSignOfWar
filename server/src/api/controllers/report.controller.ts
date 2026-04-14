import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getReportsForUser } from "../../services/report.service";

export const getReports = async (req: AuthRequest, res: Response) => {
  const reports = await getReportsForUser(req.userId!);
  return res.json(reports);
};
