const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:8085";

const WS_BASE = API_BASE.replace(/^http/, "ws");

export type Mode = "solo" | "duel";

export type Lifeline = "fifty_fifty" | "audience" | "switch";

export type PlayerStatus = "active" | "fallen" | "walked" | "won";

export type RunEndStatus = Exclude<PlayerStatus, "active">;

/**
 * UPDATED SPEC §2 — "Question payload shape (uniform across all events)": every
 * question-bearing event carries `{level, text, options}` plus a separate
 * `ends_at`, so clients never infer the level. Applies to `game_started`,
 * `question_next`, `opponent_reveal`, and `room_state`'s question field.
 */
export interface QuestionPayload {
  /** Level 1–15 of the run. */
  level: number;
  text: string;
  options: string[];
}

/**
 * Final standings entry (SPEC §2 `game_over`) — exactly four fields. This is
 * the DELIBERATE backend M4 shape (distinct from `PlayerPublic`: no
 * `level_reached`, no `lifelines_left`), verified in
 * millionaire/internal/service/game.go. If the backend later adds
 * `level_reached` back, extend this type + the SOLO fallback in
 * Results.tsx together — coordinate via SPEC discussion, do not assume.
 */
export interface StandingsEntry {
  seat: number;
  name: string;
  status: PlayerStatus;
  amount: number;
}

/**
 * Public view of a player — SPEC §2 room_state `players[]`, aligned to what
 * the backend ACTUALLY sends (millionaire internal/handler/room.go
 * `publicPlayerView`): exactly seat/name/status/amount/level_reached. NO
 * `lifelines_left` (the M3-era api.ts claim that the public view carries it
 * was stale — lifelines are never in the self-view snapshot; the own
 * used-flags rehydration rides `removed_indices` presence instead, see App).
 */
export interface PlayerPublic {
  seat: number;
  name: string;
  status: PlayerStatus;
  amount: number;
  level_reached: number;
}

/**
 * Presentation currency (SPEC v1.1 decision log: £ everywhere in the UI;
 * DB amounts stay plain integers). Single shared formatter — ladder values,
 * podium stakes, run-end screens, results standings and activity-log lines
 * all render amounts through this, so the currency never diverges.
 * Defensive against off-SPEC non-finite amounts (renders £0, never NaN).
 */
export const GBP = (amount: number): string =>
  `£${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US")}`;

/**
 * Lifeline result data (SPEC §2 `lifeline_used`): polymorphic per lifeline —
 * 50:50 carries the two removed option indices, audience a 4-percentage
 * array. SPEC field names exact (snake_case); the shapes are discriminated by
 * their (disjoint) keys.
 *
 * WAVE 5 (per-seat SWAP, SPEC §1 "SWAP rules"): the room-wide `lifeline_used`
 * for a swap now carries an EMPTY object — the replacement question is
 * PER-SEAT and rides the private `question_swapped` event, so a peer can only
 * ever learn THAT a lifeline was used, never what was swapped in. This is the
 * anti-leak invariant; do not "restore" the `{question}` member on this
 * broadcast (it is still `{}` on the wire).
 */
export type LifelineResultData =
  | { removed_indices: number[] }
  | { percentages: number[] }
  | EmptyLifelineData;

/**
 * The SWAP broadcast's `data` (`{}`, SPEC §2 `lifeline_used` wave-5). Typed as
 * a never-valued index signature so `{}` type-checks while `"removed_indices"
 * in d` / `"percentages" in d` still narrow away the member.
 */
export interface EmptyLifelineData {
  readonly [key: string]: never;
}

/**
 * Wave-4B (SPEC §2 `room_state`): ONE per-room SESSION totals row per seat —
 * the accumulated census of every completed run in this room, PERSISTED across
 * rematches (never reset until the room row dies). Public facts only.
 *
 * `room_state` OMITS the `totals` KEY ENTIRELY for a history-less room (it is
 * not an empty array) — see `WsMessage.room_state.totals`, and the FE consumer
 * contract: keep the last-known block through `rematch_ready` (no fresher
 * snapshot is broadcast at replay time).
 */
