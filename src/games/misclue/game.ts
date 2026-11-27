import { CHARACTERS } from "./characters";
import { WORD_PAIRS, type WordPair } from "./words";
import type { Clue, GameState, Mode, Player, Role, RoundResult, Vote } from "./types";

function uid() { return Math.random().toString(36).slice(2, 10); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

export type SetupConfig = {
  mode: Mode;
  humans: { name: string }[];
  aiCount: number; // solo only
  totalGames: number;
  categories: string[]; // empty = all
  tourists?: number;
  drifters?: number;
};

export function createGame(cfg: SetupConfig): GameState {
  const { pair, usedPairIds } = pickPair(cfg.categories);
  const totalPlayers = cfg.mode === "solo" ? 1 + cfg.aiCount : cfg.humans.length;
  const roleCfg = defaultRoles(totalPlayers);
  const setupTourists = cfg.tourists ?? roleCfg.tourists;
  const setupDrifters = cfg.drifters ?? roleCfg.drifters;
  const roles = assignRoles(totalPlayers, { tourists: setupTourists, drifters: setupDrifters });
  const actualTourists = roles.filter(r => r === "tourist").length;
  const actualDrifters = roles.filter(r => r === "drifter").length;
  const aiChars = shuffle(CHARACTERS).slice(0, cfg.mode === "solo" ? cfg.aiCount : 0);

  const players: Player[] = [];
  // human players
  for (let i = 0; i < cfg.humans.length; i++) {
    const role = roles[i];
    players.push({
      id: uid(), seat: i + 1, name: cfg.humans[i].name || `Player ${i+1}`,
      isAI: false, role, word: wordForRole(role, pair), alive: true, score: 0,
    });
  }
  // AI players (solo)
  for (let i = 0; i < aiChars.length; i++) {
    const seatIndex = cfg.humans.length + i;
    const role = roles[seatIndex];
    const c = aiChars[i];
    players.push({
      id: uid(), seat: seatIndex + 1, name: c.name, isAI: true, characterId: c.id, emoji: c.emoji,
      role, word: wordForRole(role, pair), alive: true, score: 0,
    });
  }

  const turnStartSeat = randomStartSeat(players, true);
  const isSolo = cfg.mode === "solo";
  return {
    mode: cfg.mode,
    phase: isSolo ? "clue" : "reveal",
    gameNumber: 1,
    roundNumber: 1,
    totalGames: cfg.totalGames,
    turnIndex: 0,
    turnStartSeat,
    players,
    clues: [],
    votes: [],
    voteResult: null,
    revoteCount: 0,
    results: [],
    nativeWord: pair.native,
    touristWord: pair.tourist,
    category: pair.category,
    selectedCategories: cfg.categories,
    usedPairIds,
    setupTourists: actualTourists,
    setupDrifters: actualDrifters,
    winner: null,
    matchWinners: [],
    revealIndex: isSolo ? players.length : 0,
    voteIndex: 0,
    discussionSeconds: 90,
    message: null,
  };
}

function pickPair(categories: string[], usedIds: string[] = []): { pair: WordPair; usedPairIds: string[] } {
  const pool = categories.length ? WORD_PAIRS.filter(p => categories.includes(p.category)) : WORD_PAIRS;
  const base = pool.length ? pool : WORD_PAIRS;
  const unused = base.filter(p => !usedIds.includes(p.id));
  const source = unused.length ? unused : base;
  const pair = pick(source);
  return { pair, usedPairIds: unused.length ? [...usedIds, pair.id] : [pair.id] };
}

const ROLE_TABLE: Record<number, { tourists: number; drifters: number }> = {
  3: { tourists: 1, drifters: 0 },
  4: { tourists: 1, drifters: 0 },
  5: { tourists: 1, drifters: 1 },
  6: { tourists: 1, drifters: 1 },
  7: { tourists: 2, drifters: 1 },
  8: { tourists: 2, drifters: 1 },
  9: { tourists: 3, drifters: 1 },
  10: { tourists: 3, drifters: 1 },
  11: { tourists: 3, drifters: 2 },
  12: { tourists: 3, drifters: 2 },
  13: { tourists: 4, drifters: 2 },
  14: { tourists: 4, drifters: 2 },
  15: { tourists: 5, drifters: 2 },
  16: { tourists: 5, drifters: 2 },
  17: { tourists: 5, drifters: 3 },
  18: { tourists: 5, drifters: 3 },
  19: { tourists: 5, drifters: 4 },
  20: { tourists: 6, drifters: 3 },
};

export function defaultRoles(n: number): { natives: number; tourists: number; drifters: number } {
  const clamped = Math.max(3, Math.min(20, n));
  const base = ROLE_TABLE[clamped] ?? ROLE_TABLE[20];
  const tourists = base.tourists;
  const drifters = base.drifters;
  const natives = Math.max(1, clamped - tourists - drifters);
  return { natives, tourists, drifters };
}

export function assignRoles(n: number, overrides?: { tourists?: number; drifters?: number }): Role[] {
  const total = Math.max(3, Math.min(20, n));
  const defaults = defaultRoles(total);
  let tourists = Math.max(0, Math.floor(overrides?.tourists ?? defaults.tourists));
  let drifters = Math.max(0, Math.floor(overrides?.drifters ?? defaults.drifters));
  if (tourists + drifters < 1) tourists = 1;
  // Infiltrators only win on a majority, so 50/50 is allowed; natives must not be outnumbered.
  const maxInfiltrators = Math.max(1, Math.floor(total / 2));
  if (tourists + drifters > maxInfiltrators) {
    let overflow = tourists + drifters - maxInfiltrators;
    const reduceTourists = Math.min(tourists, overflow);
    tourists -= reduceTourists;
    overflow -= reduceTourists;
    if (overflow > 0) drifters = Math.max(0, drifters - overflow);
  }
  if (tourists + drifters < 1) tourists = 1;
  const natives = total - tourists - drifters;
  const roles: Role[] = [
    ...Array(natives).fill("native"),
    ...Array(tourists).fill("tourist"),
    ...Array(drifters).fill("drifter"),
  ].slice(0, total);
  if (!roles.includes("native")) roles[0] = "native";
  return shuffle(roles);
}

function wordForRole(role: Role, pair: WordPair): string {
  if (role === "native") return pair.native;
  if (role === "tourist") return pair.tourist;
  return "";
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
}

export function currentTurnPlayer(state: GameState): Player | null {
  const alive = alivePlayers(state);
  if (alive.length === 0) return null;
  const start = clueTurnIndex(state);
  return alive[(start + state.turnIndex) % alive.length] ?? null;
}

function randomStartSeat(players: Player[], avoidDrifter: boolean): number {
  const alive = players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
  const pool = avoidDrifter ? alive.filter(p => p.role !== "drifter") : alive;
  const pickFrom = pool.length ? pool : alive;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)]?.seat ?? alive[0]?.seat ?? 1;
}

