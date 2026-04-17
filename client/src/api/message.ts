import { api } from "./client.ts";

export interface UserRef {
  id: string;
  username: string;
}

export interface DirectMessage {
  id: string;
  from: UserRef;
  to: UserRef;
  content: string;
  createdAt: string;
  mine: boolean;
  readByRecipient: boolean;
}

export interface DirectConversation {
  peer: UserRef;
  lastContent: string;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
}

export function listDirectConversations(): Promise<DirectConversation[]> {
  return api.get("/messages/direct/conversations");
}

export function listDirectThread(peerId: string): Promise<DirectMessage[]> {
  return api.get(`/messages/direct/${encodeURIComponent(peerId)}`);
}

export function sendDirectMessage(toUsername: string, content: string): Promise<DirectMessage> {
  return api.post("/messages/direct", { toUsername, content });
}

export function deleteDirectMessage(id: string): Promise<void> {
  return api.delete(`/messages/direct/${encodeURIComponent(id)}`);
}

export function getDirectUnreadCount(): Promise<{ count: number }> {
  return api.get("/messages/direct/unread");
}