export interface RoomTotal {
  /** Seat the block belongs to (1 | 2). */
  seat: number;
  /** Completed runs in this room session (never reset by a rematch). */
  games_played: number;
  /** Runs that ended `won`. */
  games_won: number;
  /** Sum of every run's banked amount (walk/fall bank, a win's final amount). */
  total_money: number;
  /** Highest `level_reached` ever reached on this seat here (0 = never left L1). */
  best_level: number;
  /** Highest single-run amount ever banked on this seat here. */
  best_amount: number;
}

/** SPEC §1 — the 15 ladder amounts (index 0 = level 1). */
export const LADDER_AMOUNTS: number[] = [
  100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000,
  125_000, 250_000, 500_000, 1_000_000,
];

/** Amount secured at a given reached level (1-based; 0 → $0). */
export const amountAt = (level: number): number =>
  level >= 1 && level <= LADDER_AMOUNTS.length ? LADDER_AMOUNTS[level - 1] : 0;

/**
 * Amount-based inverse of the ladder for the SOLO results line.
 * Strict standings (SPEC §2 `game_over`) carry NO `level_reached`, so the
 * level a solo run reached can only be DERIVED from the final amount — never
 * invented. This helper is STATUS-BLIND: it maps an on-ladder amount onto its
 * 1-based level and returns null for anything off-ladder. Ambiguity is a
 * FALLEN-status concern ONLY: a fallen amount is a safe-haven value ($0 for
 * levels 1–4, $1,000 shared by levels 6–10, …) and could have been banked at
 * any level in its span, so CALLERS must NOT call this for a fallen run —
 * gate on status and render no level line (see Results.tsx). Won/walked
 * amounts remain derivable: they map uniquely onto the ladder (a walked run
 * at level 0 → $0 → off-ladder → null). Callers must render nothing (not
 * "Reached level 0") when this returns null.
 */
export const levelFromAmount = (amount: number): number | null => {
  if (!Number.isFinite(amount)) return null;
  const idx = LADDER_AMOUNTS.indexOf(amount);
  return idx >= 0 ? idx + 1 : null;
};

/**
 * Mirrors the SPEC §2 event table EXACTLY — every event and field, no invented events.
 * Flat JSON with a top-level `event` field, like Boggle.
 */
