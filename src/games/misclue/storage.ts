import type { GameState } from "./types";
import { WORD_PAIRS } from "./words";

const KEY = "misclue.state.v1";

export function saveState(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as GameState & { turnStartSeat?: number };
    if (!state?.phase) return null;
    if (state.turnStartSeat == null) {
      const alive = [...(state.players ?? [])].filter(p => p.alive).sort((a, b) => a.seat - b.seat);
      state.turnStartSeat = alive[0]?.seat ?? 1;
    }
    if (state.selectedCategories == null) {
      state.selectedCategories = state.category ? [state.category] : [];
    }
    if (state.setupTourists == null || state.setupDrifters == null) {
      const tourists = state.players.filter(p => p.role === "tourist").length;
      const drifters = state.players.filter(p => p.role === "drifter").length;
      state.setupTourists = state.setupTourists ?? tourists;
      state.setupDrifters = state.setupDrifters ?? drifters;
    }
    if (state.revoteCount == null) state.revoteCount = 0;
    if (!Array.isArray(state.usedPairIds)) {
      const current = WORD_PAIRS.find(p => p.native === state.nativeWord && p.tourist === state.touristWord);
      state.usedPairIds = current ? [current.id] : [];
    }
    if (state.phase === "clue") {
      const given = state.clues.filter(c => c.round === state.round).length;
      const aliveCount = state.players.filter(p => p.alive).length;
      state.turnIndex = given < aliveCount ? given : 0;
    }
    if (state.phase === "discussion") {
      state.phase = state.mode === "party" ? "elimination_select" : "vote";
    }
    return state as GameState;
  } catch {
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore storage errors */
  }
}
