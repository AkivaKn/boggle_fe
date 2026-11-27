export type AiAction = "clue" | "vote" | "drifter_guess";

export type AiTurnRequest = {
  action: AiAction;
  characterId: string;
  seat: number;
  publicState: {
    players: { seat: number; name: string; alive: boolean; isAi: boolean; characterId?: string }[];
    clues: { seat: number; name: string; text: string }[];
    eliminated: { seat: number; name: string; role: string }[];
  };
  privateState: { role: string; word: string };
  rules: { maxClueLength: number };
};

export type AiTurnResponse = {
  ok: boolean;
  action: AiAction;
  clue?: string;
  targetSeat?: number;
  guess?: string;
  fallback?: boolean;
  error?: string;
};

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function requestAiTurn(req: AiTurnRequest): Promise<AiTurnResponse> {
  const res = await fetch(`${API_BASE}/api/misclue/ai/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `AI request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error || parsed.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}
