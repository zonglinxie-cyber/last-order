import type { ChatMessage, NpcChatResult, NpcId } from './day1';

interface NpcChatRequest {
  npcId: NpcId;
  playerName: string;
  playerMessage: string;
  phase: string;
  relationship: number;
  memories: string[];
  recentMessages: ChatMessage[];
  channel: 'face_to_face' | 'message';
}

export async function requestNpcReply(payload: NpcChatRequest, signal?: AbortSignal): Promise<NpcChatResult> {
  const response = await fetch('/api/npc-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await response.json().catch(() => null) as (NpcChatResult & { error?: string }) | null;
  if (!response.ok || !data || typeof data.reply !== 'string') {
    throw new Error(data?.error || 'NPC_CHAT_FAILED');
  }
  return data;
}
