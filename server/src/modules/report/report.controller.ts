import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import {
  getReportsForUser,
  deleteReportForUser,
  deleteAllReportsForUser,
} from "./report.service";

export const getReports = async (req: AuthRequest, res: Response) => {
  const reports = await getReportsForUser(req.userId!);
  return res.json(reports);
};

export const deleteReport = async (req: AuthRequest, res: Response) => {
  try {
    await deleteReportForUser(req.params.id as string, req.userId!);
    return res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    const code = msg === "Forbidden" ? 403 : msg === "Report not found" ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
};

export const deleteAllReports = async (req: AuthRequest, res: Response) => {
  await deleteAllReportsForUser(req.userId!);
  return res.status(204).send();
};
