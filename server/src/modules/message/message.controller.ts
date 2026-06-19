import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as svc from "./message.service";

const ERROR_STATUS: Record<string, number> = {
  MESSAGE_REQUIRED: 400,
  MESSAGE_TOO_LONG: 400,
  RECIPIENT_NOT_FOUND: 404,
  CANNOT_MESSAGE_SELF: 400,
  MESSAGE_NOT_FOUND: 404,
  NOT_PARTICIPANT: 403,
};

function handle(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN";
  return res.status(ERROR_STATUS[msg] ?? 500).json({ error: msg });
}

export const listConversationsHandler = async (req: AuthRequest, res: Response) => {
  res.json(await svc.listConversations(req.userId!));
};

export const listThreadHandler = async (req: AuthRequest, res: Response) => {
  const peerId = req.params.peerId as string;
  res.json(await svc.listThread(req.userId!, peerId));
};

export const sendDirectHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { toUsername, content } = req.body ?? {};
    if (typeof toUsername !== "string" || typeof content !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    const r = await svc.sendDirect(req.userId!, toUsername, content);
    res.status(201).json(r);
  } catch (e) { handle(res, e); }
};

export const deleteDirectHandler = async (req: AuthRequest, res: Response) => {
  try {
    await svc.deleteDirect(req.userId!, req.params.id as string);
    res.status(204).end();
  } catch (e) { handle(res, e); }
};

export const unreadDirectHandler = async (req: AuthRequest, res: Response) => {
  res.json({ count: await svc.countUnreadDirect(req.userId!) });
};
