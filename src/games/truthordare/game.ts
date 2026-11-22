import { PROMPTS } from "./prompts";
import type { ActiveGame, SetupConfig, TodKind, TodLevel } from "./types";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 18;

const LEVEL_ORDER: TodLevel[] = ["pg", "spicy", "nsfw"];

export const LEVEL_META: Record<
  TodLevel,
  { label: string; rating: string; description: string }
> = {
  pg: {
    label: "PG",
    rating: "All ages",
    description: "Silly truths and harmless dares for any group.",
  },
  spicy: {
    label: "Spicy",
    rating: "15+",
    description: "Cheeky, flirty and a little embarrassing.",
  },
  nsfw: {
    label: "NSFW",
    rating: "18+",
    description: "Adult themes. Only for grown-up groups.",
  },
};

const shuffle = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

export const createGame = (config: SetupConfig): ActiveGame => {
  const players = config.playerNames.map((name, index) => ({
    id: `player-${index + 1}`,
    name,
  }));
  const order = players.map((player) => player.id);
  return {
    players,
    levels: LEVEL_ORDER.filter((level) => config.levels.includes(level)),
    order: config.shuffleOrder ? shuffle(order) : order,
    turnIndex: 0,
    turnNumber: 1,
    completedTurns: 0,
    used: { truth: [], dare: [] },
    currentPrompt: null,
    stage: "choose",
    drinkingMode: config.drinkingMode,
  };
};

export const currentPlayer = (game: ActiveGame) =>
  game.players.find((player) => player.id === game.order[game.turnIndex]) ??
  game.players[0];

export const drawPrompt = (
  game: ActiveGame,
  kind: TodKind,
  excludeId?: string,
): ActiveGame => {
  const available = PROMPTS.filter(
    (prompt) =>
      prompt.kind === kind &&
      (!prompt.drinking || game.drinkingMode) &&
      (game.levels.includes(prompt.level) || (prompt.drinking && game.drinkingMode)),
  );
  let used = game.used[kind];
  let candidates = available.filter(
    (prompt) => !used.includes(prompt.id) && prompt.id !== excludeId,
  );
  if (candidates.length === 0) {
    used = [];
    candidates = available.filter((prompt) => prompt.id !== excludeId);
    if (candidates.length === 0) candidates = available;
  }
  if (candidates.length === 0) return game;

  const prompt = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    ...game,
    used: { ...game.used, [kind]: [...used, prompt.id] },
    currentPrompt: prompt,
    stage: "prompt",
  };
};

export const nextTurn = (game: ActiveGame): ActiveGame => ({
  ...game,
  turnIndex: (game.turnIndex + 1) % game.players.length,
  turnNumber: game.turnNumber + 1,
  completedTurns: game.completedTurns + 1,
  currentPrompt: null,
  stage: "choose",
});

export const forfeitPrompt = (game: ActiveGame): ActiveGame => nextTurn(game);

export const finishGame = (game: ActiveGame): ActiveGame => ({
  ...game,
  currentPrompt: null,
  stage: "final",
});

export const restartGame = (game: ActiveGame): ActiveGame =>
  createGame({
    playerNames: game.players.map((player) => player.name),
    levels: game.levels,
    shuffleOrder: true,
    drinkingMode: game.drinkingMode,
  });
