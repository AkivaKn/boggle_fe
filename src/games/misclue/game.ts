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
  scoreTarget: number;
  categories: string[]; // empty = all
  tourists?: number;
  drifters?: number;
};

export function createGame(cfg: SetupConfig): GameState {
  const pair = pickPair(cfg.categories);
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

  const turnStartSeat = randomStartSeat(players, 1);
  return {
    mode: cfg.mode,
    phase: "reveal",
    round: 1,
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
    scoreTarget: cfg.scoreTarget,
    setupTourists: actualTourists,
    setupDrifters: actualDrifters,
    winner: null,
    revealIndex: 0,
    voteIndex: 0,
    discussionSeconds: 90,
    message: null,
  };
}

function pickPair(categories: string[]): WordPair {
  const pool = categories.length ? WORD_PAIRS.filter(p => categories.includes(p.category)) : WORD_PAIRS;
  return pick(pool.length ? pool : WORD_PAIRS);
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
  return alive[state.turnIndex] ?? null;
}

function randomStartSeat(players: Player[], round: number): number {
  const alive = players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
  const pool = round === 1 ? alive.filter(p => p.role !== "drifter") : alive;
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

export function clueTurnIndex(state: Pick<GameState, "players" | "round" | "turnStartSeat">): number {
  const alive = state.players.filter(p => p.alive).sort((a,b)=>a.seat-b.seat);
  if (alive.length === 0) return 0;
  let startSeat = state.turnStartSeat;
  if (state.round === 1) {
    const starter = alive.find(p => p.seat === startSeat);
    if (starter?.role === "drifter") {
      const safe = alive.find(p => p.role !== "drifter");
      if (safe) startSeat = safe.seat;
    }
  }
  const idx = alive.findIndex(p => p.seat === startSeat);
  return idx >= 0 ? idx : 0;
}

export function firstClueTurnIndex(state: Pick<GameState, "players" | "round"> & { turnStartSeat?: number }): number {
  return clueTurnIndex({ ...state, turnStartSeat: state.turnStartSeat ?? state.players.filter(p=>p.alive).sort((a,b)=>a.seat-b.seat)[0]?.seat ?? 1 });
}

export function advanceReveal(state: GameState): GameState {
  const next = state.revealIndex + 1;
  if (next >= state.players.length) {
    const nextState = { ...state, revealIndex: next, phase: "clue" as const, turnIndex: 0, message: null };
    return { ...nextState, turnIndex: firstClueTurnIndex(nextState) };
  }
  return { ...state, revealIndex: next };
}

export function submitClue(state: GameState, seat: number, text: string): GameState {
  if (state.phase !== "clue") return state;
  const alive = alivePlayers(state);
  const current = alive[state.turnIndex];
  if (!current || current.seat !== seat) return state;
  const player = state.players.find(p => p.seat === seat);
  if (!player || !player.alive) return state;
  const clue: Clue = { round: state.round, turn: state.clues.filter(c=>c.round===state.round).length + 1, seat, name: player.name, text: text.trim() };
  const clues = [...state.clues, clue];
  let turnIndex = state.turnIndex + 1;
  let phase: GameState["phase"] = "clue";
  let voteIndex = state.voteIndex;
  if (turnIndex >= alive.length) {
    phase = state.mode === "party" ? "discussion" : "vote";
    turnIndex = 0;
    voteIndex = 0;
  }
  return { ...state, clues, turnIndex, phase, voteIndex, message: null };
}

export function startVote(state: GameState): GameState {
  return { ...state, phase: "vote", turnIndex: 0, voteIndex: 0, revoteCount: 0, voteResult: null, votes: state.votes.filter(v => v.round !== state.round), message: null };
}

export function submitVote(state: GameState, voterSeat: number, targetSeat: number): GameState {
  if (state.phase !== "vote") return state;
  if (voterSeat === targetSeat) return state;
  const voter = state.players.find(p=>p.seat===voterSeat && p.alive);
  const target = state.players.find(p=>p.seat===targetSeat && p.alive);
  if (!voter || !target) return state;
  const votes = [...state.votes.filter(v => !(v.round===state.round && v.voterSeat===voterSeat)), { round: state.round, voterSeat, targetSeat } as Vote];
  const alive = alivePlayers(state);
  const roundVotes = votes.filter(v=>v.round===state.round);
  if (roundVotes.length < alive.length) {
    return { ...state, votes, voteIndex: state.voteIndex + 1 };
  }
  return resolveVotes({ ...state, votes, voteIndex: state.voteIndex + 1 });
}

function resolveVotes(state: GameState): GameState {
  const roundVotes = state.votes.filter(v => v.round === state.round);
  const counts = new Map<number, number>();
  for (const v of roundVotes) counts.set(v.targetSeat, (counts.get(v.targetSeat) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) max = Math.max(max, c);
  const top = [...counts.entries()].filter(([,c]) => c === max).map(([s]) => s);
  if (top.length !== 1) {
    if ((state.revoteCount ?? 0) < 1) {
      return {
        ...state,
        votes: state.votes.filter(v => v.round !== state.round),
        phase: "vote",
        voteIndex: 0,
        voteResult: null,
        revoteCount: (state.revoteCount ?? 0) + 1,
        message: "Tie vote - revote once.",
      };
    }
    const tieResult: RoundResult = {
      round: state.round,
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
  const drifter = state.players.find(p => !p.alive && p.role === "drifter" && !state.results.find(r => r.round === state.round && r.eliminatedSeat === p.seat));
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
    summary = `${eliminated?.name ?? "Drifter"} guessed the Native word "${state.nativeWord}" and stole the round!`;
    players = players.map(p => p.role === "drifter" ? { ...p, score: p.score + 2 } : p);
  } else {
    if (eliminatedRole === "drifter" && drifterGuess !== undefined) {
      summary = `${eliminated?.name ?? "Drifter"} guessed "${drifterGuess}" - wrong! The Native word was "${state.nativeWord}". `;
    } else {
      summary = `${eliminated?.name ?? "Someone"} was eliminated and was a ${roleLabel(eliminatedRole)}. `;
    }
    winner = checkWinner(players);
    if (winner === "natives") {
      summary += "Natives win the round!";
      players = players.map(p => p.role === "native" ? { ...p, score: p.score + 1 } : p);
    } else if (winner === "infiltrators") {
      summary += "Tourists and Drifters win the round!";
      players = players.map(p => (p.role === "tourist" || p.role === "drifter") ? { ...p, score: p.score + 1 } : p);
    } else {
      summary += "The game continues.";
    }
  }

  const result: RoundResult = {
    round: state.round, eliminatedSeat, eliminatedRole, drifterGuess, drifterCorrect, winner, summary,
  };
  const results = [...state.results, result];

  const matchWinner = getMatchWinner(players, state.scoreTarget);
  if (winner && matchWinner) {
    return { ...state, players, results, phase: "match_end", winner: matchWinner, message: summary };
  }
  return { ...state, players, results, phase: "reveal_result", winner, message: summary };
}

function checkWinner(players: Player[]): RoundResult["winner"] {
  const alive = players.filter(p => p.alive);
  const natives = alive.filter(p => p.role === "native").length;
  const infiltrators = alive.filter(p => p.role === "tourist" || p.role === "drifter").length;
  if (infiltrators === 0) return "natives";
  if (infiltrators > natives) return "infiltrators";
  return null;
}

function getMatchWinner(players: Player[], target: number): RoundResult["winner"] {
  const nativeScore = Math.max(0, ...players.filter(p=>p.role==="native").map(p=>p.score));
  const infScore = Math.max(0, ...players.filter(p=>p.role==="tourist"||p.role==="drifter").map(p=>p.score));
  // simple: if any team reached target - determine by who reached. Use team max.
  const nativeWon = players.some(p=>p.role==="native" && p.score>=target);
  const infWon = players.some(p=>(p.role==="tourist"||p.role==="drifter") && p.score>=target);
  if (nativeWon && infWon) return nativeScore >= infScore ? "natives" : "infiltrators";
  if (nativeWon) return "natives";
  if (infWon) return "infiltrators";
  return null;
}

export function continueAfterNoWinner(state: GameState): GameState {
  return {
    ...state,
    phase: "clue",
    turnIndex: clueTurnIndex({ ...state, turnStartSeat: state.turnStartSeat }),
    votes: state.votes.filter(v => v.round !== state.round),
    voteResult: null,
    revoteCount: 0,
    message: null,
  };
}

export function nextRound(state: GameState): GameState {
  const pair = pickPair(state.category ? [state.category] : []);
  const roles = assignRoles(state.players.length);
  const players = state.players.map((p, i) => ({
    ...p, role: roles[i], word: wordForRole(roles[i], pair), alive: true,
  }));
  const turnStartSeat = rotateStartSeat(players, state.turnStartSeat ?? players[0]?.seat ?? 1);
  return {
    ...state,
    phase: "reveal",
    round: state.round + 1,
    turnIndex: 0,
    turnStartSeat,
    players,
    clues: [],
    votes: [],
    voteResult: null,
    revoteCount: 0,
    nativeWord: pair.native,
    touristWord: pair.tourist,
    winner: null,
    revealIndex: 0,
    voteIndex: 0,
    message: null,
  };
}

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
