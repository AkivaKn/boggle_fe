import type { GameState } from "./types";
import { WORD_PAIRS } from "./words";

const KEY = "misclue.state.v2";

export function saveState(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("misclue.state.v1");
    if (!raw) return null;
    const s = JSON.parse(raw) as any;
    if (!s?.phase) return null;

    // v1 -> v2 migration: round/scoreTarget were "game within match"
    if (s.gameNumber == null) s.gameNumber = typeof s.round === "number" ? s.round : 1;
    if (s.roundNumber == null) s.roundNumber = 1;
    if (s.totalGames == null) s.totalGames = typeof s.scoreTarget === "number" ? s.scoreTarget : 3;
    if (!Array.isArray(s.matchWinners)) s.matchWinners = [];

    if (s.turnStartSeat == null) {
      const alive = [...(s.players ?? [])].filter((p: any) => p.alive).sort((a: any, b: any) => a.seat - b.seat);
      s.turnStartSeat = alive[0]?.seat ?? 1;
    }
    if (s.selectedCategories == null) s.selectedCategories = s.category ? [s.category] : [];
    if (s.setupTourists == null || s.setupDrifters == null) {
      const tourists = (s.players ?? []).filter((p: any) => p.role === "tourist").length;
      const drifters = (s.players ?? []).filter((p: any) => p.role === "drifter").length;
      s.setupTourists = s.setupTourists ?? tourists;
      s.setupDrifters = s.setupDrifters ?? drifters;
    }
    if (s.revoteCount == null) s.revoteCount = 0;
    if (!Array.isArray(s.usedPairIds)) {
      const current = WORD_PAIRS.find(p => p.native === s.nativeWord && p.tourist === s.touristWord);
      s.usedPairIds = current ? [current.id] : [];
    }

    // Migrate clues/votes/results to include game number
    if (Array.isArray(s.clues)) s.clues = s.clues.map((c: any) => ({ ...c, game: c.game ?? s.gameNumber, round: c.round ?? s.roundNumber }));
    if (Array.isArray(s.votes)) s.votes = s.votes.map((v: any) => ({ ...v, game: v.game ?? s.gameNumber, round: v.round ?? s.roundNumber }));
    if (Array.isArray(s.results)) s.results = s.results.map((r: any) => ({ ...r, game: r.game ?? s.gameNumber, round: r.round ?? s.roundNumber }));

    if (s.phase === "clue") {
      const given = s.clues.filter((c: any) => c.game === s.gameNumber && c.round === s.roundNumber).length;
      const aliveCount = (s.players ?? []).filter((p: any) => p.alive).length;
      s.turnIndex = given < aliveCount ? given : 0;
    }
    if (s.phase === "discussion") {
      s.phase = s.mode === "party" ? "elimination_select" : "vote";
    }
    return s as GameState;
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
