import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import * as svc from "../../services/alliance.service";

const ERROR_STATUS: Record<string, number> = {
  USER_NOT_FOUND: 404,
  ALLIANCE_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  ALREADY_IN_ALLIANCE: 409,
  NOT_IN_ALLIANCE: 409,
  NAME_TAKEN: 409,
  TAG_TAKEN: 409,
  NAME_LENGTH: 400,
  TAG_LENGTH: 400,
  TAG_FORMAT: 400,
  DESCRIPTION_TOO_LONG: 400,
  LEADER_MUST_TRANSFER_OR_DISBAND: 409,
  NOT_LEADER: 403,
  CANNOT_KICK_SELF: 400,
  ALREADY_LEADER: 400,
  INVALID_ACCESS_MODE: 400,
  CANNOT_INVITE_SELF: 400,
  ALREADY_MEMBER: 409,
  USER_IN_OTHER_ALLIANCE: 409,
  ALREADY_INVITED: 409,
  INVITATION_NOT_FOUND: 404,
  APPLICATION_NOT_FOUND: 404,
  APPLICATIONS_CLOSED: 403,
  ALREADY_APPLIED: 409,
  MESSAGE_REQUIRED: 400,
  MESSAGE_TOO_LONG: 400,
  MESSAGE_NOT_FOUND: 404,
  NOT_MESSAGE_AUTHOR: 403,
  JOIN_NOT_ALLOWED: 403,
};

function handle(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : "UNKNOWN";
  const status = ERROR_STATUS[msg] ?? 500;
  return res.status(status).json({ error: msg });
}

export const listAlliancesHandler = async (_req: AuthRequest, res: Response) => {
  res.json(await svc.listAlliances());
};

export const getMyAllianceHandler = async (req: AuthRequest, res: Response) => {
  res.json(await svc.getMyAlliance(req.userId!));
};

export const getAllianceHandler = async (req: AuthRequest, res: Response) => {
  const a = await svc.getAlliance(req.params.id as string);
  if (!a) return res.status(404).json({ error: "ALLIANCE_NOT_FOUND" });
  res.json(a);
};

export const getAllianceProfileHandler = async (req: AuthRequest, res: Response) => {
  const p = await svc.getAllianceProfile(req.params.id as string);
  if (!p) return res.status(404).json({ error: "ALLIANCE_NOT_FOUND" });
  res.json(p);
};

export const createAllianceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { name, tag, description } = req.body ?? {};
    if (typeof name !== "string" || typeof tag !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }
    const a = await svc.createAlliance(req.userId!, name, tag, description ?? null);
    res.status(201).json(a);
  } catch (e) { handle(res, e); }
};

export const joinAllianceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const a = await svc.joinAlliance(req.userId!, req.params.id as string);
    res.json(a);
  } catch (e) { handle(res, e); }
};

export const leaveAllianceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.leaveAlliance(req.userId!);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const disbandAllianceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.disbandAlliance(req.userId!);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const kickMemberHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.kickMember(req.userId!, req.params.memberId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const transferLeadershipHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.transferLeadership(req.userId!, req.params.memberId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const updateAllianceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { name, tag, description, accessMode } = req.body ?? {};
    const r = await svc.updateAlliance(req.userId!, { name, tag, description, accessMode });
    res.json(r);
  } catch (e) { handle(res, e); }
};

// ─── Invitations ────────────────────────────────────────────────────────────────

export const inviteByUsernameHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.body ?? {};
    if (typeof username !== "string") return res.status(400).json({ error: "INVALID_PAYLOAD" });
    const r = await svc.inviteByUsername(req.userId!, username);
    res.status(201).json(r);
  } catch (e) { handle(res, e); }
};

export const cancelInvitationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.cancelInvitation(req.userId!, req.params.invitationId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const listAllianceInvitationsHandler = async (req: AuthRequest, res: Response) => {
  try {
    res.json(await svc.listAllianceInvitations(req.userId!));
  } catch (e) { handle(res, e); }
};

export const listMyInvitationsHandler = async (req: AuthRequest, res: Response) => {
  res.json(await svc.listMyInvitations(req.userId!));
};

export const acceptInvitationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.acceptInvitation(req.userId!, req.params.invitationId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const rejectInvitationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.rejectInvitation(req.userId!, req.params.invitationId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

// ─── Applications ───────────────────────────────────────────────────────────────

export const submitApplicationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body ?? {};
    if (typeof message !== "string") return res.status(400).json({ error: "INVALID_PAYLOAD" });
    const r = await svc.submitApplication(req.userId!, req.params.id as string, message);
    res.status(201).json(r);
  } catch (e) { handle(res, e); }
};

export const cancelMyApplicationHandler = async (req: AuthRequest, res: Response) => {
  res.json(await svc.cancelMyApplication(req.userId!));
};

export const listMyApplicationHandler = async (req: AuthRequest, res: Response) => {
  res.json(await svc.listMyApplication(req.userId!));
};

export const listAllianceApplicationsHandler = async (req: AuthRequest, res: Response) => {
  try {
    res.json(await svc.listAllianceApplications(req.userId!));
  } catch (e) { handle(res, e); }
};

export const acceptApplicationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.acceptApplication(req.userId!, req.params.applicationId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

export const rejectApplicationHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await svc.rejectApplication(req.userId!, req.params.applicationId as string);
    res.json(r);
  } catch (e) { handle(res, e); }
};

// ─── Messages ───────────────────────────────────────────────────────────────────

export const listMessagesHandler = async (req: AuthRequest, res: Response) => {
  try {
    res.json(await svc.listMessages(req.userId!));
  } catch (e) { handle(res, e); }
};

export const postMessageHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body ?? {};
    if (typeof content !== "string") return res.status(400).json({ error: "INVALID_PAYLOAD" });
    const r = await svc.postMessage(req.userId!, content);
    res.status(201).json(r);
  } catch (e) { handle(res, e); }
};

export const deleteMessageHandler = async (req: AuthRequest, res: Response) => {
  try {
    await svc.deleteMessage(req.userId!, req.params.messageId as string);
    res.status(204).end();
  } catch (e) { handle(res, e); }
};
