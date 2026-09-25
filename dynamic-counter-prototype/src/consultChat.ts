import { CUSTOMERS, resolveAsk, type ChatLine, type CueId, type CustomerId } from "./campaign";

export type ConsultReply = { reply: string; useful: boolean; source: "model" | "fallback" };

export async function requestConsultReply(input: {
  customerId: CustomerId;
  playerMessage: string;
  discovered: CueId[];
  chat: ChatLine[];
  day: number;
}): Promise<ConsultReply> {
  // 模型没接上时她说哪一句，和柜台屏幕上落点那一条问题是同一个判断：不在这儿再算一遍。
  const ask = resolveAsk(input.customerId, input.playerMessage);
  const fallback: ConsultReply = { reply: ask.reply, useful: ask.useful, source: "fallback" };
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
    return { reply, useful: typeof data.useful === "boolean" ? data.useful : ask.useful, source: "model" };
  } catch {
    return fallback;
  }
}
