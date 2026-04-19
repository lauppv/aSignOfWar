import { api } from "./client.ts";

export type AllianceAccess = "OPEN" | "CLOSED" | "INVITE_ONLY" | "APPLICATION";

export interface AllianceSummary {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  accessMode: AllianceAccess;
  leader: { id: string; username: string };
  memberCount: number;
  createdAt: string;
}

export interface AllianceMember {
  id: string;
  username: string;
}

export interface AllianceDetail {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  accessMode: AllianceAccess;
  createdAt: string;
  leader: { id: string; username: string };
  members: AllianceMember[];
}

export interface AllianceInvitationForLeader {
  id: string;
  user: { id: string; username: string };
  createdAt: string;
}

export interface AllianceInvitationForMe {
  id: string;
  alliance: { id: string; name: string; tag: string; accessMode: AllianceAccess };
  createdAt: string;
}

export interface AllianceApplication {
  id: string;
  user: { id: string; username: string };
  message: string;
  createdAt: string;
}

export interface MyApplication {
  id: string;
  alliance: { id: string; name: string; tag: string };
  message: string;
  createdAt: string;
}

export interface AllianceProfileMember {
  id: string;
  username: string;
  points: number;
  cities: number;
  totalKills: number;
}

export interface AllianceProfile {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  avatarUrl: string | null;
  accessMode: AllianceAccess;
  createdAt: string;
  leader: { id: string; username: string };
  memberCount: number;
  cities: number;
  points: number;
  pointsPerMember: number;
  pointsPerCity: number;
  totalKills: number;
  rank: number;
  totalAlliances: number;
  members: AllianceProfileMember[];
}

export function getAllianceProfile(id: string): Promise<AllianceProfile> {
  return api.get(`/alliances/${encodeURIComponent(id)}/profile`);
}

export async function uploadAllianceAvatar(allianceId: string, file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append("avatar", file);
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/alliances/${encodeURIComponent(allianceId)}/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AllianceMessage {
  id: string;
  author: { id: string; username: string };
  content: string;
  createdAt: string;
}

export function listAlliances(): Promise<AllianceSummary[]> {
  return api.get("/alliances");
}
export function getMyAlliance(): Promise<AllianceDetail | null> {
  return api.get("/alliances/me");
}
export function getAlliance(id: string): Promise<AllianceDetail> {
  return api.get(`/alliances/${id}`);
}
export function createAlliance(payload: { name: string; tag: string; description?: string }) {
  return api.post<AllianceDetail>("/alliances", payload);
}
export function joinAlliance(id: string) {
  return api.post<AllianceDetail>(`/alliances/${id}/join`, {});
}
export function leaveAlliance() {
  return api.post<{ allianceId: string; disbanded: boolean }>("/alliances/leave", {});
}
export function disbandAlliance() {
  return api.post<{ id: string }>("/alliances/disband", {});
}
export function updateAlliance(patch: {
  name?: string; tag?: string; description?: string | null; accessMode?: AllianceAccess;
}) {
  return api.patch<AllianceDetail>("/alliances", patch);
}
export function kickMember(memberId: string) {
  return api.post<{ allianceId: string }>(`/alliances/members/${memberId}/kick`, {});
}
export function transferLeadership(memberId: string) {
  return api.post<AllianceDetail>(`/alliances/members/${memberId}/transfer`, {});
}

// Invitations
export function inviteByUsername(username: string) {
  return api.post("/alliances/invite", { username });
}
export function listAllianceInvitations(): Promise<AllianceInvitationForLeader[]> {
  return api.get("/alliances/invitations");
}
export function cancelInvitation(invitationId: string) {
  return api.delete(`/alliances/invitations/${invitationId}`);
}
export function listMyInvitations(): Promise<AllianceInvitationForMe[]> {
  return api.get("/alliances/me/invitations");
}
export function acceptInvitation(invitationId: string) {
  return api.post(`/alliances/invitations/${invitationId}/accept`, {});
}
export function rejectInvitation(invitationId: string) {
  return api.post(`/alliances/invitations/${invitationId}/reject`, {});
}

// Applications
export function submitApplication(allianceId: string, message: string) {
  return api.post(`/alliances/${allianceId}/apply`, { message });
}
export function getMyApplication(): Promise<MyApplication | null> {
  return api.get("/alliances/me/application");
}
export function cancelMyApplication() {
  return api.post("/alliances/me/application/cancel", {});
}
export function listAllianceApplications(): Promise<AllianceApplication[]> {
  return api.get("/alliances/applications");
}
export function acceptApplication(applicationId: string) {
  return api.post(`/alliances/applications/${applicationId}/accept`, {});
}
export function rejectApplication(applicationId: string) {
  return api.post(`/alliances/applications/${applicationId}/reject`, {});
}

// Messages
export function listMessages(): Promise<AllianceMessage[]> {
  return api.get("/alliances/messages");
}
export function postMessage(content: string) {
  return api.post<AllianceMessage>("/alliances/messages", { content });
}
export function deleteAllianceMessage(id: string): Promise<void> {
  return api.delete(`/alliances/messages/${encodeURIComponent(id)}`);
}
export function getAllianceUnreadCount(): Promise<{ count: number }> {
  return api.get("/alliances/messages/unread");
}