function rotateStartSeat(players: Player[], prevSeat: number): number {
  const alive = players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
  if (alive.length === 0) return prevSeat;
  const idx = alive.findIndex(p => p.seat === prevSeat);
  const next = idx >= 0 ? alive[(idx + 1) % alive.length] : alive[0];
  return next.seat;
}

export function clueTurnIndex(state: Pick<GameState, "players" | "gameNumber" | "roundNumber" | "turnStartSeat">): number {
  const alive = state.players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
  if (alive.length === 0) return 0;
  let startSeat = state.turnStartSeat;
  if (state.gameNumber === 1 && state.roundNumber === 1) {
    const starter = alive.find(p => p.seat === startSeat);
    if (starter?.role === "drifter") {
      const safe = alive.find(p => p.role !== "drifter");
      if (safe) startSeat = safe.seat;
    }
  }
  const idx = alive.findIndex(p => p.seat === startSeat);
  return idx >= 0 ? idx : 0;
}

export function advanceReveal(state: GameState): GameState {
  const next = state.revealIndex + 1;
  if (next >= state.players.length) {
    return { ...state, revealIndex: next, phase: "clue" as const, turnIndex: 0, message: null };
  }
  return { ...state, revealIndex: next };
}

export function submitClue(state: GameState, seat: number, text: string): GameState {
  if (state.phase !== "clue") return state;
  const alive = alivePlayers(state);
  const current = currentTurnPlayer(state);
  if (!current || current.seat !== seat) return state;
  const player = state.players.find(p => p.seat === seat);
  if (!player || !player.alive) return state;
  const clue: Clue = { game: state.gameNumber, round: state.roundNumber, turn: state.clues.filter(c=>c.game===state.gameNumber && c.round===state.roundNumber).length + 1, seat, name: player.name, text: text.trim() };
  const clues = [...state.clues, clue];
  let turnIndex = state.turnIndex + 1;
  let phase: GameState["phase"] = "clue";
  let voteIndex = state.voteIndex;
  if (turnIndex >= alive.length) {
    phase = state.mode === "party" ? "elimination_select" : "vote";
    turnIndex = 0;
    voteIndex = 0;
  }
  return { ...state, clues, turnIndex, phase, voteIndex, message: null };
}

