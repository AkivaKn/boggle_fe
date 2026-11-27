import type { GameState } from "./types";

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