export type WsMessage =
  | {
      event: "room_created";
      room_id: string;
      mode: Mode;
      token: string;
      seat: number;
      /**
       * M7 (SPEC v1.1): duel rooms surface a short human-friendly code
       * (WORD-WORD-DD, e.g. BLUE-TIGER-73) for joins; the uuid stays the
       * internal PK. Solo rooms carry no code (absent/empty). Optional
       * until backend M7 lands — the FE renders the code only when present.
       */
      code?: string;
    }
  | {
      event: "room_state";
      room_id: string;
      mode: Mode;
      token: string;
      seat: number;
      players: PlayerPublic[];
      /** Uniform question payload (carries `level`) when a question is active. */
      question?: QuestionPayload;
      ends_at?: string;
      /**
       * M6 (SPEC §2 room_state row): THIS joiner's own fifty_fifty removals
       * for the active question — absent when no 50:50 is live. Consumed on
       * rejoin so a mid-run reload restores the struck options.
       */
      removed_indices?: number[];
      /**
       * M7 (SPEC v1.1): the room's short code echoed on EVERY room_state —
       * including joins and token rejoins — so the client can persist the
       * code-keyed rejoin record. Solo rooms echo '' (never surfaced).
       */
      code?: string;
      /**
       * Wave-4B (SPEC §2): the room's per-seat SESSION totals, present ONLY
       * when the room has any completed-run history — the key is ABSENT (not
       * an empty array) for a fresh room. A seat that has never finished a
       * run simply has NO row (the array is sparse), so consumers must render
       * per-row, never per-seat.
       *
       * Freshness (documented, do not fight it): the block is read on JOIN and
       * is NOT re-broadcast at `game_over`/`rematch_ready`. The FE keeps the
       * last-known block through a rematch; a rejoin refreshes it.
       */
      totals?: RoomTotal[];
    }
  | { event: "player_joined"; name: string; seat: number }
  | { event: "game_started"; question: QuestionPayload; ends_at: string }
  | { event: "question_next"; question: QuestionPayload; ends_at: string }
  | {
      event: "answer_result";
      correct: boolean;
      correct_index: number;
      amount: number;
      status: PlayerStatus;
    }
  | {
      event: "opponent_reveal";
      question: QuestionPayload;
      chosen_index: number;
      correct_index: number;
    }
  | {
      event: "lifeline_used";
      seat: number;
      lifeline: Lifeline;
      data: LifelineResultData;
    }
  | {
      /**
       * WAVE 5 (SPEC §2, per-seat swap): the SWAP's replacement question,
       * delivered to THE SWAPPING SEAT'S SOCKET ONLY (`SendToSeat`) — never
       * the peer, never a room broadcast. `seat` is always the receiving
       * socket's own seat; the client applies it ONLY when it matches its own
       * seat (defence in depth against an off-contract frame).
       *
       * NO `correct_index` ever rides here (SPEC invariant: no leak).
       */
      event: "question_swapped";
      seat: number;
      /** The level the swap ran at — a swap NEVER changes the level. */
      level: number;
      question: QuestionPayload;
      /** The CURRENT level's deadline echoed UNCHANGED — a swap is not a free
       *  re-read, the in-flight timer is never reset. */
      ends_at: string;
    }
  | {
      event: "run_ended";
      seat: number;
      status: RunEndStatus;
      amount: number;
      /**
       * Wave 4 (SPEC §2 run_ended row): the correct index MAY ride along when
       * `status` = `fallen` — the run is over, so the FE may show the missed
       * question (e.g. a TIMEOUT fall's journey entry — nothing was picked).
       * Never present on walked/won. Optional: tolerate backends that omit it.
       */
      correct_index?: number;
    }
  | {
      event: "rematch_ready";
      /** The replayed room's seats, ascending (SPEC §2 wave 4). */
      seats: number[];
    }
  | {
      event: "opponent_progress";
      seat: number;
      /** The SURVIVOR's level in play (SPEC §2 wave 4 — public facts only). */
      level: number;
      /** Their persisted (banked) amount — NEVER carries correct_index or
       *  any private data (SPEC invariant 1); this event reaches the LAPSED
       *  seat(s) only — the survivor's own socket never receives it. */
      amount: number;
      status: PlayerStatus;
    }
  | {
      event: "game_over";
      standings: StandingsEntry[];
      /**
       * Wave 6: the room's per-seat SESSION census AS OF this game_over — the
       * rows `room_totals` just accumulated, in the same six public fields
       * `room_state.totals` carries. Present whenever the room has any
       * history; absent only if the census read failed (the client then keeps
       * whatever it last knew — it never invents zeros).
       */
      totals?: RoomTotal[];
    }
  | { event: "error"; message: string };
// Note: `ping` is client → server only (SPEC §2), so it is deliberately absent
// from this inbound union. The keepalive send lives in App.tsx.

const post = async (path: string, body: unknown): Promise<void> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
};

/** Like `post`, but for endpoints whose REST body carries state the FE acts
 *  on (the wave-4 replay response). The WS broadcast stays the trust source;
 *  the body is a tolerant mirror (same contract as start/replay, SPEC §2). */
const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
  return (await res.json()) as T;
};

/** SPEC §2 — `POST /api/millionaire/rooms/:code/answer` `{token, level, choice_index}` */
export const answer = (
  roomId: string,
  token: string,
  level: number,
  choiceIndex: number,
): Promise<void> =>
  post(`/api/millionaire/rooms/${roomId}/answer`, {
    token,
    level,
    choice_index: choiceIndex,
  });

/** SPEC §2 — `POST /api/millionaire/rooms/:code/walk` `{token}` */
export const walk = (roomId: string, token: string): Promise<void> =>
  post(`/api/millionaire/rooms/${roomId}/walk`, { token });

/** SPEC §2 — `POST /api/millionaire/rooms/:code/lifeline` `{token, lifeline}` */
export const useLifeline = (
  roomId: string,
  token: string,
  lifeline: Lifeline,
): Promise<void> => post(`/api/millionaire/rooms/${roomId}/lifeline`, { token, lifeline });

