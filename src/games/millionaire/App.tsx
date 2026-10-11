import { useCallback, useEffect, useRef, useState } from "react";
import {
  amountAt,
  answer,
  continueRun,
  getWsUrl,
  isValidJoinId,
  levelFromAmount,
  LADDER_AMOUNTS,
  replayRun,
  // NOTE: `useLifeline` is the M1 REST helper (api.ts), not a React hook —
  // aliased here because the react-hooks rules-of-hooks rule keys off the
  // `use` prefix for any called function starting with it.
  // eslint note: the alias is deliberate, NOT a suppression.
  useLifeline as sendLifeline,
  startDuel,
  walk,
  GBP,
  type Lifeline,
  type Mode,
  type PlayerStatus,
  type QuestionPayload,
  type RoomTotal,
  type RunEndStatus,
  type StandingsEntry,
  type WsConnectOpts,
  type WsMessage,
} from "./api";
import { MoneyLadder } from "./components/MoneyLadder";
import { RevealTree } from "./components/RevealTree";
import { QuestionCard, type QuestionReveal } from "./components/QuestionCard";
import { AudienceChart, Lifelines } from "./components/Lifelines";
import { OpponentPanel, type RivalReveal } from "./components/OpponentPanel";
import { Results } from "./components/Results";
import { SpectateView } from "./components/SpectateView";
import type { JourneyStep } from "./components/JourneyRecap";
import { SessionTotals } from "./components/SessionTotals";
import { Timer } from "./components/Timer";

type ConnState = "idle" | "connecting" | "open" | "closed";

/** Current question as seen by this client (SPEC §2 events). */
interface QuestionView {
  level: number;
  text: string;
  options: string[];
  endsAt: string;
}

interface LadderState {
  currentLevel: number;
  levelReached: number;
  status: PlayerStatus;
}

/**
 * M4: the OTHER seat's known state, assembled from what the SPEC events
 * actually carry (room_state public snapshot, player_joined, run_ended,
 * opponent_reveal). Mid-run the SPEC broadcasts nothing about the rival's
 * correct answers — their lit rungs come from the snapshot/end events only,
 * so the panel shows their CURRENT question level (shared list) while active.
 */
interface OpponentState {
  seat: number;
  name: string;
  status: PlayerStatus;
  amount: number;
  levelReached: number;
}

const BLANK_LADDER: LadderState = {
  currentLevel: 0,
  levelReached: 0,
  status: "active",
};

/**
 * UX v3 wave 5a — one journey STEP per level this seat RESOLVED, recorded by
 * the event machine (the picked + correct letters arrive in `answer_result`;
 * a TIMEOUT fall records from `run_ended`'s optional `correct_index` with
 * `pickedIndex` −1). Rendered by JourneyRecap on the results screens AND on
 * the spectate view. AFTER-the-fact letters are allowed: the level is
 * resolved by the time an entry exists (SPEC invariant 1 untouched — live
 * questions never leak).
 */

/** SPEC §1 timer budgets: 1–5 = 30s, 6–10 = 20s, 11–15 = 15s. */
const budgetSeconds = (level: number): number =>
  level <= 5 ? 30 : level <= 10 ? 20 : 15;

const optionLabel = (index: number): string =>
  String.fromCharCode(65 + Math.max(0, Math.min(3, index)));

/**
 * UX v3 wave 3 hold-until-continue beat (solo): the CONTINUE affordance —
 * now a plain fade-in ON the reveal overlay (wave 2's ring/skip is gone) —
 * appears this long after `answer_result`/`run_ended`, and its click still
 * POSTs the M7 continue endpoint. Duel auto-advance stays server-timed.
 */
const SOLO_BEAT_MS = 1000;

/**
 * UX v3 wave 3: the FALL choreography's DUEL auto-close beat — duels never
 * hold (the run-end interim transitions in per `run_ended`'s own pacing).
 * SOLO now HOLDS the fall overlay until its faded-in "Continue · see
 * results" is clicked (the interim stays gated behind it — hold semantics).
 */
const FALL_BEAT_MS = 2400;

/** UX v3 wave 2: the highest SAFE-haven rung at or below `reached` (0 =
 *  none banked) — the fall caption's "(SAFE Y)" fact. Safe havens are
 *  rungs 5 and 10 (SPEC §1); rung 15 is the win, not a fall's rest. */
const lastSafeLevel = (reached: number): number =>
  reached >= 10 ? 10 : reached >= 5 ? 5 : 0;

const RUN_END_COPY: Record<
  RunEndStatus,
  { title: string; cls: string; hint: string }
> = {
  fallen: {
    title: "You fell",
    cls: "text-rose-400",
    hint: "The correct answer will flash briefly — then the results.",
  },
  walked: {
    title: "You walked away",
    cls: "text-sky-300",
    hint: "Winnings locked in — results appear when the game ends.",
  },
  won: {
    title: "You win!",
    cls: "text-gold-300",
    hint: "All 15 levels answered — results appear when the game ends.",
  },
};

/** Defensive default (M2 review): neutral styling + copy for any off-SPEC
 *  `run_ended` status string the backend might send. */
const RUN_END_FALLBACK = {
  title: "Run ended",
  cls: "text-slate-300",
  hint: "Results appear when the game ends.",
} as const;

/** Narrow an (unknown-runtime) status string to the SPEC run-end statuses. */
const asRunEndStatus = (status: string): status is RunEndStatus =>
  status === "fallen" || status === "walked" || status === "won";

/**
 * M5 rejoin-contract fix (backend M7 cross-repo): the persisted refresh-rejoin
 * record. The OLD shape was loose keys (`roomId` + `token`, internal uuid
 * only) which rejoined via `GET /ws/rooms/<uuid>` — strictly rejected by M7
 * (code-keyed joins), so a mid-game refresh could never reconnect. The new
 * record carries the CODE (duels) + mode so:
 *  - duel refresh → deliberate pre-join screen rejoining by code (+token);
 *  - solo refresh → restart-by-design (there is NO WS-join path for solo —
 *    the uuid is REST-only per M7; we never fabricate one).
 */
interface SessionRecord {
  roomId: string;
  token: string;
  /** Duel code (WORD-WORD-DD) — '' for solo rooms / pre-M7 records. */
  code: string;
  mode: Mode;
}

const SESSION_KEY = "session";

/**
 * Read (and MIGRATE) the persisted session. Legacy shape: `roomId`/`token`
 * keys with no `session` record — no code and no mode survive, so there is
 * no joinable contract left (M7 rejects uuid WS joins; a legacy record
 * cannot even prove it was a duel). Cleanest migration: treat it as the
 * SOLO-restart semantics — wipe to the title screen and start nothing.
 */
const readPersistedSession = (): SessionRecord | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw !== null) {
    try {
      const rec = JSON.parse(raw) as Partial<SessionRecord> | null;
      if (
        rec &&
        typeof rec.roomId === "string" &&
        typeof rec.token === "string" &&
        (rec.mode === "solo" || rec.mode === "duel")
      ) {
        return {
          roomId: rec.roomId,
          token: rec.token,
          code: typeof rec.code === "string" ? rec.code : "",
          mode: rec.mode,
        };
      }
      // Malformed record — same wipe-to-title fate as the legacy shape.
    } catch {
      // Unparsable JSON — fall through to the wipe.
    }
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  // Legacy migration: stale separate keys with no code+mode → wipe them and
  // return null (solo-restart semantics; a comment-level note, no UI toast —
  // this shape predates the M7 contract and must not resurrect a join).
  if (localStorage.getItem("roomId") !== null) {
    localStorage.removeItem("roomId");
    localStorage.removeItem("token");
  }
  return null;
};

const clearPersistedSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
  // Legacy keys are cleared too — belt-and-braces for pre-migration records
  // that somehow reappear between loads.
  localStorage.removeItem("roomId");
  localStorage.removeItem("token");
};