export function finishClueRound(state: GameState): GameState {
  if (state.phase !== "clue") return state;
  return {
    ...state,
    phase: state.mode === "party" ? "elimination_select" : "vote",
    turnIndex: 0,
    voteIndex: 0,
    message: null,
  };
}

export function startVote(state: GameState): GameState {
  return { ...state, phase: "vote", turnIndex: 0, voteIndex: 0, revoteCount: 0, voteResult: null, votes: state.votes.filter(v => !(v.game===state.gameNumber && v.round===state.roundNumber)), message: null };
}

export function submitVote(state: GameState, voterSeat: number, targetSeat: number): GameState {
  if (state.phase !== "vote") return state;
  if (voterSeat === targetSeat) return state;
  const voter = state.players.find(p=>p.seat===voterSeat && p.alive);
  const target = state.players.find(p=>p.seat===targetSeat && p.alive);
  if (!voter || !target) return state;
  const votes = [...state.votes.filter(v => !(v.game===state.gameNumber && v.round===state.roundNumber && v.voterSeat===voterSeat)), { game: state.gameNumber, round: state.roundNumber, voterSeat, targetSeat } as Vote];
  const alive = alivePlayers(state);
  const roundVotes = votes.filter(v=>v.game===state.gameNumber && v.round===state.roundNumber);
  if (roundVotes.length < alive.length) {
    return { ...state, votes, voteIndex: state.voteIndex + 1 };
  }
  return resolveVotes({ ...state, votes, voteIndex: state.voteIndex + 1 });
}