/**
 * SPEC v1.1 (backend M7, §2 continue): hold-until-continue solo pacing — the
 * client POSTs after the reveal beat and the server deals the next question
 * (or the game-over transition) in response.
 *
 * M7 resolution: backend M7 `resolveRoomPath` is code-first with a uuid
 * fallback (mode-agnostic), so posting the internal uuid for solo continue is
 * contract-backed (SPEC §2).
 */
export const continueRun = (roomId: string, token: string): Promise<void> =>
  post(`/api/millionaire/rooms/${roomId}/continue`, { token });

/**
 * Wave-4 REST response of `POST /api/millionaire/rooms/:code/replay` (SPEC §2): the
 * tolerant mirror of what the WS already broadcast(s). `replayed:false` +
 * `started:false` = the concurrent double-replay no-op; a DUEL replay ends
 * with `started:false` (the room waits in the lobby for the host's start —
 * `rematch_ready` arrives first); a SOLO replay re-issues Q1 instantly
 * (`started:true`, and a `game_started` broadcast drives the transition).
 * The mirrored `question`/`ends_at` are NOT trusted for rendering — the
 * `game_started` WS event is.
 */
export interface ReplayResponse {
  replayed: boolean;
  started: boolean;
  question?: QuestionPayload;
  ends_at?: string;
}

/**
 * Wave-4 (SPEC §2 REST): `POST /api/millionaire/rooms/:code/start` `{token}` — DEFERRED
 * DUEL START. The HOST (seat 1) flips a waiting lobby to a live game; the
 * `game_started` WS broadcast (both seats) is the trust source. Backend
 * enforcements the FE never has to pre-check: non-host → 403 (+ an error
 * event to that seat), incomplete duel/solo/finished → 409, an
 * already-running duel → 200 `{"started":false}` idempotent no-op.
 * `resolveRoomPath` is code-first with a uuid fallback, so the internal
 * uuid the FE holds resolves the same way (M7).
 */
export const startDuel = (roomId: string, token: string): Promise<void> =>
  post(`/api/millionaire/rooms/${roomId}/start`, { token });

/**
 * Wave-4 (SPEC §2 REST): `POST /api/millionaire/rooms/:code/replay` `{token}` — IN-ROOM
 * REMATCH. A lapsed seat resets the SAME room (no new room, no new code) for
 * a fresh run: every player row resets, room_questions re-selects, and a
 * `rematch_ready {seats}` broadcast tells the clients to fall back to the
 * lobby (duel) / re-issues Q1 instantly (solo). Mid-run seats → 409.
 */
export const replayRun = (
  roomId: string,
  token: string,
): Promise<ReplayResponse> =>
  postJson<ReplayResponse>(`/api/millionaire/rooms/${roomId}/replay`, { token });

/** Duel room-code shape (SPEC v1.1): UPPERCASE WORD-WORD-DD (BLUE-TIGER-73). */
export const ROOM_CODE_RE = /^[A-Za-z]+-[A-Za-z]+-\d{2}$/;
/** A join input may also still be the internal uuid (pre-code rooms). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-side join-input validation: WORD-WORD-DD code or legacy uuid. */
export const isValidJoinId = (input: string): boolean =>
  ROOM_CODE_RE.test(input.trim()) || UUID_RE.test(input.trim());

/** Connection options for the WS join/create URLs (SPEC §2 join contract). */
export interface WsConnectOpts {
  roomId?: string;
  mode?: Mode;
  name?: string;
  /** Persisted player token — join only, rejoins that player's seat. */
  token?: string;
}

/** SPEC §2:
 *  - create: `GET /ws/rooms?mode=<mode>&name=<name>`
 *  - join:   `GET /ws/rooms/:id?name=<name>` (+ `token=<uuid>` to rejoin the
 *    same seat; a token only makes sense for a known room, so it is never
 *    sent on the create path). */
export const getWsUrl = ({
  roomId,
  mode,
  name,
  token,
}: WsConnectOpts): string => {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  if (name) params.set("name", name);
  if (roomId && token) params.set("token", token);
  const qs = params.toString();
  if (roomId) return `${WS_BASE}/ws/millionaire/rooms/${roomId}${qs ? `?${qs}` : ""}`;
  return `${WS_BASE}/ws/millionaire/rooms${qs ? `?${qs}` : ""}`;
};
