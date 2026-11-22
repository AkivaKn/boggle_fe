import type { SetupConfig, TodLevel } from "./types";

const SETUP_KEY = "truthOrDare.setup.v1";
const LEVELS: TodLevel[] = ["pg", "spicy", "nsfw"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const uid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const defaultSetup = (): SetupConfig => ({
  playerNames: [],
  levels: ["pg"],
  shuffleOrder: true,
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
    const levels = toStringArray(parsed.levels).filter((level): level is TodLevel =>
      LEVELS.includes(level as TodLevel),
    );

    return {
      playerNames,
      levels: levels.length > 0 ? levels : fallback.levels,
      shuffleOrder: parsed.shuffleOrder !== false,
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