function resolveVotes(state: GameState): GameState {
  const roundVotes = state.votes.filter(v => v.game === state.gameNumber && v.round === state.roundNumber);
  const counts = new Map<number, number>();
  for (const v of roundVotes) counts.set(v.targetSeat, (counts.get(v.targetSeat) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) max = Math.max(max, c);
  const top = [...counts.entries()].filter(([,c]) => c === max).map(([s]) => s);
  if (top.length !== 1) {
    if ((state.revoteCount ?? 0) < 1) {
      return {
        ...state,
        votes: state.votes.filter(v => !(v.game === state.gameNumber && v.round === state.roundNumber)),
        phase: "vote",
        voteIndex: 0,
        voteResult: null,
        revoteCount: (state.revoteCount ?? 0) + 1,
        message: "Tie vote - revote once.",
      };
    }
    const tieResult: RoundResult = {
      game: state.gameNumber,
      round: state.roundNumber,
      eliminatedSeat: null,
      eliminatedRole: null,
      winner: null,
      summary: "Tie vote again - no one was eliminated.",
    };
    return {
      ...state,
      results: [...state.results, tieResult],
      phase: "reveal_result",
      voteResult: null,
      revoteCount: 0,
      message: tieResult.summary,
    };
  }
  const eliminatedSeat = top[0];
  const countsArr = [...counts.entries()].map(([seat, votes]) => ({ seat, votes })).sort((a,b)=>b.votes-a.votes || a.seat-b.seat);
  const voteResult = { eliminatedSeat, counts: countsArr, votes: roundVotes };
  const eliminated = state.players.find(p => p.seat === eliminatedSeat) ?? null;
  if (!eliminated) return { ...state, phase: "vote_result", voteResult, message: null };

  if (eliminated.role === "drifter") {
    const players = state.players.map(p => p.seat === eliminatedSeat ? { ...p, alive: false } : p);
    return {
      ...state,
      players,
      phase: "vote_result",
      voteResult,
      message: `${eliminated.name} was the Drifter! They get one guess.`,
    };
  }

  const players = state.players.map(p => p.seat === eliminatedSeat ? { ...p, alive: false } : p);
  return finalizeElimination({ ...state, players, voteResult, message: null }, eliminatedSeat, eliminated.role, undefined, undefined);
}

export function confirmVoteResult(state: GameState): GameState {
  const vr = state.voteResult;
  if (!vr) return state;
  const eliminated = state.players.find(p => p.seat === vr.eliminatedSeat) ?? null;
  if (!eliminated) return state;
  const players = state.players.map(p => p.seat === vr.eliminatedSeat ? { ...p, alive: false } : p);
  const nextState = { ...state, players, message: null };
  if (eliminated.role === "drifter") {
    return { ...nextState, phase: "drifter_guess", message: `${eliminated.name} was the Drifter! They get one guess.` };
  }
  return finalizeElimination(nextState, vr.eliminatedSeat, eliminated.role, undefined, undefined);
}

export function selectElimination(state: GameState, eliminatedSeat: number): GameState {
  if (state.phase !== "elimination_select") return state;
  const eliminated = state.players.find(p => p.seat === eliminatedSeat && p.alive) ?? null;
  if (!eliminated) return state;
  const players = state.players.map(p => p.seat === eliminatedSeat ? { ...p, alive: false } : p);
  const nextState = { ...state, players, message: null };
  if (eliminated.role === "drifter") {
    return { ...nextState, phase: "drifter_guess", message: `${eliminated.name} was the Drifter! They get one guess.` };
  }
  return finalizeElimination(nextState, eliminatedSeat, eliminated.role, undefined, undefined);
}

export function submitDrifterGuess(state: GameState, guess: string): GameState {
  const drifter = state.players.find(p => !p.alive && p.role === "drifter" && !state.results.find(r => r.game === state.gameNumber && r.round === state.roundNumber && r.eliminatedSeat === p.seat));
  if (!drifter) return state;
  const correct = normalize(guess) === normalize(state.nativeWord);
  return finalizeElimination(state, drifter.seat, "drifter", guess, correct);
}

function finalizeElimination(state: GameState, eliminatedSeat: number, eliminatedRole: Role, drifterGuess?: string, drifterCorrect?: boolean): GameState {
  let players = [...state.players];
  let winner: RoundResult["winner"] = null;
  let summary = "";
  const eliminated = players.find(p=>p.seat===eliminatedSeat);

  if (eliminatedRole === "drifter" && drifterCorrect) {
    winner = "drifter_steal";
    summary = `${eliminated?.name ?? "Drifter"} guessed the Native word "${state.nativeWord}" and stole the game!`;
    players = players.map(p => p.seat === eliminatedSeat ? { ...p, score: p.score + 4 } : p);
  } else {
    if (eliminatedRole === "drifter" && drifterGuess !== undefined) {
      summary = `${eliminated?.name ?? "Drifter"} guessed "${drifterGuess}" - wrong. `;
    } else {
      summary = `${eliminated?.name ?? "Someone"} was eliminated and was a ${roleLabel(eliminatedRole)}. `;
    }
    winner = checkWinner(players);
    if (winner === "natives") {
      summary += "Natives win the game!";
      players = players.map(p => p.role === "native" ? { ...p, score: p.score + 2 } : p);
    } else if (winner === "infiltrators") {
      summary += "Tourists and Drifters win the game!";
      players = players.map(p => (p.role === "tourist" || p.role === "drifter") ? { ...p, score: p.score + 2 } : p);
    } else {
      summary += "The game continues.";
    }
  }

  const pointsAwarded = winner
    ? players
        .filter(p => (p.score - (state.players.find(sp => sp.seat === p.seat)?.score ?? 0)) !== 0)
        .map(p => ({ seat: p.seat, points: p.score - (state.players.find(sp => sp.seat === p.seat)?.score ?? 0) }))
    : undefined;

  const result: RoundResult = {
    game: state.gameNumber, round: state.roundNumber, eliminatedSeat, eliminatedRole, drifterGuess, drifterCorrect, winner, summary, pointsAwarded,
  };
  const results = [...state.results, result];

  if (winner) {
    if (state.gameNumber >= state.totalGames) {
      const matchWinners = getMatchWinners(players);
      return { ...state, players, results, phase: "match_end", winner, matchWinners, message: summary };
    }
    return { ...state, players, results, phase: "reveal_result", winner, message: summary };
  }
  return { ...state, players, results, phase: "reveal_result", winner, message: summary };
}

function checkWinner(players: Player[]): RoundResult["winner"] {
  const alive = players.filter(p => p.alive);
  const natives = alive.filter(p => p.role === "native").length;
  const infiltrators = alive.filter(p => p.role === "tourist" || p.role === "drifter").length;
  if (infiltrators === 0) return "natives";
  if (infiltrators > natives) return "infiltrators";
  if (alive.length === 2 && infiltrators === 1) return "infiltrators"; // 1v1 endgame
  return null;
}

function getMatchWinners(players: Player[]): number[] {
  const top = Math.max(0, ...players.map(p => p.score));
  return players.filter(p => p.score === top).map(p => p.seat);
}

export function nextClueRound(state: GameState): GameState {
  return {
    ...state,
    phase: "clue",
    roundNumber: state.roundNumber + 1,
    turnIndex: 0,
    voteResult: null,
    revoteCount: 0,
    message: null,
  };
}

export function nextGame(state: GameState): GameState {
  const { pair, usedPairIds } = pickPair(state.selectedCategories, state.usedPairIds);
  const roles = assignRoles(state.players.length);
  const players = state.players.map((p, i) => ({
    ...p, role: roles[i], word: wordForRole(roles[i], pair), alive: true,
  }));
  const turnStartSeat = rotateStartSeat(players, state.turnStartSeat ?? players[0]?.seat ?? 1);
  const isSolo = state.mode === "solo";
  return {
    ...state,
    phase: isSolo ? "clue" : "reveal",
    gameNumber: state.gameNumber + 1,
    roundNumber: 1,
    turnIndex: 0,
    turnStartSeat,
    players,
    clues: [],
    votes: [],
    voteResult: null,
    revoteCount: 0,
    usedPairIds,
    nativeWord: pair.native,
    touristWord: pair.tourist,
    winner: null,
    revealIndex: isSolo ? players.length : 0,
    voteIndex: 0,
    message: null,
  };
}

// Backwards-compatible aliases during refactor
export const continueAfterNoWinner = nextClueRound;
export const nextRound = nextGame;

export function clearRoundClues(state: GameState): GameState {
  return { ...state, clues: [], votes: [] };
}

export function roleLabel(role: Role): string {
  if (role === "native") return "Native";
  if (role === "tourist") return "Tourist";
  return "Drifter";
}

export function roleTeam(role: Role): "Natives" | "Tourists & Drifters" {
  return role === "native" ? "Natives" : "Tourists & Drifters";
}

export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

export function getAiCharacters() { return CHARACTERS; }