function App() {
  const [name, setName] = useState<string>(
    () => localStorage.getItem("name") || "",
  );
  const [mode, setMode] = useState<Mode>("solo");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  /**
   * M5 rejoin-contract fix: the once-per-mount persisted record (reads +
   * MIGRATES localStorage exactly once; StrictMode-safe — the read is
   * idempotent after its own wipe). A persisted DUEL record NEVER
   * auto-joins: it is deliberately confirmed (the pre-join screen below) —
   * a silent automatic join could take over another seat/account without
   * the player noticing.
   */
  const [initSession] = useState<SessionRecord | null>(() =>
    readPersistedSession(),
  );
  /** Duel refresh → the pre-join screen ("Rejoin by code"), not a live room. */
  const [rejoin, setRejoin] = useState<SessionRecord | null>(() =>
    initSession && initSession.mode === "duel" ? initSession : null,
  );
  /** Editable code field on the pre-join screen (prefilled from the record). */
  const [rejoinCode, setRejoinCode] = useState<string>(
    initSession && initSession.mode === "duel" ? initSession.code : "",
  );
  /** Solo refresh → title + the one-line restart note (never a red banner).
   *  Seeded from the persisted record in the initializer (solo mode) — not
   *  from an effect — so the note is present from the very first paint. */
  const [soloRestartNote, setSoloRestartNote] = useState(
    () => initSession?.mode === "solo",
  );
  const [seat, setSeat] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [conn, setConn] = useState<ConnState>("idle");
  const [joinInput, setJoinInput] = useState("");
  /**
   * UX v3 wave 5a: the activity-log RENDER is gone for good — the wave-1
   * "Show recap" line's last occupant (the results recap) is replaced by the
   * JOURNEY chips (JourneyRecap), and "no logs" was already the approved vitals
   * ban. The event machine's `addLog` beats stay verbatim (guard-adjacent
   * call sites untouched); the record now lives in a ref (never rendered)
   * instead of state so no stale array re-renders anything.
   */
  const logsRef = useRef<string[]>([]);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  /** Why the socket closed: server-side close (SPEC rejection path), network
   *  failure (browser-generated 1006), or nothing yet / voluntary leave.
   *  UX v3: the close KIND is keyed directly off the close code inside the
   *  onclose handler — the copy routes straight into the single error
   *  banner. The old `closeKind` STATE was chrome-only bookkeeping (it
   *  drove the removed status/banner variants) and is gone; no guard or
   *  event-machine behavior referenced it.
   */

  // --- M2 game state (event-driven, SPEC §2) -------------------------------
  const [question, setQuestion] = useState<QuestionView | null>(null);
  /** Index clicked — locks the card until answer_result arrives. */
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [reveal, setReveal] = useState<QuestionReveal | null>(null);
  /** 50:50 removed indices (M3: own-seat `lifeline_used` broadcast; M6: also
   *  rehydrated from the room_state self-view `removed_indices`). */
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);
  /** M3 lifelines: per-run one-use flags for THIS seat + optimistic pending
   *  lifeline (spinner until the `lifeline_used` broadcast arrives). */
  const [lifelinesUsed, setLifelinesUsed] = useState<
    Record<Lifeline, boolean>
  >({ fifty_fifty: false, audience: false, switch: false });
  const [pendingLifeline, setPendingLifeline] = useState<Lifeline | null>(null);
  /**
   * WAVE 5 — the lifeline whose POST the server REFUSED. Every swap refusal
   * is a 409 REST error *and* an `error` WS frame carrying the precise reason
   * ("already resolved the current level", "the question has already
   * expired", …). The WS frame is the message worth showing, so it parks the
   * lifeline here and the REST `.catch` consumes the flag instead of
   * double-bannering with its generic "request failed" copy. Cleared on
   * every disconnect/reset so it can never leak into a later POST.
   */
  const lifelineRefusalRef = useRef<Lifeline | null>(null);
  /** Audience poll percentages while the chart is up (auto-dismissed). */
  const [audience, setAudience] = useState<number[] | null>(null);
  const [ladder, setLadder] = useState<LadderState>(BLANK_LADDER);
  /** status stays a plain string so off-SPEC values render the neutral
   *  RUN_END_FALLBACK instead of crashing (M2 review finding 6). */
  const [runEnd, setRunEnd] = useState<{
    status: string;
    amount: number;
  } | null>(null);
  const [standings, setStandings] = useState<StandingsEntry[] | null>(null);
  /**
   * UX v3 wave 5a: the run's per-level JOURNEY (JourneyStep[]) — one entry
   * per level this seat resolved. Recorded in `answer_result` (picked vs
   * correct, both arrive there) and in `run_ended` for a TIMEOUT fall
   * (nothing was picked; the optional run_ended `correct_index` feeds it).
   * Rendered by JourneyRecap on the results and spectate screens. Cleared
   * with the game context (resetGame).
   */
  const [journey, setJourney] = useState<JourneyStep[]>([]);
  /** M4: the other duel seat's known state (null in solo / before they join). */
  const [opponent, setOpponent] = useState<OpponentState | null>(null);
  /** M4: the `opponent_reveal` payload — lifted from M2's `revealPayloadRef`
   *  now that something renders it. Its DISPLAY is hard-gated (see
   *  `gatedRivalReveal`): never while the local player may still be
   *  resolving that level (M2 review note 1). */
  const [rivalReveal, setRivalReveal] = useState<RivalReveal | null>(null);
  /**
   * UX v3: the ONE banner (single position above the plate, severity-
   * colored, auto-dismiss 6s). Connection failures, server `error` events
   * and failed REST actions all route here — no status chips, no
   * "NOT CONNECTED" chrome anywhere.
   */
  const [errorBanner, setErrorBanner] = useState<{
    msg: string;
    severity: "danger" | "warning";
  } | null>(null);
  /** UX v3: the rival bottom-sheet (duel) starts closed. */
  const [rivalSheetOpen, setRivalSheetOpen] = useState(false);
  /** UX v3: an invalid JOIN submit shakes the code field (error motion). */
  const [joinShaking, setJoinShaking] = useState(false);
  const [confirmWalk, setConfirmWalk] = useState(false);
  /**
   * UX v3 wave 5b — DEFERRED DUEL START (SPEC §2 wave-4 REST): the host's
   * lobby START button state. The button renders only when BOTH seats are
   * in the lobby (the backend answers 409 on a half-full room); the ref is
   * the same-frame double-click guard (M2 pattern).
   */
  const [startPending, setStartPending] = useState(false);
  const startInFlightRef = useRef(false);
  /**
   * UX v3 wave 5b — IN-ROOM REMATCH (SPEC §2 wave-4 REST): the results
   * screen's PLAY AGAIN POSTs `replay` against the SAME room. The pending
   * flag disables the button (label → "Restarting…") until the room moves
   * (`rematch_ready` → duel lobby / `game_started` → solo Q1); the ref
   * guards the POST once per render (no double-press double-POST).
   */
  const [replayPending, setReplayPending] = useState(false);
  const replayInFlightRef = useRef(false);
  /** M7 (SPEC v1.1): the duel room's short code surfaced for joins (rendered
   *  when present — optional until backend M7 lands). */
  const [roomCode, setRoomCode] = useState<string | null>(null);
  /**
   * WAVE 6 / wave-4B (SPEC §2 `room_state`): the room's per-seat SESSION
   * totals, kept VERBATIM as the server sent them (public facts only). The
   * key is ABSENT for a history-less room, which is `null` here — the
   * rematch/lobby card renders nothing at all in that case.
   *
   * Sparse by design: a seat that has never completed a run has NO row, so
   * the array is rendered row-by-row and never indexed by seat number.
   *
   * Freshness (documented contract, not a bug): the block is read on JOIN.
   * `game_over`/`rematch_ready` broadcast NO fresher snapshot, so the card
   * shows the last-known block; a rejoin refreshes it. It is deliberately
   * NOT cleared by `resetGame` — a rematch keeps the session's history
   * visible on the waiting lobby.
   */
  const [roomTotals, setRoomTotals] = useState<RoomTotal[] | null>(null);
  /** M5 hold-until-continue (SOLO only): true once the ~1s beat after
   *  `answer_result`(correct, run continues) / `run_ended` has passed — the
   *  CONTINUE affordance fades in and holds the reveal until clicked. Duels
   *  NEVER arm it (auto-advance is server-scheduled). Wave 3: the overlay
   *  shows it as a plain fade-in (the ring/countdown state is gone). */
  const [continueArmed, setContinueArmed] = useState(false);
  /**
   * UX v3 wave 2 — the money-tree reveal overlay (docs/plan/v3-ux-plan.md,
   * "Answer lifecycle"). PURE PRESENTATION state derived from the existing
   * event machine (see `revealTreeView` below); no event semantics change,
   * so all approved guards stay verbatim.
   */
  /** The FALL choreography phase: "playing" while the tree slide-down/
   *  shatter/caption beat runs; null when the existing run-end interim
   *  (which stays gated behind it) transitions in. A WALK never plays it
   *  (spec: the walk keeps the confirm → results flow). */
  const [fallOverlay, setFallOverlay] = useState<"playing" | null>(null);
  /** Wave 3c: the fall's level/amount/safe facts snapshotted when the fall
   *  starts (see `startFallOverlay`) — the overlay renders from THESE, not
   *  from the live question, which `game_over` clears mid-beat. */
  const [fallFacts, setFallFacts] = useState<{
    level: number;
    amount: number;
    safeLevel: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  /** Bumped on every close/replace; events from older sockets are ignored. */
  const genRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  /** UX v3: shake retrigger timer (invalid join submit). */
  const shakeTimerRef = useRef<number | null>(null);
  /** Refs mirroring seat/question level/game-over/mode for the STABLE
   *  handleEvent: answer_result carries no level or mode, and handleEvent
   *  must stay identity-stable (M1 lint fix keeps connect() out of the mount
   *  effect). */
  const seatRef = useRef<number | null>(null);
  const questionLevelRef = useRef(0);
  const gameOverRef = useRef(false);
  /** Stable mode mirror for handleEvent (continue-arm decisions). */
  const modeRef = useRef<Mode>("solo");
  /** M5 hold-until-continue beat timer (solo). */
  const continueTimerRef = useRef<number | null>(null);
  /** UX v3 wave 2: the fall-overlay hold timer (shatter → results beat). */
  const fallTimerRef = useRef<number | null>(null);
  /** UX v3 wave 2: synchronous mirror of `fallOverlay` — the run_ended
   *  timeout-fall trigger must know whether a wrong-answer reveal already
   *  started the choreography (same-frame rationale as chosenIndexRef). */
  const fallPlayingRef = useRef(false);
  /** Same-frame double-click guard (M2 review finding 7): mirrors the locked
   *  index synchronously so a second click before React re-renders cannot
   *  fire a second POST. Cleared on question change, disconnect, and reset. */
  const chosenIndexRef = useRef<number | null>(null);
  /** Same-frame guard for lifeline clicks (M3): mirrors `pendingLifeline`
   *  synchronously — a double click fires exactly one POST. */
  const pendingLifelineRef = useRef<Lifeline | null>(null);
  /** Auto-dismiss timer for the audience chart (~8s, M3). */
  const audienceTimerRef = useRef<number | null>(null);
  /** M3 fix [med]: the level of the question the in-flight answer POST was
   *  made against, stamped at POST time from the CURRENT question. null
   *  while no answer POST is pending. Lets `answer_result` recognize a lock
   *  that the run has moved past (level advanced). Switch-in-place keeps
   *  the level, so a same-level supersede is tracked by the flag below. */
  const lockedQuestionLevelRef = useRef<number | null>(null);
  /** M3 fix [med]: true when a switch-in-place replaced the question WHILE
   *  the own answer POST was in flight — the pending `answer_result`'s
   *  correct_index refers to the REPLACED question's options and must
   *  never color the swapped card. */
  const swapSupersededRef = useRef(false);
  /** M3 fix [low]: the question level captured when the lifeline POST
   *  fired — own 50:50 removals / audience polls apply only while the
   *  level is unchanged (an applied switch invalidates it → stale). */
  const lifelineQuestionLevelRef = useRef<number | null>(null);
  /** UX v3 wave 5a: the count of OWN lifelines spent on the CURRENT level —
   *  the journey step's "lifelines used at that level" fact. Reset on every
   *  question advance (question_next / game start / reset). */
  const levelLifelinesRef = useRef(0);
  /** UX v3 wave 3b: the question FACT it mirrors (`{level, text, options}`),
   *  updated wherever `setQuestion` lands. A TIMEOUT fall's journey step
   *  reads it (that fall has no answer POST to capture from). */
  const heldQuestionRef = useRef<QuestionPayload | null>(null);
  /** UX v3 wave 3b: the question fact stamped at ANSWER-POST time — a
   *  switch-in-place may replace the question before `answer_result`
   *  arrives, so the journey's `pickedText` must come from the options the
   *  POST was made against, not the current display. Validated by level. */
  const answeredQuestionRef = useRef<QuestionPayload | null>(null);

  const addLog = useCallback((msg: string) => {
    logsRef.current = [msg, ...logsRef.current].slice(0, 8);
  }, []);

  const showError = useCallback(
    (msg: string, severity: "danger" | "warning" = "danger") => {
      setErrorBanner({ msg, severity });
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      // UX v3: auto-dismiss after 6s (spec).
      errorTimerRef.current = window.setTimeout(
        () => setErrorBanner(null),
        6000,
      );
    },
    [],
  );

  /** M5: tear down the hold-until-continue beat (question advanced, game
   *  over, reset, or disconnect). */
  const clearContinueBeat = useCallback(() => {
    if (continueTimerRef.current) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
    }
    setContinueArmed(false);
  }, []);

  /** M5: SOLO ONLY — start the ~1s reveal hold (wave 3: the CONTINUE
   *  affordance fades in ON the overlay at 1s; the click POSTs the M7
   *  continue endpoint). Duels auto-advance server-side. */
  const scheduleContinueBeat = useCallback(() => {
    if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
    setContinueArmed(false);
    continueTimerRef.current = window.setTimeout(() => {
      continueTimerRef.current = null;
      setContinueArmed(true);
    }, SOLO_BEAT_MS);
  }, []);

  /** UX v3 wave 2: play the FALL tree choreography (wrong answer / timeout
   *  fall): slide-down + target-rung shatter + fallen caption. Wave 3: a
   *  SOLO fall HOLDS the overlay until its faded-in "Continue · see
   *  results" is clicked (handleFallContinue → the gated run-end interim);
   *  a DUEL auto-closes after FALL_BEAT_MS (run_ended pacing — the interim
   *  then transitions in via its existing anim-fade-in). Idempotent within
   *  one fall (the wrong-reveal start precedes the run_ended). */
  const startFallOverlay = useCallback(() => {
    if (fallPlayingRef.current) return;
    fallPlayingRef.current = true;
    // Wave 3c fix: SNAPSHOT the fall's facts at fall-start. `fallTree` used to
    // read the LIVE question, which `game_over` clears within milliseconds of
    // the fall — so on every real fall the overlay mounted for ONE frame and
    // unmounted (the audit saw exactly that: 1 sampled frame, no red rung, no
    // shatter, straight to results). The fall choreography is a held beat; it
    // must survive the question being torn down underneath it.
    const held = answeredQuestionRef.current ?? heldQuestionRef.current;
    if (held) {
      setFallFacts({
        level: held.level,
        amount: amountAt(held.level),
        safeLevel: lastSafeLevel(held.level - 1),
      });
    }
    setFallOverlay("playing");
    if (modeRef.current !== "solo") {
      if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
      fallTimerRef.current = window.setTimeout(() => {
        fallTimerRef.current = null;
        fallPlayingRef.current = false;
        setFallOverlay(null);
      }, FALL_BEAT_MS);
    }
  }, []);

  /** UX v3 wave 2: close the fall overlay WITHOUT its hold timer — the run
   *  state moved on (question_next broadcast, game over, disconnect, reset). */
  const clearFallOverlay = useCallback(() => {
    // Wave 3c: the fall snapshot dies with the beat (no stale facts into the
    // next run's fall).
    setFallFacts(null);
    if (fallTimerRef.current) {
      clearTimeout(fallTimerRef.current);
      fallTimerRef.current = null;
    }
    fallPlayingRef.current = false;
    setFallOverlay(null);
  }, []);

  /** UX v3 wave 3: the solo fall overlay's faded-in "Continue · see
   *  results" click — close the overlay so the gated run-end interim
   *  transitions in (its own anim-fade-in); the solo hold-until-continue
   *  beat (armed at ~1s) still holds the M7 continue POST there. */
  const handleFallContinue = useCallback(() => {
    clearFallOverlay();
  }, [clearFallOverlay]);

  /** Dismiss the audience chart immediately (question change / switch / reset). */
  const dismissAudience = useCallback(() => {
    if (audienceTimerRef.current) {
      clearTimeout(audienceTimerRef.current);
      audienceTimerRef.current = null;
    }
    setAudience(null);
  }, []);

  /** Show the audience chart for ~8s (M3), then auto-dismiss. */
  const showAudience = useCallback((percentages: number[]) => {
    if (audienceTimerRef.current) clearTimeout(audienceTimerRef.current);
    setAudience(percentages);
    audienceTimerRef.current = window.setTimeout(() => {
      audienceTimerRef.current = null;
      setAudience(null);
    }, 8000);
  }, []);

  /** Clear the optimistic pending-lifeline state (broadcast arrived or the
   *  run state moved on). */
  const clearPendingLifeline = useCallback(() => {
    pendingLifelineRef.current = null;
    setPendingLifeline(null);
  }, []);

  /** Clear all game-scoped state (fresh room / leave). `keepDuelState`
   *  keeps the M4 duel panel state across `game_started` — the rival is
   *  already known from `player_joined`/room_state and `game_started` does
   *  NOT re-carry the players snapshot (SPEC §2). */
  const resetGame = useCallback(
    (keepDuelState = false) => {
      setQuestion(null);
      // UX v3 wave 3b: the held question fact dies with the game context.
      heldQuestionRef.current = null;
      setChosenIndex(null);
      setReveal(null);
      setRemovedOptions([]);
      setLadder(BLANK_LADDER);
      setRunEnd(null);
      setStandings(null);
      // UX v3 wave 5a: the journey lives and dies with the run context.
      setJourney([]);
      setErrorBanner(null);
      setConfirmWalk(false);
      // UX v3 presentation state also dies with the game context.
      setRivalSheetOpen(false);
      setJoinShaking(false);
      setLifelinesUsed({
        fifty_fifty: false,
        audience: false,
        switch: false,
      });
      dismissAudience();
      clearPendingLifeline();
      clearContinueBeat();
      // UX v3 wave 2: the reveal overlay dies with the game context too.
      clearFallOverlay();
      if (!keepDuelState) {
        setOpponent(null);
        setRivalReveal(null);
      }
      questionLevelRef.current = 0;
      gameOverRef.current = false;
      chosenIndexRef.current = null;
      lockedQuestionLevelRef.current = null;
      swapSupersededRef.current = false;
      lifelineQuestionLevelRef.current = null;
      levelLifelinesRef.current = 0;
      // UX v3 wave 5b: the deferred-start / rematch POST guards die with the
      // game context (fresh room, game_started, rematch_ready, leave) — the
      // lobby's START and the results' PLAY AGAIN re-arm.
      startInFlightRef.current = false;
      setStartPending(false);
      lifelineRefusalRef.current = null;
      replayInFlightRef.current = false;
      setReplayPending(false);
    },
    [
      dismissAudience,
      clearPendingLifeline,
      clearContinueBeat,
      clearFallOverlay,
    ],
  );

  /** Shared run-end application (SPEC `run_ended` + the `room_state`
   *  own-status≠active restore path — M2 review finding 3). Tolerant at the
   *  edges: unknown status strings render the RUN_END_FALLBACK copy, missing
   *  amounts render £0. */
  const applyRunEnd = useCallback((status: PlayerStatus, amount: number) => {
    setRunEnd({
      status,
      amount: Number.isFinite(amount) ? amount : 0,
    });
    setLadder((prev) => ({ ...prev, status }));
    // M3: no lifeline can be pending once the run has ended (SPEC §1) —
    // clear the optimistic state if the end raced a pending request.
    clearPendingLifeline();
    // M3 fix: the answer lock / lifeline question identity die with the run.
    lockedQuestionLevelRef.current = null;
    swapSupersededRef.current = false;
    lifelineQuestionLevelRef.current = null;
    lifelineRefusalRef.current = null;
    // NOTE (wave 5a): the per-level lifeline counter is deliberately NOT
    // zeroed here — the `run_ended` timeout-fall journey step still needs
    // it, and the counter is reset per level (question_next) and per run
    // (resetGame / game_started) anyway.
  }, [clearPendingLifeline]);

  /**
   * UX v3 wave 5a: record ONE journey step for a resolved level (replace-
   * by-level inside the updater — a `run_ended` timeout step must never
   * double with an `answer_result` step for the same level). Stable so
   * handleEvent keeps its identity.
   *
   * UX v3 wave 3b: `qFact` carries the question text + options captured
   * AT ANSWER time (the JourneyRecap accordion's expanded detail) — for
   * answer_result paths it is the fact the POST was made against (a
   * switch-in place may have replaced the question since), validated by
   * level in the caller.
   */
  const recordJourneyStep = useCallback(
    (
      level: number,
      pickedIndex: number,
      correct: boolean,
      correctIndex: number,
      amount: number,
      qFact: QuestionPayload | null,
    ) => {
      if (!Number.isFinite(level) || level < 1) return;
      const step: JourneyStep = {
        level,
        pickedIndex,
        correct,
        correctIndex,
        amount: Number.isFinite(amount) ? amount : 0,
        lifelines: levelLifelinesRef.current,
        question: qFact?.text,
        pickedText:
          pickedIndex >= 0 ? qFact?.options[pickedIndex] : undefined,
        correctText:
          correctIndex >= 0 ? qFact?.options[correctIndex] : undefined,
      };
      setJourney((prev) => [
        ...prev.filter((s) => s.level !== level),
        step,
      ]);
    },
    [],
  );

  const handleEvent = useCallback(
    (data: WsMessage) => {
      switch (data.event) {
        case "room_created":
          setRoomId(data.room_id);
          setToken(data.token);
          setSeat(data.seat);
          seatRef.current = data.seat;
          setMode(data.mode);
          modeRef.current = data.mode;
          // M7: the surfaced duel code (absent/empty for solo, and until
          // backend M7 lands — never render a uuid in its place on the
          // stage: the lobby falls back to the ID chip only pre-M7).
          setRoomCode(
            typeof data.code === "string" && data.code.trim() !== ""
              ? data.code.trim()
              : null,
          );
          resetGame();
          // Wave-4B: a NEW room is a NEW session — its `room_totals` history
          // dies with the old room, so never carry a previous room's block
          // into this one (a join snapshot will fill it in if it has history).
          setRoomTotals(null);
          addLog(`Room created (${data.mode}).`);
          break;
        case "room_state": {
          setRoomId(data.room_id);
          setMode(data.mode);
          modeRef.current = data.mode;
          // M5 rejoin-contract fix: a room_state means the (re)join landed —
          // the pre-join screen is done either way.
          setRejoin(null);
          // M7: room_state echoes the room's code (duels; solo echoes '').
          // Keep the surfaced chip fresh AND persist a durable code-keyed
          // rejoin record for this seat.
          setRoomCode(
            typeof data.code === "string" && data.code.trim() !== ""
              ? data.code.trim()
              : null,
          );
          // WAVE 6 / wave-4B: the room's SESSION totals. The key is OMITTED
          // for a history-less room — only an absent-or-empty array collapses
          // to null (render nothing). Rows are kept exactly as sent: the
          // block is sparse (a seat with no completed run has no row) and is
          // public-facts-only, so the rematch card never has to guess.
          setRoomTotals(
            Array.isArray(data.totals) && data.totals.length > 0
              ? data.totals.filter(
                  (t) =>
                    t !== null &&
                    typeof t === "object" &&
                    Number.isInteger(t.seat),
                )
              : null,
          );
          // SPEC §2: room_state is a self-view snapshot — it always carries the
          // joiner's own seat and token (including on token rejoin), so joiners
          // see their seat chip too. Echoed token keeps localStorage fresh.
          setSeat(data.seat);
          seatRef.current = data.seat;
          if (data.token) setToken(data.token);
          // M3 fix: any in-flight answer/lifeline identity died with the old
          // socket — the snapshot restores the live question fresh.
          lockedQuestionLevelRef.current = null;
          swapSupersededRef.current = false;
          lifelineQuestionLevelRef.current = null;
          lifelineRefusalRef.current = null;
          clearContinueBeat();
          const me = data.players.find((p) => p.seat === data.seat);
          const reached = me?.level_reached ?? 0;
          const meStatus = me?.status ?? "active";
          // M4: the other seat's public snapshot seeds the OpponentPanel
          // (undefined in solo → null → no panel rendered).
          const other = data.players.find((p) => p.seat !== data.seat);
          setOpponent(
            other
              ? {
                  seat: other.seat,
                  name: other.name,
                  status: other.status,
                  amount: Number.isFinite(other.amount) ? other.amount : 0,
                  levelReached: Number.isFinite(other.level_reached)
                    ? other.level_reached
                    : 0,
                }
              : null,
          );
          // M6 room_state row: the joiner's OWN fifty_fifty removals for the
          // active question (absent when none is live). Restores the struck
          // options on a mid-run rejoin; the used-flag inference: a live
          // own 50:50 also proves fifty_fifty was used this run (the
          // public player view carries NO lifelines_left — see api.ts).
          if (
            data.question &&
            Array.isArray(data.removed_indices) &&
            data.removed_indices.length > 0
          ) {
            setRemovedOptions(
              data.removed_indices.filter(
                (i) => Number.isInteger(i) && i >= 0 && i <= 3,
              ),
            );
            setLifelinesUsed((prev) => ({ ...prev, fifty_fifty: true }));
          }

          if (meStatus !== "active") {
            // Rejoined after the run already ended (fallen/walked/won):
            // restore the run-end state through the same path as `run_ended`
            // so the run-end screen renders — never a live question card
            // (M2 review finding 3). NOTE: no continue beat armed here —
            // the run is already over; the game-over transition is the
            // backend's.
            setStarted(true);
            setQuestion(null);
            heldQuestionRef.current = null;
            setConfirmWalk(false);
            chosenIndexRef.current = null;
            applyRunEnd(meStatus, me?.amount ?? 0);
            addLog("Rejoined — your run has already ended.");
            break;
          }
          if (data.question) {
            // UPDATED SPEC §2: the room_state question is the uniform payload
            // and carries its own `level` — use it directly, no inference.
            setStarted(true);
            heldQuestionRef.current = {
              level: data.question.level,
              text: data.question.text,
              options: data.question.options,
            };
            setQuestion({
              level: data.question.level,
              text: data.question.text,
              options: data.question.options,
              endsAt: data.ends_at ?? "",
            });
            questionLevelRef.current = data.question.level;
            setLadder({
              currentLevel: data.question.level,
              levelReached: reached,
              status: "active",
            });
            addLog(`Rejoined — level ${data.question.level} question restored.`);
          } else if (reached > 0) {
            // Fallback ONLY for snapshots without a question (M2 review
            // finding 4): infer the level from the answered progress; no card
            // renders until question_next arrives.
            setStarted(true);
            setLadder({
              currentLevel: reached + 1,
              levelReached: reached,
              status: "active",
            });
            addLog(`Rejoined — level ${reached + 1} (inferred), awaiting question.`);
          } else {
            addLog("Connected to lobby.");
          }
          break;
        }
        case "player_joined":
          // M4: in a duel the second seat becomes the OpponentPanel's subject
          // (guarded so a broadcast about our OWN seat never creates one).
          if (seatRef.current !== null && data.seat !== seatRef.current) {
            setOpponent((prev) =>
              prev && prev.seat === data.seat
                ? { ...prev, name: data.name }
                : {
                    seat: data.seat,
                    name: data.name,
                    status: "active",
                    amount: 0,
                    levelReached: 0,
                  },
            );
          }
          addLog(`${data.name} joined (seat ${data.seat}).`);
          break;
        case "game_started":
          setStarted(true);
          // The duel's OpponentPanel state (from player_joined / room_state)
          // survives — game_started carries no players snapshot (SPEC §2).
          resetGame(true);
          heldQuestionRef.current = {
            level: data.question.level,
            text: data.question.text,
            options: data.question.options,
          };
          setQuestion({
            level: data.question.level,
            text: data.question.text,
            options: data.question.options,
            endsAt: data.ends_at,
          });
          questionLevelRef.current = data.question.level;
          setLadder({
            currentLevel: data.question.level,
            levelReached: 0,
            status: "active",
          });
          addLog(`Game started — level ${data.question.level}. Good luck!`);
          break;
        case "question_next": {
          clearContinueBeat();
          // UX v3 wave 2: the run moved on — BOTH overlay kinds auto-close
          // (the rise reveal via `setReveal(null)` below; a fallen seat's
          // fall overlay — the survivor's questions keep arriving).
          clearFallOverlay();
          setQuestion({
            level: data.question.level,
            text: data.question.text,
            options: data.question.options,
            endsAt: data.ends_at,
          });
          questionLevelRef.current = data.question.level;
          // UX v3 wave 3b: the held question fact mirrors the delivery —
          // a timeout fall's journey step reads it.
          heldQuestionRef.current = {
            level: data.question.level,
            text: data.question.text,
            options: data.question.options,
          };
          setChosenIndex(null);
          chosenIndexRef.current = null;
          // M3 fix: the run moved on — no answer/lifeline can still target
          // the previous question.
          lockedQuestionLevelRef.current = null;
          swapSupersededRef.current = false;
          // UX v3 wave 5a: the level advanced — lifelines spent here belong
          // to the journey step this level's answer will record.
          levelLifelinesRef.current = 0;
          setReveal(null);
          setRemovedOptions([]);
          dismissAudience();
          setConfirmWalk(false);
          // M4 note: the rival reveal is NOT cleared here — the rival's run
          // is over (one fall ends it), so their panel keeps showing HOW it
          // ended for the rest of the game. Cleared on reset/leave only.
          setLadder((prev) => ({
            ...prev,
            currentLevel: data.question.level,
          }));
          addLog(`Level ${data.question.level}: next question issued.`);
          break;
        }
        case "answer_result": {
          // M3 fix [med]: `answer_result` carries no level, so it must be
          // matched against the question the answer POST was made against
          // (stamped in `lockedQuestionLevelRef`). If a switch-in-place
          // superseded the pending POST (same level — tracked by
          // `swapSupersededRef`) or the level has moved on, the payload's
          // `correct_index` refers to the REPLACED question's options and
          // must NEVER color the now-displayed card: log the resolution and
          // update the ladder logically only (`level_reached`/amount; the
          // run's visible consequences arrive via question_next /
          // run_ended). The card stays locked (chosenIndex) until then.
          const answeredLevel = lockedQuestionLevelRef.current;
          const superseded =
            answeredLevel !== null &&
            (swapSupersededRef.current ||
              answeredLevel !== questionLevelRef.current);
          swapSupersededRef.current = false;
          // UX v3 wave 3b: the journey accordion's question fact — the
          // question the POST was made against (level-validated; a switch
          // or level advance between POST and result never poisons it).
          const answeredFact =
            answeredQuestionRef.current !== null &&
            answeredQuestionRef.current.level === answeredLevel
              ? answeredQuestionRef.current
              : null;
          if (superseded && answeredLevel !== null) {
            setLadder((prev) => ({
              ...prev,
              status: data.status,
              levelReached: data.correct
                ? Math.max(prev.levelReached, answeredLevel)
                : prev.levelReached,
            }));
            // UX v3 wave 5a: a superseded resolution is still THIS seat's
            // resolution of `answeredLevel` — the journey records it (the
            // picked index was the lock; correct_index rides the payload).
            recordJourneyStep(
              answeredLevel,
              chosenIndexRef.current ?? -1,
              data.correct,
              data.correct_index,
              data.amount,
              answeredFact,
            );
            addLog(
              `Your answer to question ${answeredLevel} has been resolved.`,
            );
            break;
          }
          // The result matches the live question — lock bookkeeping done.
          lockedQuestionLevelRef.current = null;
          setReveal({
            correct: data.correct,
            correctIndex: data.correct_index,
          });
          setLadder((prev) => ({
            ...prev,
            status: data.status,
            levelReached: data.correct
              ? Math.max(prev.levelReached, questionLevelRef.current)
              : prev.levelReached,
          }));
          // UX v3 wave 5a: the journey step (picked = the just-locked index;
          // correct_index arrives WITH the result — after the fact, allowed).
          recordJourneyStep(
            questionLevelRef.current,
            chosenIndexRef.current ?? -1,
            data.correct,
            data.correct_index,
            data.amount,
            answeredFact,
          );
          addLog(
            data.correct
              ? `Correct — ${GBP(data.amount)} secured.`
              : `Wrong — correct was ${optionLabel(data.correct_index)}.`,
          );
          // M5 hold-until-continue (SOLO only): a correct answer whose run
          // CONTINUES starts the ~2.5s reveal beat, then arms the CONTINUE
          // affordance. (A fallen/won status ends the run — `run_ended`
          // arms the beat there.) Duels auto-advance server-side.
          if (
            modeRef.current === "solo" &&
            data.correct &&
            data.status === "active"
          ) {
            scheduleContinueBeat();
          }
          // UX v3 wave 2: a WRONG reveal starts the FALL tree choreography
          // (slide-down + target-rung shatter + fallen caption); the
          // `run_ended` that follows feeds its caption. Timeout falls (no
          // own reveal ever rendered) start it in the `run_ended` case.
          if (!data.correct) startFallOverlay();
          break;
        }
        case "opponent_reveal": {
          // M2 review finding 1 [high]: the activity log must NOT expose the
          // correct answer while the local player may still be resolving this
          // question. Log the level + pick only; the payload (including
          // `correct_index`) rides in `rivalReveal` state and reaches the
          // OpponentPanel ONLY through the `gatedRivalReveal` gate below —
          // never while our card is live on this level (hard rule).
          const info: RivalReveal = {
            level: data.question.level,
            chosenIndex: data.chosen_index,
            correctIndex: data.correct_index,
          };
          setRivalReveal(info);
          // The reveal IS the rival's fall — reflect it in their panel.
          // `levelReached` from the reveal wins over the (safe-haven-
          // ambiguous) fall amount: they answered level−1 correctly.
          // M4 fix [low]: no synthetic rival row — a reveal with no KNOWN
          // rival (no room_state/player_joined seat) is ignored here; the
          // activity log still carries the de-fanged line.
          setOpponent((prev) => {
            if (!prev || prev.seat === seatRef.current) return prev;
            return {
              ...prev,
              status: prev.status === "active" ? "fallen" : prev.status,
              levelReached: Math.max(
                prev.levelReached,
                Math.max(0, info.level - 1),
              ),
            };
          });
          // chosen_index −1 = timeout fall (SPEC) — a negative index must
          // never reach optionLabel (it clamps to "A").
          if (data.chosen_index >= 0) {
            addLog(
              `Opponent fell at level ${data.question.level} (picked ${optionLabel(data.chosen_index)}).`,
            );
          } else {
            addLog(`Opponent ran out of time at level ${data.question.level}.`);
          }
          break;
        }
        case "lifeline_used": {
          // M3: dispatch on the polymorphic `data` shape (SPEC §2 — removed
          // indices / percentages; wave 5 makes the swap's data EMPTY), runtime-
          // tolerant like the rest of the handler: malformed payloads degrade
          // to a plain log line and never crash the switch.
          const own = data.seat === seatRef.current;
          const d = data.data;
          // UX v3 wave 5a: captured BEFORE the dispatch (an applied switch
          // clears `lifelineQuestionLevelRef` mid-case) — true when this
          // lifeline was live on the CURRENT level, i.e. it belongs to that
          // level's journey step.
          const ownAtLevel =
            own &&
            lifelineQuestionLevelRef.current === questionLevelRef.current;
          if (
            data.lifeline === "fifty_fifty" &&
            d !== null &&
            typeof d === "object" &&
            "removed_indices" in d &&
            Array.isArray(d.removed_indices)
          ) {
            if (own) {
              if (
                lifelineQuestionLevelRef.current !== null &&
                lifelineQuestionLevelRef.current === questionLevelRef.current
              ) {
                // Own 50:50 → strike the removed indices on THIS question.
                setRemovedOptions(
                  Array.from(
                    new Set(
                      d.removed_indices.filter(
                        (i) => Number.isInteger(i) && i >= 0 && i <= 3,
                      ),
                    ),
                  ),
                );
                addLog("You used 50:50 — two wrong options removed.");
              } else {
                // M3 fix [low]: the level moved on (or a switch replaced the
                // question) between the POST and this broadcast — the
                // removals were computed for the ORIGINAL question's options
                // and must not strike the card now displayed.
                addLog("Stale 50:50 ignored — question has moved on.");
              }
            } else {
              // Opponent's 50:50 is informational only — their lifeline
              // applies to their own run; it never strikes OUR options.
              addLog("Rival used 50:50.");
            }
          } else if (
            data.lifeline === "audience" &&
            d !== null &&
            typeof d === "object" &&
            "percentages" in d &&
            Array.isArray(d.percentages)
          ) {
            if (
              own &&
              lifelineQuestionLevelRef.current !== null &&
              lifelineQuestionLevelRef.current === questionLevelRef.current
            ) {
              // Normalize defensively. LEAK GUARD (M2/M3): the bars are just
              // the server's fake poll (SPEC §1) — no correct_index is ever
              // rendered or logged here.
              showAudience(
                [0, 1, 2, 3].map((i) =>
                  Number.isFinite(d.percentages[i]) ? d.percentages[i] : 0,
                ),
              );
              addLog("You asked the audience.");
            } else if (
              own &&
              lifelineQuestionLevelRef.current !== questionLevelRef.current
            ) {
              // M3 fix [low]: same level-key as the 50:50 — a poll computed
              // for a replaced question never renders on the new one.
              addLog("Stale audience poll ignored — question has moved on.");
            } else {
              addLog(
                own ? "You asked the audience." : "Rival asked the audience.",
              );
            }
          } else if (data.lifeline === "switch") {
            // WAVE 5 (per-seat swap, SPEC §1): the room broadcast for a swap
            // carries an EMPTY `data` — the replacement question is per-seat
            // and rides the PRIVATE `question_swapped` below, so this branch
            // must NEVER touch the question (that was the old room-wide
            // contract, and applying it here is exactly the leak wave 5
            // removed). All this branch does is let the tail below set the
            // own-seat one-use flag + clear the spinner.
            //
            // NO-LEAK: the peer-facing line says a lifeline was used and
            // nothing more — no question text, no hint that a specific
            // question replaced another.
            if (!own) addLog("Rival used Switch.");
          } else {
            // Off-SPEC / malformed lifeline payload — informational only.
            addLog(`${own ? "You" : "Rival"} used ${data.lifeline}.`);
          }
          if (own) {
            // The broadcast SETS the own-seat one-use flag (SPEC §1:
            // lifelines are per-player, one use each per run) and resolves
            // the optimistic pending state.
            setLifelinesUsed((prev) => ({ ...prev, [data.lifeline]: true }));
            clearPendingLifeline();
            // UX v3 wave 5a: count it for the current level's journey step
            // (stale/spent-after-advance lifelines don't belong to it).
            if (ownAtLevel) levelLifelinesRef.current += 1;
          }
          break;
        }
        case "question_swapped": {
          // WAVE 5 — PER-SEAT SWAP (SPEC §1 "SWAP rules" / §2 event row).
          // The replacement question reaches EXACTLY ONE socket: the
          // swapping seat's. Defence in depth against an off-contract frame:
          // a `question_swapped` whose seat is not ours is dropped — the old
          // room-wide application of a peer's question is precisely the leak
          // wave 5 removed, so this guard must never be relaxed.
          if (data.seat !== seatRef.current) break;
          // Runtime-tolerant like the rest of the machine: a malformed
          // payload degrades to a log line, it never crashes the case (which
          // would strand the pending-lifeline spinner).
          const q = data.question;
          const level =
            Number.isInteger(data.level) && data.level >= 1 ? data.level : null;
          if (
            level === null ||
            q === null ||
            typeof q !== "object" ||
            typeof q.text !== "string" ||
            !Array.isArray(q.options) ||
            q.options.length < 2
          ) {
            addLog("Switch result ignored — malformed payload.");
            break;
          }
          // The embedded question must agree with the frame's level: the
          // server always sends both, so a disagreement is an off-contract
          // frame. Applying it anyway would restamp questionLevelRef with
          // `level` while the card shows another level's question — and that
          // ref feeds the journey + ladder comparisons downstream.
          if (Number.isInteger(q.level) && q.level !== level) {
            addLog("Switch result ignored — question/level mismatch.");
            break;
          }
          // A swap NEVER changes the level (SPEC §1), so a mismatch means the
          // run has already moved on and applying this would clobber the
          // CURRENT question.
          if (questionLevelRef.current !== 0 && level !== questionLevelRef.current) {
            addLog("Stale switch ignored — question has moved on.");
            break;
          }
          // The question identity of this seat's OWN applied lifeline state
          // dies with the replaced question: the 50:50 removals and the
          // audience poll were computed for options that no longer exist
          // (the server drops this seat's removals on the swap too — SPEC).
          setRemovedOptions([]);
          dismissAudience();
          // PORTED VERBATIM from the pre-wave-5 switch branch — the swap-
          // supersede guard. The client-side "locked but not yet POSTed"
          // answer is invisible to the server (it only knows "resolved"),
          // so this is the only place that can neutralise an in-flight
          // `answer_result` whose correct_index belongs to the REPLACED
          // question.
          const superseding =
            chosenIndexRef.current !== null &&
            lockedQuestionLevelRef.current === questionLevelRef.current;
          if (superseding) {
            // Keep the answer lock (the card stays disabled — a re-answer
            // would POST against a question the server has already resolved)
            // and mark the pending answer_result as swap-superseded so it can
            // never colour the new options.
            swapSupersededRef.current = true;
          } else {
            // The replacement invalidates the old question's locks.
            chosenIndexRef.current = null;
            lockedQuestionLevelRef.current = null;
            setChosenIndex(null);
            setReveal(null);
          }
          // A swap is a per-question lifeline use at THIS level. Its own
          // journey count is taken by the `lifeline_used` twin's tail below
          // (the server sends the twin immediately after this frame and the
          // level has not moved, so `ownAtLevel` is true) — do NOT count it
          // twice here.
          //
          // The question-identity stamp of an IN-FLIGHT lifeline dies with
          // the replaced question: a 50:50/AUD already computed for the old
          // options must never apply to the new card. The one exception is
          // the swap's OWN stamp (only one lifeline POST is ever in flight —
          // `handleLifeline` blocks a second), which must survive so the
          // twin can resolve the pending state and count the spend.
          if (pendingLifelineRef.current !== "switch") {
            lifelineQuestionLevelRef.current = null;
          }
          // The question level is unchanged by a swap — restamped only so the
          // guard above stays exact if an off-contract frame disagrees.
          questionLevelRef.current = level;
          setQuestion((prev) => {
            if (!prev) return prev;
            const replaced: QuestionPayload = {
              level,
              text: q.text,
              options: q.options.map(String),
            };
            // UX v3 wave 3b: the held fact mirrors the replacement (the
            // journey captures the ANSWERED question separately).
            heldQuestionRef.current = replaced;
            return {
              ...replaced,
              // The timer is NEVER reset by a swap (SPEC §1): the echoed
              // `ends_at` is the deadline already in flight — adopt it
              // verbatim when present, otherwise keep what we hold.
              endsAt:
                typeof data.ends_at === "string" && data.ends_at !== ""
                  ? data.ends_at
                  : prev.endsAt,
            };
          });
          addLog("You used Switch — your question has been replaced.");
          break;
        }
        case "run_ended":
          if (data.seat === seatRef.current) {
            applyRunEnd(data.status, data.amount ?? 0);
            // UX v3 wave 5a: only a TIMEOUT fall (never resolved via its own
            // `answer_result`) records a journey step here — append-if-absent
            // so a wrong-answer fall (whose `run_ended` also carries the
            // wave-4 `correct_index`) can never REPLACE the real step that
            // already holds the picked letter. pickedIndex −1 = timeout.
            if (
              data.status === "fallen" &&
              questionLevelRef.current > 0
            ) {
              const fallLevel = questionLevelRef.current;
              // UX v3 wave 3b: the timeout fall's journey step carries the
              // HELD question's fact (level-validated — the accordion's
              // ⏱ variant shows the question + the correct answer text).
              const heldFact =
                heldQuestionRef.current !== null &&
                heldQuestionRef.current.level === fallLevel
                  ? heldQuestionRef.current
                  : null;
              setJourney((prev) =>
                prev.some((s) => s.level === fallLevel)
                  ? prev
                  : [
                      ...prev,
                      {
                        level: fallLevel,
                        pickedIndex: -1,
                        correct: false,
                        correctIndex:
                          typeof data.correct_index === "number"
                            ? data.correct_index
                            : -1,
                        amount: Number.isFinite(data.amount)
                          ? data.amount
                          : 0,
                        lifelines: levelLifelinesRef.current,
                        question: heldFact?.text,
                        pickedText: undefined,
                        correctText:
                          typeof data.correct_index === "number" &&
                          data.correct_index >= 0
                            ? heldFact?.options[data.correct_index]
                            : undefined,
                      },
                    ],
              );
            }
            // M5 hold-until-continue (SOLO only): the run-end reveal holds
            // behind the CONTINUE affordance once the beat passes; the
            // click POSTs the M7 continue endpoint (which drives the
            // game-over transition). Duels advance server-side.
            if (modeRef.current === "solo") scheduleContinueBeat();
            // UX v3 wave 2: a TIMEOUT fall (the player never locked an
            // answer, so no wrong reveal started the choreography) plays
            // the FALL overlay from the run_ended facts. A wrong answer's
            // overlay is already playing (fallPlayingRef → no-op here) and
            // a rejoin-restore never reaches this branch.
            if (data.status === "fallen" && questionLevelRef.current > 0) {
              startFallOverlay();
            }
          } else {
            // M4: the rival's run end drives their panel chip + static
            // ladder. Walked/won amounts map uniquely back to a level
            // (SPEC §1 ladder); a FALL's amount is a safe-haven value
            // (levels 6–10 all bank £1,000) — the `opponent_reveal`
            // carries the exact level instead, so leave it untouched here.
            setOpponent((prev) => {
              if (!prev) {
                return {
                  seat: data.seat,
                  name: "Rival",
                  status: data.status,
                  amount: Number.isFinite(data.amount) ? data.amount : 0,
                  levelReached: 0,
                };
              }
              // M4 fix [high]: the branch guard was INVERTED
              // (`prev.seat !== data.seat`) → when the panel already tracked
              // this seat the update fell through as a no-op: walked/won
              // rivals never went static and fallen rivals kept £0 off their
              // room_state/`opponent_reveal` seed. Only the panel's OWN seat
              // update (amount/ladder/level) is guarded/derived here.
              if (prev.seat === data.seat) {
                const amount = Number.isFinite(data.amount) ? data.amount : 0;
                const idx = LADDER_AMOUNTS.indexOf(amount);
                return {
                  ...prev,
                  status: data.status,
                  amount,
                  levelReached:
                    data.status === "fallen"
                      ? prev.levelReached
                      : idx >= 0
                        ? idx + 1
                        : prev.levelReached,
                };
              }
              return prev;
            });
          }
          addLog(
            `Seat ${data.seat} run ended: ${data.status} (${GBP(data.amount ?? 0)}).`,
          );
          break;
        case "opponent_progress": {
          // Wave-4 contract (SPEC §2): the SURVIVOR's public-fact progress —
          // sent to the LAPSED seat(s) only, on their visible moves (a
          // correct answer / any lifeline usage). NEVER carries
          // correct_index or private data (SPEC invariant 1), and the
          // survivor's own socket never receives it. Drives the spectate
          // view's live rival strip. M4 no-synthetic-rival rule: an
          // unknown/off-room seat is ignored here.
          setOpponent((prev) => {
            if (!prev || prev.seat !== data.seat) return prev;
            const amount = Number.isFinite(data.amount) ? data.amount : 0;
            // levelReached derives from the PERSISTED amount (unique 1:1
            // mapping while a seat is active — never the ambiguous fallen-
            // safe-haven case), so the earned rungs stay honest under both
            // readings of the contract's `level` (in-play vs just-reached).
            // The level IN PLAY itself renders from the room-wide
            // question_next (see SpectateViewProps.rivalCurrentLevel).
            const fromAmount = levelFromAmount(amount);
            return {
              ...prev,
              status: data.status === "active" ? "active" : prev.status,
              amount,
              levelReached:
                fromAmount !== null
                  ? Math.max(prev.levelReached, fromAmount)
                  : prev.levelReached,
            };
          });
          addLog(
            `Rival progress — level ${data.level}, ${GBP(data.amount)} banked.`,
          );
          break;
        }
        case "rematch_ready": {
          // UX v3 wave 5b — IN-ROOM REMATCH landed (wave-5a shipped only the
          // tolerant fallback): a replay reset the SAME room (same code) for
          // a fresh run — wipe the finished run's presentation and return to
          // the DUEL LOBBY, which now owns the deferred start (the host's
          // START button + the joiner's waiting copy; `started` drops so the
          // lobby renders in its narrow fresh-room layout again). The duel
          // panel's seat rows reset to the replayed run's fresh state.
          resetGame(true);
          setStarted(false);
          setRivalReveal(null);
          setOpponent((prev) =>
            prev
              ? { ...prev, status: "active", amount: 0, levelReached: 0 }
              : prev,
          );
          addLog("Rematch ready — back to the lobby.");
          break;
        }
        case "game_over":
          gameOverRef.current = true;
          clearContinueBeat();
          // UX v3 wave 2: the results screen takes over — close any reveal
          // overlay still up (e.g. a rise overlay held over the interim
          // after a won run).
          // Wave 3c fix: EXCEPT a held SOLO fall beat. The fall choreography
          // is a beat the USER releases ("Continue · see results" →
          // interim → results); game_over arrives within milliseconds of the
          // fall, so clearing unconditionally meant the fall overlay mounted
          // for one frame and vanished — the shatter/slide was never actually
          // watchable. A duel beat self-closes on FALL_BEAT_MS, and with no
          // beat playing there is nothing to clear.
          if (modeRef.current !== "solo" || !fallPlayingRef.current) {
            clearFallOverlay();
          }
          setStandings(data.standings);
          // Wave 6: the game_over payload now carries the room's freshly-taken
          // session census (the same six public fields room_state carries).
          // Adopt it here so the rematch card shows the session lines on the
          // run that just finished — previously the block only ever arrived on
          // a rejoin, so the feature was invisible until a manual page reload.
          if (Array.isArray(data.totals) && data.totals.length > 0) {
            setRoomTotals(
              data.totals.filter(
                (t): t is RoomTotal =>
                  t !== null &&
                  typeof t === "object" &&
                  Number.isInteger(t.seat),
              ),
            );
          }
          addLog("Game over.");
          break;
        case "error":
          // SPEC §2 error event: surface in the activity log + subtle banner.
          //
          // WAVE 5 — SWAP REFUSALS arrive here (SPEC §1: every refusal is a
          // 409 AND an `error` frame to the caller's socket; the guards run
          // BEFORE the atomic spend, so a refused swap costs the player
          // NOTHING). Two jobs beyond the banner:
          //   1. restore the button — clear the optimistic pending state, and
          //      explicitly do NOT set `lifelinesUsed`: the server owns
          //      `lifelines_left`, and no `lifeline_used` follows a refusal.
          //      This is the same re-sync the 50:50/AUD refusals get (their
          //      used-flag likewise only ever flips on the broadcast).
          //   2. remember the message so the REST catch (which resolves with
          //      a generic "failed" string) does not overwrite the precise,
          //      server-authored reason with a worse banner.
          if (pendingLifelineRef.current !== null) {
            lifelineRefusalRef.current = pendingLifelineRef.current;
            lifelineQuestionLevelRef.current = null;
            clearPendingLifeline();
          }
          showError(data.message);
          addLog(`Error: ${data.message}`);
          break;
        default:
          // Tolerate events not in the SPEC §2 table (forward-compat).
          addLog(`Unknown event: ${(data as { event?: string }).event ?? "?"}`);
      }
    },
    [
      addLog,
      applyRunEnd,
      recordJourneyStep,
      resetGame,
      showError,
      showAudience,
      dismissAudience,
      clearPendingLifeline,
      clearContinueBeat,
      scheduleContinueBeat,
      clearFallOverlay,
      startFallOverlay,
    ],
  );

  /** Detach every handler of the current socket and close it, bumping the
   *  generation so none of its (already-detached or about-to-fire) events can
   *  touch state — a replaced socket's late `onclose` must not stomp `conn`
   *  back to "closed" after a voluntary Leave or a superseding connect. */
  const closeSocket = useCallback(() => {
    genRef.current += 1;
    // M2 review finding 7: a disconnect mid-answer must not leave the
    // same-frame guard armed for the next connection. Same for M3's
    // pending-lifeline guard (the STATE clear lives in the socket's onclose
    // callback — not here — so no setState runs synchronously inside the
    // mount-rejoin effect that calls closeSocket).
    chosenIndexRef.current = null;
    pendingLifelineRef.current = null;
    lifelineRefusalRef.current = null;
    // M3 fix: in-flight answer/lifeline question identities die with the
    // socket (the reconnect snapshot rehydrates fresh state).
    lockedQuestionLevelRef.current = null;
    swapSupersededRef.current = false;
    lifelineQuestionLevelRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    }
  }, []);

  const connect = useCallback(
    (opts: WsConnectOpts) => {
      closeSocket();
      const gen = genRef.current;
      const ws = new WebSocket(getWsUrl(opts));
      wsRef.current = ws;

      /** Ignore events from a socket that is no longer the current one. */
      const current =
        <T,>(fn: (arg: T) => void) =>
        (arg: T) => {
          if (genRef.current !== gen) return;
          fn(arg);
        };

      ws.onopen = current(() => {
        setConn("open");
      });
      ws.onmessage = current((msg: MessageEvent) => {
        try {
          handleEvent(JSON.parse(msg.data) as WsMessage);
        } catch {
          addLog("Received malformed message from server.");
        }
      });
      ws.onclose = current((event: CloseEvent) => {
        setConn("closed");
        // M3: a mid-pending lifeline dies with the network — restore the
        // buttons (the ref was already cleared in closeSocket for the
        // voluntary-replace path; events from a detached socket can't fire).
        setPendingLifeline(null);
        lifelineRefusalRef.current = null;
        // UX v3 wave 2: the reveal overlay is game-context presentation —
        // it must not survive a disconnect onto the title screen.
        clearFallOverlay();
        if (gameOverRef.current) {
          // M1 review note: with real game screens, a close after game_over is
          // a benign normal server close — keep the results on screen, no red
          // "Room unavailable" banner.
          addLog("Game finished — disconnected.");
          return;
        }
        setStarted(false);
        setSeat(null);
        seatRef.current = null;
        // SPEC §2: server-side closes (rejection path, e.g. room full/unknown
        // room) use a close code ≠ 1006 (1000 = normal server close, 4xxx =
        // rejection); the browser itself generates 1006 when the connection
        // dies without a close frame — that is a network failure.
        if (event.code === 1006) {
          addLog("Disconnected.");
          // UX v3: connection failures surface ONLY as the single error
          // banner (no status chips / persistent connection text).
          showError(
            "Can't reach the game server — check your connection and try again.",
          );
        } else {
          addLog("Room unavailable or full.");
          showError(
            "That room didn't work — it may be gone or full. Check the code and try again.",
          );
        }
      });
    },
    [closeSocket, handleEvent, addLog, showError, clearFallOverlay],
  );

  /** Title-screen actions. PLAY = solo instant play (SPEC v1.1): straight
   *  into question 1 — the solo room exists internally for API symmetry but
   *  the UI never mentions it. CREATE DUEL shares the same create flow. */
  const handleCreate = (m: Mode) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setConn("connecting");
    connect({ mode: m, name: trimmed });
  };

  /** Code join (SPEC v1.1): WORD-WORD-DD (validated client-side) — or a
   *  legacy internal uuid. The value is used as the join path id; backend
   *  M7 routes rooms by code. */
  const handleJoin = () => {
    const id = joinInput.trim().toUpperCase();
    const trimmed = name.trim();
    if (!id || !isValidJoinId(id) || !trimmed) {
      // UX v3: the JOIN control stays live (grey → gold when valid) so an
      // invalid submit can SHAKE (error motion) instead of a dead button.
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      setJoinShaking(false);
      requestAnimationFrame(() => {
        setJoinShaking(true);
        shakeTimerRef.current = window.setTimeout(() => {
          setJoinShaking(false);
          shakeTimerRef.current = null;
        }, 500);
      });
      return;
    }
    setConn("connecting");
    connect({ roomId: id, name: trimmed });
  };

  /** M5 rejoin-contract fix — pre-join CONFIRM (duel refresh): a deliberate
   *  join by the shared CODE with the persisted token (the seat's credits).
   *  No name is sent: the token re-attaches this player to their seat. On
   *  success the normal room_state flow rehydrates everything; on failure
   *  (4400 etc.) the record is KEPT for retry and the honest error shows
   *  on this screen. */
  const handleRejoinConfirm = () => {
    if (!rejoin) return;
    const id = rejoinCode.trim().toUpperCase();
    if (!id || !isValidJoinId(id)) return;
    setConn("connecting");
    connect({ roomId: id, token: rejoin.token });
  };

  /** M5 rejoin-contract fix — pre-join Escape ("a different game"): drop the
   *  stored record entirely (clear + home). Nothing is joined, nothing is
   *  silently discarded behind a redirect. */
  const handleRejoinEscape = () => {
    // Rejoin-escape race fix: an in-flight join socket from CONFIRM can
    // still be connecting — close it (detach handlers + bump generation) so a
    // late onopen/room_state can't mount the game after the player escaped.
    closeSocket();
    clearPersistedSession();
    setRejoin(null);
    setRejoinCode("");
    setConn("idle");
    setCopied(null);
    setJoinInput("");
    logsRef.current = [];
  };

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  const copyRoomId = () => {
    if (!roomId) return;
    clearCopyTimer();
    const revert = () => {
      copyTimerRef.current = window.setTimeout(() => setCopied(null), 2000);
    };
    // navigator.clipboard is undefined on insecure origins (plain http) —
    // feature-detect and surface the failure instead of throwing.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(roomCode ?? roomId)
        .then(() => {
          setCopied("ok");
          revert();
        })
        .catch(() => {
          setCopied("failed");
          revert();
        });
    } else {
      setCopied("failed");
      revert();
    }
  };

  /** M5 solo instant play: QUIT = top-right link, disconnects and returns
   *  to the title screen — no ceremony (SPEC v1.1). */
  const handleLeave = () => {
    closeSocket();
    clearCopyTimer();
    clearContinueBeat();
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setCopied(null);
    setRoomId(null);
    setToken(null);
    setRoomCode(null);
    // M5 rejoin-contract fix: leaving also retires any parked rejoin record
    // state (the record itself is cleared by the persistence effect above).
    setRejoin(null);
    setRejoinCode("");
    setSoloRestartNote(false);
    setSeat(null);
    seatRef.current = null;
    setStarted(false);
    setJoinInput("");
    logsRef.current = [];
    setConn("idle");
    setJoinShaking(false);
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    resetGame();
  };

  /**
   * UX v3 wave 5b — IN-ROOM REMATCH (results PLAY AGAIN, SPEC §2 wave-4
   * REST): the finished run re-plays the SAME room via `POST /replay {token}`
   * — no new room, no new code, no leave/create ceremony.
   *  - DUEL: the POST lands a `rematch_ready {seats}` broadcast → both seats
   *    reset into the duel LOBBY (the code card keeps the SAME code; the
   *    host's START button re-arms there for the deferred start).
   *  - SOLO: the replay re-issues Q1 instantly and its `game_started`
   *    broadcast drives the transition STRAIGHT to the question screen —
   *    no lobby hop (solo has no lobby). The POST body's mirrored question
   *    is never trusted for rendering (the WS event is the trust source).
   *  Tolerance: a concurrent double-replay answers 200
   *  `{replayed:false,started:false}` (no broadcast follows) — the guard
   *  releases, the results stay on screen and a neutral warning explains
   *  the hold; the racing winner's `rematch_ready`/`game_started` (if one
   *  is still in flight) moves us on normally.
   * Guard: fired only from the results screen (game already over — a
   * mid-run 409 is unreachable), once per render (the ref; the pending
   * flag also disables the button), and HOME during the POST still works
   * (handleLeave tears the room down; the guards reset with it).
   */
  const handlePlayAgain = () => {
    if (!roomId || !token || !standings) return;
    if (replayInFlightRef.current) return;
    replayInFlightRef.current = true;
    setReplayPending(true);
    void replayRun(roomId, token)
      .then((res) => {
        if (res.started) {
          // SOLO instant re-issue — the `game_started` broadcast resets the
          // run and lands Q1 (resetGame clears the pending guard there).
          return;
        }
        if (res.replayed) {
          // DUEL — `rematch_ready` resets both seats into the lobby; the
          // pending guard clears there.
          return;
        }
        // Concurrent double-replay no-op: nothing more is coming for THIS
        // press — release the guard and hold the results neutrally.
        replayInFlightRef.current = false;
        setReplayPending(false);
        showError("Rematch already started — holding the results.", "warning");
      })
      .catch(() => {
        replayInFlightRef.current = false;
        setReplayPending(false);
        showError("Rematch failed — try again.");
      });
  };

  /**
   * UX v3 wave 5b — DEFERRED DUEL START (lobby START button, SPEC §2
   * wave-4 REST): the HOST flips the waiting lobby to a live game; the
   * `game_started` broadcast (both seats) takes over exactly as before.
   * The button only renders with both seats seated (a half-full start is a
   * backend 409 — never reachable in the UI); hostile/duplicate starts are
   * the backend's to answer (403 + error event / idempotent no-op) and map
   * to the single error banner here. Same-frame double-click guard (ref).
   */
  const handleStartDuel = () => {
    if (!roomId || !token) return;
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setStartPending(true);
    void startDuel(roomId, token)
      .catch(() => {
        showError("Could not start the duel — try again.");
      })
      .finally(() => {
        // A 200 either started the run (the broadcast is milliseconds
        // behind) or was the idempotent {"started":false} no-op — releasing
        // the guard here can never strand the button.
        startInFlightRef.current = false;
        setStartPending(false);
      });
  };

  // --- REST actions (SPEC §2) ----------------------------------------------

  const handleAnswer = (index: number) => {
    if (!roomId || !token || !question) return;
    // M2 review finding 3: answering is gated on the run being active —
    // a fallen/walked/won player can never POST.
    if (ladder.status !== "active") return;
    if (chosenIndex !== null || reveal !== null) return;
    // M3 local guard: a 50:50-removed option can never be POSTed (the
    // button is already inert; this mirrors that server-side invariant).
    if (removedOptions.includes(index)) return;
    // M2 review finding 7: same-frame double-click guard — the ref is set
    // synchronously, so a second click before React re-renders is a no-op.
    if (chosenIndexRef.current !== null) return;
    const level = question.level;
    // M3 fix [med]: stamp the answer lock with the CURRENT question's level
    // so answer_result can detect a superseded/supplanted lock (see the
    // answer_result case).
    chosenIndexRef.current = index;
    lockedQuestionLevelRef.current = level;
    // UX v3 wave 3b: capture the question fact the POST is made against —
    // `answer_result`'s journey step must reflect the options THAT question
    // had (a switch-in-place or level change between POST and result is
    // answeredFact's own level validation problem, never a display leak).
    answeredQuestionRef.current = {
      level,
      text: question.text,
      options: question.options,
    };
    setChosenIndex(index);
    void answer(roomId, token, level, index).catch(() => {
      // Only unlock if this question is still the live one (no question_next
      // or switch-in-place has already moved the card on).
      if (questionLevelRef.current === level) {
        chosenIndexRef.current = null;
        lockedQuestionLevelRef.current = null;
        swapSupersededRef.current = false;
        setChosenIndex(null);
        showError("Answer request failed — try again.");
      }
    });
  };

  /** M5 hold-until-continue click (solo): POST the M7 continue endpoint; the
   *  server deals the next question (or the game-over transition). The
   *  affordance hides immediately; if the POST fails the beat re-arms so
   *  the run can never strand (pre-M7 backends simply auto-advance and the
   *  arriving question_next clears the affordance anyway). */
  const handleContinue = () => {
    if (!roomId || !token) return;
    setContinueArmed(false);
    void continueRun(roomId, token).catch(() => {
      showError("Continue failed — the next question is on its way.");
      // Re-arm only if the run still hasn't advanced (question_next /
      // game_over clear the beat).
      if (continueTimerRef.current === null) {
        scheduleContinueBeat();
      }
    });
  };

  const handleWalk = () => {
    if (!roomId || !token || ladder.status !== "active") return;
    setConfirmWalk(false);
    void walk(roomId, token).catch(() => showError("Walk request failed."));
  };

  /** M3: POST the lifeline (SPEC §2) with an optimistic pending state that
   *  holds until the `lifeline_used` broadcast resolves it. Error → the
   *  existing banner path + the button is restored. One use each per run is
   *  enforced by the used-flags; run-active by the same status gate as
   *  answering (SPEC §1: none work after the run ended). */
  const handleLifeline = (lifeline: Lifeline) => {
    if (!roomId || !token || !question) return;
    if (ladder.status !== "active") return;
    if (lifelinesUsed[lifeline]) return;
    if (pendingLifeline !== null || pendingLifelineRef.current !== null) return;
    // A question already being answered can't take a lifeline.
    if (chosenIndex !== null || reveal !== null) return;
    pendingLifelineRef.current = lifeline;
    setPendingLifeline(lifeline);
    // M3 fix [low]: stamp the question level at POST time — the matching
    // `lifeline_used` broadcast only applies while the level is unchanged.
    lifelineQuestionLevelRef.current = question.level;
    void sendLifeline(roomId, token, lifeline).catch(() => {
      // WAVE 5 — a REFUSED use (409) is already surfaced by its `error` WS
      // frame with the server's own reason; consume the flag and keep that
      // banner instead of replacing it with generic copy. A genuine
      // transport failure (no error frame) still gets the generic banner.
      const refused = lifelineRefusalRef.current === lifeline;
      lifelineRefusalRef.current = null;
      // Restore the button unless a broadcast/reset already resolved it. The
      // server is the source of truth for `lifelines_left`: a refusal never
      // sets the used-flag, so the button simply comes back unspent.
      if (pendingLifelineRef.current === lifeline) {
        pendingLifelineRef.current = null;
        setPendingLifeline(null);
      }
      if (!refused) showError("Lifeline request failed — try again.");
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "ping" }));
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (audienceTimerRef.current) clearTimeout(audienceTimerRef.current);
      if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (fallTimerRef.current) clearTimeout(fallTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // M5 rejoin-contract fix: the mount decision is made from the persisted
    // record's MODE — never from the legacy uuid keys.
    //  - duel  → the pre-join screen is ALREADY up (the `rejoin` initializer
    //            parked it); we stay quiet here, CONFIRM joins by code.
    //  - solo  → restart-by-design: state is cleared, NO join is attempted
    //            (M7 has no WS-join path for solo; uuid REST is not a rejoin
    //            contract), and a brief non-alarming note explains why.
    //  - legacy record (no code+mode) → readPersistedSession returned null
    //    and already wiped the stale keys; silently back on the title (same
    //    solo-restart semantics — the safest migration for an unjoinable
    //    record).
    if (initSession && initSession.mode === "solo") {
      clearPersistedSession();
      // The note itself is seeded in the initializer (above); only its
      // expiry lives here (async setState — allowed by react-hooks rules).
      const t = window.setTimeout(() => setSoloRestartNote(false), 6000);
      return () => window.clearTimeout(t);
    }
    return () => {
      closeSocket();
      clearCopyTimer();
    };
  }, [initSession, closeSocket, clearCopyTimer]);

  // --- M5 rejoin-contract persistence: ONE durable record ------------------
  // Written whenever a live room identity exists; every field comes from
  // what the SERVER echoed (room_created / room_state: internal uuid, own
  // token, shared duel code or '' for solo, room mode). Removed wholesale
  // on leave/reset — a stale record must never resurrect a room.
  useEffect(() => {
    if (roomId && token) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          roomId,
          token,
          code: roomCode ?? "",
          mode,
        }),
      );
    } else if (!rejoin) {
      // While a rejoin is parked on the pre-join screen the persisted record
      // IS the parked state (e.g. a fresh mount before CONFIRM ran, which
      // leaves roomId/token null) — erasing it here would destroy the very
      // record the player is about to confirm. Removal happens on Escape
      // (handleRejoinEscape clears `rejoin`) or on live-room teardown.
      localStorage.removeItem(SESSION_KEY);
    }
  }, [roomId, token, roomCode, mode, rejoin]);

  useEffect(() => {
    if (name) localStorage.setItem("name", name);
    else localStorage.removeItem("name");
  }, [name]);

  /** Defensive default (M2 review finding 6): off-SPEC run-end status strings
   *  get neutral styling + copy instead of an undefined lookup. */
  const runEndCopy = runEnd
    ? asRunEndStatus(runEnd.status)
      ? RUN_END_COPY[runEnd.status]
      : RUN_END_FALLBACK
    : null;

  const canWalk = Boolean(
    roomId &&
      token &&
      question &&
      !reveal &&
      chosenIndex === null &&
      !runEnd &&
      !standings &&
      ladder.status === "active",
  );

  /** M3: lifelines use the same active-run gate as answering — and none of
   *  them apply to a question that is already resolved/locked. */
  const canUseLifelines = Boolean(
    roomId &&
      token &&
      question &&
      !reveal &&
      chosenIndex === null &&
      ladder.status === "active",
  );

  /** M4 reveal gate (M2 review note 1 — HARD RULE): the OpponentPanel never
   *  receives the rival's `correct_index` while the local player may still be
   *  resolving that very level. The strip may render only when the run has
   *  advanced past the reveal's level (the server issues `question_next` only
   *  after every active player resolved it) OR our own `answer_result` for
   *  that exact level has arrived. Anything else → null → nothing rendered. */
  const gatedRivalReveal =
    rivalReveal && question
      ? question.level > rivalReveal.level ||
        (question.level === rivalReveal.level && reveal !== null)
        ? rivalReveal
        : null
      : null;

  /**
   * UX v3 wave 5a — SPECTATE gate: this seat has LAPSED (fallen/walked; a
   * `won` seat has nothing left to watch) while the DUEL room still has an
   * active survivor — render the SpectateView instead of the bare run-end
   * interim. Solo never spectates (nobody remains); the survivor's run end
   * (`run_ended` for their seat) flips `opponent.status` off `active`,
   * returning the interim until `game_over`. Gating note: the question
   * plate/lifelines/walk/answer are unreachable in this branch anyway
   * (`ladder.status !== "active"` guards every action), and the tree
   * overlay cannot rise for a lapsed seat — `reveal` is only ever set by
   * the PRIVATE `answer_result`, and the fall overlay closes on the
   * survivor's room-wide `question_next`.
   */
  const spectating =
    mode === "duel" &&
    runEnd !== null &&
    standings === null &&
    fallOverlay === null &&
    opponent !== null &&
    opponent.status === "active" &&
    (runEnd.status === "fallen" || runEnd.status === "walked");

  /** The survivor's level IN PLAY for the spectate strip: the room-wide
   *  `question_next` is the trust source (the shared list advances for the
   *  room); without a live question (e.g. a mid-run rejoin snapshot that
   *  carries none) fall back to one past their highest secured level. */
  const spectateLevel =
    opponent && opponent.status === "active"
      ? question !== null && question.level > 0
        ? question.level
        : opponent.levelReached + 1
      : 0;

  const wide = Boolean(
    roomId && (started || runEnd || standings || question),
  );

  /**
   * WAVE 6 / wave-4B — the seat→display-name map the session-totals block
   * renders against on the duel lobby card. Derived (never invented rows):
   * our own seat always has a name ("You"), the rival's comes from the known
   * opponent, and any seat with no known name falls back to "Seat N" inside
   * SessionTotals so a real row is never dropped.
   */
  const lobbyNames: Record<number, string> = seat !== null
    ? opponent
      ? { [seat]: "You", [opponent.seat]: opponent.name }
      : { [seat]: "You" }
    : {};

  /** CONTINUE affordance (solo hold-until-continue) — shown on the reveal
   *  beat after a correct mid-run answer AND on the run-end screen. Duels
   *  never arm it; game_over/leave/question_next disarm it. */
  const showContinue = mode === "solo" && continueArmed;
  const continueBar = showContinue && roomId && token && (
    <button
      type="button"
      onClick={handleContinue}
      className="anim-continue mt-4 w-full rounded-xl border border-gold-500/60 bg-gradient-to-b from-gold-400/15 to-stage-950 py-3 text-xs font-black uppercase tracking-[0.35em] text-gold-300 shadow-[0_0_18px_rgba(212,175,55,0.25)] hover:from-gold-400/30 hover:text-gold-200 transition-all active:scale-[0.98]"
    >
      Continue ▸
    </button>
  );

  // --- UX v3 wave 2: the money-tree reveal overlay -------------------------
  // Derived ENTIRELY from the existing event-machine state (reveal/ladder/
  // runEnd/standings + the question-level facts) — no new event semantics,
  // so every approved guard survives verbatim.
  //
  // RISE (correct reveal): the overlay slides UP over the dimmed plate while
  // `reveal.correct` stands; `question_next` clears the reveal (wave-1
  // transition) → the overlay auto-closes. A won run (status "won") holds
  // it over the interim until game_over hands off to the results screen.
  const riseTree =
    reveal !== null &&
    reveal.correct &&
    question !== null &&
    standings === null &&
    (ladder.status === "active" || ladder.status === "won")
      ? {
          level: question.level,
          amount: amountAt(question.level),
          isSafeRung: question.level === 5 || question.level === 10,
        }
      : null;

  // FALL (wrong answer / timeout — run_ended fallen): plays while the
  // choreography phase runs; the run-end interim stays gated behind it and
  // transitions in when the phase ends (its existing anim-fade-in). A WALK
  // never reaches here (the walk keeps the confirm → results flow).
  const fallTree =
    fallOverlay !== null
      ? (() => {
          // Wave 3c: prefer the fall-start SNAPSHOT (the live question is
          // gone by the time the beat matters); fall back to it if the
          // snapshot somehow missed.
          const lvl = fallFacts?.level ?? question?.level ?? null;
          if (lvl === null) return null;
          return {
            level: lvl,
            amount:
              runEnd !== null && runEnd.status === "fallen"
                ? runEnd.amount
                : (fallFacts?.amount ?? amountAt(lvl)),
            safeLevel:
              fallFacts?.safeLevel ?? lastSafeLevel(ladder.levelReached),
          };
        })()
      : null;

  /** The overlay view (fall wins — the two are mutually exclusive by
   *  construction: a fall requires a fallen run, a rise an active/won one). */
  const revealTreeView = fallTree
    ? ({
        kind: "fall" as const,
        level: fallTree.level,
        levelReached: ladder.levelReached,
        amount: fallTree.amount,
        safeLevel: fallTree.safeLevel,
        isSafeRung: false,
      })
    : riseTree
      ? ({
          kind: "rise" as const,
          level: riseTree.level,
          levelReached: ladder.levelReached,
          amount: riseTree.amount,
          safeLevel: 0,
          isSafeRung: riseTree.isSafeRung,
        })
      : null;

  /** Wave 3: the overlay's CONTINUE — SOLO ONLY (duels never arm or show
   *  the affordance: the server deals the next question ~2.5s after all
   *  seats resolve, and the overlay closes on that `question_next`). The
   *  ~1s beat passed → the plain CONTINUE affordance fades in on the
   *  overlay; its click POSTs the M7 continue endpoint (handleContinue). */
  const overlayShowContinue = mode === "solo" && continueArmed;

  return (
    <div className="stage-bg relative min-h-screen font-sans text-slate-100">
      <div className="hex-floor pointer-events-none absolute inset-0" aria-hidden />
      {/* UX v3: env(safe-area-inset-*) wrapper — the shared screen container. */}
      <div
        className={`safe-area relative mx-auto flex min-h-screen w-full flex-col items-center ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        {/* Gold MILLIONAIRE masthead — show's serif/display feel (system
            serif stack; no external fonts). UX v3: NO status chips and NO
            connection label — failures surface only via the error banner. */}
        <header className={`text-center ${wide ? "mb-4" : "mb-8"}`}>
          {!wide && (
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-gold-500/70">
              Who wants to be a
            </p>
          )}
          <h1
            className={`font-display font-black tracking-[0.08em] bg-gradient-to-b from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(212,175,55,0.35)] ${
              wide ? "text-2xl md:text-4xl" : "text-4xl"
            }`}
          >
            MILLIONAIRE
          </h1>
        </header>

        {/* UX v3: the ONE error banner — single position above the plate,
            severity-colored, auto-dismisses after 6s (showError). */}
        {errorBanner && (
          <div
            className={`banner mb-4 anim-fade-in ${
              errorBanner.severity === "warning"
                ? "banner-warning"
                : "banner-danger"
            }`}
            role="alert"
          >
            <p>{errorBanner.msg}</p>
          </div>
        )}

        {!roomId ? (
          rejoin ? (
            /* M5 rejoin-contract fix — PRE-JOIN screen (duel refresh): the
                shared code is prefilled from the persisted record; the join
                itself is CONFIRM-only (deliberate — a silent auto-join could
                reconnect a seat nobody asked to take over). A failed join
                now surfaces ONLY through the single error banner above
                (UX v3); the stored record is KEPT so CONFIRM can simply be
                retried; Escape wipes and goes home. */
            <div className="w-full anim-fade-in">
              <div className="plate p-6 shadow-[0_0_40px_rgba(11,11,59,0.9)]">
                <p className="text-center text-xs font-bold uppercase tracking-[0.4em] text-gold-500/70">
                  Duel in progress
                </p>
                <h2 className="mt-2 text-center font-display text-2xl font-black tracking-wide text-gold-200">
                  Rejoin by code
                </h2>
                <p className="mt-2 text-center text-xs text-muted">
                  Your seat is stored — confirm to reconnect to the same game.
                </p>

                <input
                  className="field mt-5 font-mono uppercase text-center tracking-wider"
                  placeholder="BLUE-TIGER-73"
                  value={rejoinCode}
                  onChange={(e) => setRejoinCode(e.target.value.toUpperCase())}
                  maxLength={24}
                  aria-label="Duel code"
                />

                <button
                  onClick={handleRejoinConfirm}
                  disabled={
                    !rejoinCode.trim() ||
                    !isValidJoinId(rejoinCode) ||
                    conn === "connecting"
                  }
                  className="btn btn-primary mt-5 text-xl"
                >
                  {conn === "connecting" ? "Reconnecting…" : "Confirm"}
                </button>

                <button
                  onClick={handleRejoinEscape}
                  className="link-ghost mt-5 min-h-[44px] w-full py-3"
                >
                  Start a different game ↩
                </button>
              </div>
            </div>
          ) : (
          /* Title screen (UX v3): masthead above · name input · gold
             full-width PLAY · duel section (code field + JOIN grey→gold
             when valid + shake on an invalid submit). NO status chips. */
          <div className="w-full anim-fade-in">
            <div className="plate p-6 shadow-[0_0_40px_rgba(11,11,59,0.9)]">
              <input
                className="field text-center"
                placeholder="Your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                aria-label="Your name"
              />

              <button
                onClick={() => handleCreate("solo")}
                disabled={!name.trim()}
                className="btn btn-primary mt-4 text-xl"
              >
                Play
              </button>
              <p className="mt-2 text-center text-xs text-muted">
                Straight into question 1 — no lobby, no code.
              </p>

              <div className="relative flex items-center justify-center py-5">
                <div className="border-t border-gold-500/20 w-full"></div>
                <span className="absolute bg-stage-950 px-4 text-xs font-bold text-gold-500/70 uppercase tracking-[0.3em]">
                  Or duel
                </span>
              </div>

              <button
                onClick={() => handleCreate("duel")}
                disabled={!name.trim()}
                className="btn btn-ghost mb-3 text-sm"
              >
                Create a duel room
              </button>

              {/* Duel code field: JOIN goes grey → gold when the code is
                  valid; an invalid submit SHAKES (error motion) — the
                  control is never a dead disabled button. */}
              <div className={joinShaking ? "anim-shake" : ""}>
                <input
                  className="field font-mono uppercase"
                  placeholder="BLUE-TIGER-73"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  maxLength={24}
                  aria-label="Duel code"
                />
                <button
                  onClick={handleJoin}
                  disabled={conn === "connecting"}
                  className={`btn mt-3 text-sm ${
                    joinInput.trim() && isValidJoinId(joinInput) && name.trim()
                      ? "btn-primary"
                      : "btn-ghost"
                  }`}
                >
                  {conn === "connecting" ? "Joining…" : "Join"}
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-muted">
                Enter your friend's duel code (WORD-WORD-DD).
              </p>
            </div>
            {/* M5 rejoin-contract fix — solo restart-by-design note: shown
                ONCE, briefly, right after a mid-run solo refresh cleared the
                run. Neutral informational copy, NEVER a red banner. */}
            {soloRestartNote && (
              <p className="mt-3 text-center text-xs text-muted">
                Solo games restart on refresh.
              </p>
            )}
          </div>
          )
        ) : (
          <div className="w-full anim-fade-in">
            {/* UX v3 kill list: NO top-bar chrome on game screens — the
                SOLO/DUEL pseudo-chips and the QUIT/Leave buttons are gone
                (mode is implied by the stake-line prefix; results own
                PLAY AGAIN/HOME; the ghost walk link + confirm dialog is the
                question-screen exit). */}

            {standings ? (
              <Results
                standings={standings}
                mySeat={seat}
                mode={mode}
                lifelinesUsed={
                  Object.values(lifelinesUsed).filter(Boolean).length
                }
                journey={journey}
                sessionTotals={roomTotals}
                playAgainPending={replayPending}
                onPlayAgain={handlePlayAgain}
                onHome={handleLeave}
              />
            ) : runEnd && fallOverlay === null ? (
              spectating && opponent ? (
                /* UX v3 wave 5a — SPECTATE (screen-by-screen reflow): the
                    lapsed seat's screen while the survivor climbs — the
                    compact fallen card + the live rival strip (driven by
                    the wave-4 `opponent_progress` public facts) + the
                    complete journey. NO question plate (a lapsed seat
                    cannot answer), NO reveal overlays (the survivor's
                    reveal is per-answer and private). */
                <SpectateView
                  title={runEndCopy?.title ?? RUN_END_FALLBACK.title}
                  titleCls={runEndCopy?.cls ?? RUN_END_FALLBACK.cls}
                  amount={runEnd.amount}
                  walked={runEnd.status === "walked"}
                  rivalName={opponent.name}
                  rivalAmount={opponent.amount}
                  rivalLevelReached={opponent.levelReached}
                  rivalCurrentLevel={spectateLevel}
                  journey={journey}
                />
              ) : (
              /* Run-end INTERIM (pre-game_over): headline + hero amount; the
                  solo CONTINUE beat still holds it (logic untouched). UX v3:
                  no chrome, no actions — the results screen owns them.
                  Wave 2: during the FALL choreography the interims stays
                  gated (`fallOverlay`) — the tree slide-down/shatter plays
                  over the dimmed question plate first, then this transitions
                  in (its own anim-fade-in). */
              <div className="w-full">
                <div className="plate relative w-full overflow-hidden p-6 text-center anim-fade-in">
                  {runEnd?.status === "fallen" && (
                    <div
                      className="fall-vignette pointer-events-none absolute inset-0"
                      aria-hidden
                    />
                  )}
                  <div className="relative">
                    <p
                      className={`font-display text-2xl font-black tracking-wide ${runEndCopy?.cls ?? RUN_END_FALLBACK.cls}`}
                    >
                      {runEndCopy?.title ?? RUN_END_FALLBACK.title}
                    </p>
                    <p className="mt-3 text-4xl font-black font-mono text-gold-300">
                      {GBP(runEnd.amount)}
                    </p>
                    <p className="mt-3 text-xs text-muted">
                      {runEndCopy?.hint ?? RUN_END_FALLBACK.hint}
                    </p>
                  </div>
                </div>
                {continueBar}
              </div>
              )
            ) : started && question ? (
              /* UX v3 question screen: stake line on top (mode prefix +
                  QUESTION N OF 15 + the money at stake), plate, options,
                  lifelines row, ghost walk link. The ladder only rides as
                  the DESKTOP (md:) rail — on mobile it lives in the wave-2
                  reveal overlay. NO activity log, NO top-bar quit. */
              <div className="flex w-full flex-col md:flex-row md:gap-5">
                {/* Desktop ladder rail only (UX v3 kill list: the mobile
                    question-screen ladder AND its "▼ Full ladder" toggle
                    are gone; the full ladder returns in wave 2's overlay). */}
                <div className="hidden md:block md:w-44 shrink-0 md:order-1">
                  <MoneyLadder
                    currentLevel={ladder.currentLevel}
                    levelReached={ladder.levelReached}
                    status={ladder.status}
                  />
                </div>

                <div className="min-w-0 flex-1 md:order-2">
                  {/* Top stake line (mobile compact — the ladder's money
                      context in two lines; desktop keeps the rail too). */}
                  <div className="mb-3 text-center" role="status" aria-live="polite">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-400">
                      {mode === "solo" ? "Solo" : "Duel"} · Question{" "}
                      {question.level} of 15
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Playing for{" "}
                      <span className="font-black text-gold-300">
                        {GBP(amountAt(question.level))}
                      </span>{" "}
                      · falls to{" "}
                      <span className="font-black text-safe">
                        {GBP(amountAt(ladder.levelReached))}
                      </span>{" "}
                      SAFE
                    </p>
                  </div>

                  {/* Duel: slim turn indicator — tap for the rival sheet. */}
                  {mode === "duel" && opponent && (
                    <div className="mb-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setRivalSheetOpen(true)}
                        className="turn-pill"
                        aria-haspopup="dialog"
                      >
                        <span className="text-safe">You</span>
                        <span aria-hidden>◆</span>
                        <span className="text-slate-300">{opponent.name}</span>
                      </button>
                    </div>
                  )}

                  <Timer
                    endsAt={question.endsAt}
                    budgetSeconds={budgetSeconds(question.level)}
                  />

                  <QuestionCard
                    level={question.level}
                    question={question.text}
                    options={question.options}
                    removedOptions={removedOptions}
                    chosenIndex={chosenIndex}
                    reveal={reveal}
                    // M2 review finding 3: card interactivity is gated on the
                    // run being active, not just on chosen/reveal locks.
                    disabled={ladder.status !== "active"}
                    onSelect={handleAnswer}
                  />
                  {continueBar}

                  {/* Lifelines row (circles) sits under the options (UX v3
                      screen order); the audience poll renders beneath it. */}
                  <div className="mt-4">
                    <Lifelines
                      used={lifelinesUsed}
                      pending={pendingLifeline}
                      disabled={!canUseLifelines}
                      onUse={handleLifeline}
                    />
                  </div>
                  {audience && <AudienceChart percentages={audience} />}

                  {/* Ghost walk-away link at the bottom (opens the confirm
                      dialog — the irreversible-money two-step is kept). */}
                  {canWalk && ladder.currentLevel >= 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmWalk(true)}
                      className="link-ghost mt-4 min-h-[44px] w-full py-3"
                    >
                      Walk away · {GBP(amountAt(ladder.levelReached))}
                    </button>
                  )}
                </div>
              </div>
            ) : mode === "duel" ? (
              /* DUEL LOBBY (UX v3 + wave 5b deferred start): professional
                  code card — "Share this code" + big copy button + the code —
                  and the per-seat waiting state (seat 1 also owns the gold
                  START once both seats are in). NO log lines. */
              <div className="w-full anim-fade-in">
                <div className="plate p-6 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-400">
                    Share this code
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {seat === 1
                      ? "You're hosting — your rival joins with this code."
                      : "You joined — the game starts when the host begins."}
                  </p>
                  <p className="mt-4 font-mono text-2xl font-black tracking-wider text-gold-300">
                    {roomCode ?? "…"}
                  </p>
                  {/* M7: the surfaced CODE (the uuid is NEVER used in its
                      place); only the host shares, so only they get the
                      big copy affordance. */}
                  {seat === 1 && roomCode && (
                    <button
                      onClick={copyRoomId}
                      className="btn btn-primary mt-4 text-sm"
                    >
                      {copied === "ok"
                        ? "✓ Copied"
                        : copied === "failed"
                          ? "Copy failed"
                          : "Copy code"}
                    </button>
                  )}
                  {/* WAVE 6 / wave-4B: the room's per-seat SESSION totals
                      on the rematch/lobby card. `roomTotals` is null for a
                      history-less room (the `totals` key is OMITTED) and
                      sparse otherwise — SessionTotals renders nothing / only
                      the rows that exist, so a half-finished duel seat is
                      never shown as a fabricated zero. */}
                  <SessionTotals
                    totals={roomTotals}
                    names={lobbyNames}
                    className="mt-5 border-t border-gold-500/20 pt-4"
                  />
                  {/* UX v3 wave 5b — DEFERRED DUEL START waiting state:
                      per-seat copy driven by who is in the lobby. Seat 1
                      (host): "waiting for a second player" until seat 2's
                      join lands (player_joined / the room_state snapshot),
                      then "Ready — start the duel!" + the gold START
                      button; seat 2 (joiner): "Waiting for <host> to
                      start…" — the host's name arrives with the same
                      facts. The backend rejects a half-full start (409),
                      so the button renders ONLY once the rival is known. */}
                  <div
                    className="mt-6 flex items-center justify-center gap-2"
                    role="status"
                  >
                    <span
                      className="h-2 w-2 animate-pulse rounded-full bg-gold-400"
                      aria-hidden
                    />
                    <span
                      className="h-2 w-2 animate-pulse rounded-full bg-gold-400 [animation-delay:250ms]"
                      aria-hidden
                    />
                    <span
                      className="h-2 w-2 animate-pulse rounded-full bg-gold-400 [animation-delay:500ms]"
                      aria-hidden
                    />
                    <p className="ml-1 text-sm text-muted">
                      {seat === 1
                        ? opponent
                          ? "Ready — start the duel!"
                          : "Waiting for a second player…"
                        : opponent
                          ? `Waiting for ${opponent.name} to start…`
                          : "Waiting for the host to start…"}
                    </p>
                  </div>
                  {/* UX v3 wave 5b — the HOST's START (gold, prominent):
                      flips the lobby to a live game via POST /start {token};
                      the `game_started` broadcast (both seats) drives the
                      game flow exactly as the old auto-start did. */}
                  {seat === 1 && opponent && (
                    <button
                      type="button"
                      onClick={handleStartDuel}
                      disabled={startPending}
                      className="btn btn-primary mt-5 text-xl"
                    >
                      {startPending ? "Starting…" : "Start the duel"}
                    </button>
                  )}
                </div>
                {/* Lobby escape — the only exit before questions exist; the
                    question/results screens carry NO top-bar quit (UX v3). */}
                <button
                  onClick={handleLeave}
                  className="link-ghost mt-4 min-h-[44px] w-full py-3"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="w-full">
                <div className="plate flex flex-col items-center px-6 py-10 anim-fade-in">
                  <div className="mb-3 text-4xl opacity-40" aria-hidden>
                    🎬
                  </div>
                  <p className="text-center text-sm text-muted">
                    Stepping to the podium…
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Walk-away confirm (the irreversible-money two-step, kept): UX v3
          renders it as a modal dialog — the ONLY ✕ chrome anywhere. */}
      {confirmWalk && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-stage-void/80 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm walk away"
        >
          <div className="plate relative w-full max-w-sm p-6 anim-fade-in">
            <button
              type="button"
              onClick={() => setConfirmWalk(false)}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-xl font-black text-slate-400 transition-colors duration-[250ms] hover:bg-stage-800 hover:text-slate-100"
            >
              ✕
            </button>
            <p className="text-center text-base font-semibold text-slate-100">
              Lock in{" "}
              <span className="font-black text-gold-300">
                {GBP(amountAt(ladder.levelReached))}
              </span>{" "}
              and walk away?
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={handleWalk}
                className="btn bg-sky-500 text-stage-950 hover:bg-sky-400"
              >
                Walk
              </button>
              <button
                type="button"
                onClick={() => setConfirmWalk(false)}
                className="btn btn-ghost"
              >
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UX v3 duel rival sheet: the slim turn indicator opens this
          bottom-sheet (rival row status/amount; the reveal strip shows only
          through the approved gate). Tap the backdrop or Close to dismiss. */}
      {rivalSheetOpen && opponent && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-stage-void/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Rival status"
          onClick={() => setRivalSheetOpen(false)}
        >
          <div
            className="anim-sheet-rise w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="plate rounded-b-none border-b-0 px-4 pb-8 pt-4">
              <div
                className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600"
                aria-hidden
              />
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-gold-400">
                  Rival
                </p>
                <button
                  type="button"
                  onClick={() => setRivalSheetOpen(false)}
                  className="link-ghost min-h-[44px]"
                >
                  Close
                </button>
              </div>
              <OpponentPanel
                name={opponent.name}
                status={opponent.status}
                amount={opponent.amount}
                levelReached={opponent.levelReached}
                currentLevel={question ? question.level : 0}
                reveal={gatedRivalReveal}
              />
            </div>
          </div>
        </div>
      )}

      {/* UX v3 wave 2 — the money-tree reveal overlay (the answer lifecycle's
          celebration; wave 3: the visible old→new rung climb + a plain
          fade-in CONTINUE). Sits at z-40 so the walk-confirm / rival-sheet
          dialogs (z-50) keep stacking above it. Decor is pointer-events
          none; the solo CONTINUE rides the existing beat machinery. */}
      {revealTreeView && (
        <RevealTree
          kind={revealTreeView.kind}
          level={revealTreeView.level}
          levelReached={revealTreeView.levelReached}
          amount={revealTreeView.amount}
          safeLevel={revealTreeView.safeLevel}
          isSafeRung={revealTreeView.isSafeRung}
          solo={mode === "solo"}
          showContinue={overlayShowContinue}
          showFallContinue={mode === "solo"}
          onContinue={handleContinue}
          onFallContinue={handleFallContinue}
        />
      )}
    </div>
  );
}

export default App;
