import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as svc from "../../services/user.service";
import { uploadUserAvatar } from "../../services/avatar.service";

const ERROR_STATUS: Record<string, number> = {
  DESCRIPTION_TOO_LONG: 400,
  FILE_TOO_LARGE: 400,
  INVALID_IMAGE: 400,
  IMAGE_TOO_SMALL: 400,
};

function handle(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN";
  return res.status(ERROR_STATUS[msg] ?? 500).json({ error: msg });
}

export const getPlayerProfileHandler = async (req: AuthRequest, res: Response) => {
  const p = await svc.getPlayerProfile(req.params.id as string);
  if (!p) return res.status(404).json({ error: "USER_NOT_FOUND" });
  res.json(p);
};

export const uploadAvatarHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });
    const avatarUrl = await uploadUserAvatar(req.userId!, req.file);
    res.json({ avatarUrl });
  } catch (e) { handle(res, e); }
};

export const updateMyDescriptionHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body ?? {};
    if (description != null && typeof description !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    await svc.updateMyDescription(req.userId!, description ?? null);
    res.status(204).end();
  } catch (e) { handle(res, e); }
};
