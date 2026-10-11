const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const WS_BASE = API_BASE.replace(/^http/, "ws");

export interface Board {
  letters: string;
  ends_at: string;
}

export interface Die {
  letter: string;
  orientation: number;
}

export type WsMessage =
  | { event: "room_created"; room_id: string; code: string }
  | {
      event: "room_state";
      room_id: string;
      code: string;
      board?: Die[];
      ends_at?: string;
    }
  | { event: "new_board"; board: Die[]; ends_at: string }
  | { event: "player_joined"; message: string };

/** M-A2: the shared WORD-WORD-DD format, mirrored from the backend's
 *  `internal/codes`. Used to hint the join field; the server is still the
 *  authority (a typo fails there, never here). */
export const ROOM_CODE_RE = /^[A-Z]{3,}-[A-Z]{3,}-[2-9][2-9]$/;

export const startNewGame = async (roomCode: string) => {
  const res = await fetch(`${API_BASE}/api/boggle/rooms/${roomCode}/boards`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to start game");
  return res.json();
};

/**
 * M-A2: rooms are joined BY CODE. The WS route is strictly code-keyed (a
 * mistyped code must fail server-side rather than resolving to some other
 * room), so this takes a code, not an id. `startNewGame` is the one place
 * that still accepts the uuid fallback — the REST resolver is code-first
 * with a uuid fallback, so the creator's own link keeps working.
 */
export const getWsUrl = (roomCode?: string) => {
  return roomCode
    ? `${WS_BASE}/ws/boggle/rooms/${roomCode}`
    : `${WS_BASE}/ws/boggle/rooms`;
};
