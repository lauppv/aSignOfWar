import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { createSharedReport, getSharedReport } from "../../services/sharedReport.service";

export const share = async (req: AuthRequest, res: Response) => {
  try {
    const commandId = req.params.commandId as string;
    const { hideOwnTroops, hideOwnInitial, hideEnemyTroops } = req.body;
    const id = await createSharedReport(commandId, req.userId!, {
      hideOwnTroops: !!hideOwnTroops,
      hideOwnInitial: !!hideOwnInitial,
      hideEnemyTroops: !!hideEnemyTroops,
    });
    return res.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    const code = msg === "Forbidden" ? 403 : msg === "Report not found" ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
};

export const get = async (req: Request, res: Response) => {
  try {
    const data = await getSharedReport(req.params.id as string);
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    const code = msg.includes("not found") ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
};
