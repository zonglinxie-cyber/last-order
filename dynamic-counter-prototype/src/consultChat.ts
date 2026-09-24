import { CUSTOMERS, fallbackReply, inferUseful, type ChatLine, type CueId, type CustomerId } from "./campaign";

export type ConsultReply = { reply: string; useful: boolean; source: "model" | "fallback" };

export async function requestConsultReply(input: {
  customerId: CustomerId;
  playerMessage: string;
  discovered: CueId[];
  chat: ChatLine[];
  day: number;
}): Promise<ConsultReply> {
  const useful = inferUseful(input.customerId, input.playerMessage);
  const fallback: ConsultReply = {
    reply: fallbackReply(input.customerId, input.playerMessage, null, useful),
    useful,
    source: "fallback",
  };
  if (!import.meta.env?.DEV || import.meta.env.VITE_CONSULT_MODE === "scripted") return fallback;
  const customer = CUSTOMERS[input.customerId];
  const findings = input.discovered.map(id => `${customer.cues[id].label}：${customer.cues[id].finding}`).join("；");
  try {
    const response = await fetch("http://127.0.0.1:8788/api/consult-chat", {
      signal: AbortSignal.timeout(4000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: input.customerId,
        name: customer.name,
        descriptor: customer.descriptor,
        opening: customer.opening,
        need: customer.need,
        findings,
        playerMessage: input.playerMessage.slice(0, 280),
        recentChat: input.chat.slice(-6),
        day: input.day,
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json() as { reply?: unknown; useful?: unknown };
    const reply = typeof data.reply === "string" ? data.reply.trim().slice(0, 160) : "";
    if (!reply) return fallback;
    return { reply, useful: typeof data.useful === "boolean" ? data.useful : useful, source: "model" };
  } catch {
    return fallback;
  }
}
