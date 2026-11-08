import type { Deck, SetupConfig } from "./types";

const DECKS_KEY = "foreheadCharades.customDecks.v1";
const SETUP_KEY = "foreheadCharades.setup.v1";
const MIN_CUSTOM_WORDS = 10;
const MAX_CUSTOM_WORDS = 500;
const MAX_CUSTOM_DECKS = 30;
const TURN_SECONDS = [30, 60, 90, 120];

export const MIN_WORDS = MIN_CUSTOM_WORDS;
export const MAX_WORDS = MAX_CUSTOM_WORDS;

export const uid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sanitizeWords = (raw: string): string[] => {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const piece of raw.split(/[\n,]+/)) {
    const word = piece.trim().replace(/\s+/g, " ");
    if (!word) continue;
    const key = word.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= MAX_CUSTOM_WORDS) break;
  }
  return words;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const parseDeck = (value: unknown): Deck | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }
  const words = sanitizeWords(toStringArray(value.words).join("\n"));
  if (words.length < MIN_CUSTOM_WORDS) return null;
  return {
    id: value.id,
    name: value.name.trim() || "Custom deck",
    emoji: typeof value.emoji === "string" && value.emoji ? value.emoji : "🎲",
    words,
    builtin: false,
  };
};

export const loadCustomDecks = (): Deck[] => {
  try {
    const raw = window.localStorage.getItem(DECKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseDeck)
      .filter((deck): deck is Deck => deck !== null)
      .slice(0, MAX_CUSTOM_DECKS);
  } catch {
    return [];
  }
};

export const saveCustomDecks = (decks: Deck[]): void => {
  try {
    window.localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  } catch {
    return;
  }
};

export const defaultSetup = (): SetupConfig => ({
  playerNames: [],
  deckIds: ["animals"],
  turnSeconds: 60,
  shuffleOrder: false,
});

export const loadSetup = (): SetupConfig => {
  const fallback = defaultSetup();
  try {
    const raw = window.localStorage.getItem(SETUP_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const playerNames = toStringArray(parsed.playerNames)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 12);
    const deckIds = toStringArray(parsed.deckIds).slice(0, MAX_CUSTOM_DECKS + 8);
    const turnSeconds =
      typeof parsed.turnSeconds === "number" &&
      TURN_SECONDS.includes(parsed.turnSeconds)
        ? parsed.turnSeconds
        : fallback.turnSeconds;
    return {
      playerNames,
      deckIds: deckIds.length ? deckIds : fallback.deckIds,
      turnSeconds,
      shuffleOrder: parsed.shuffleOrder === true,
    };
  } catch {
    return fallback;
  }
};

export const saveSetup = (setup: SetupConfig): void => {
  try {
    window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    return;
  }
};
