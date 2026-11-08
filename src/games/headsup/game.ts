import type {
  ActiveGame,
  Deck,
  Player,
  Ranking,
  TiltGesture,
  TurnTally,
} from "./types";

export const shuffle = <T>(input: readonly T[]): T[] => {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const buildPool = (decks: readonly Deck[]): string[] => {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const deck of decks) {
    for (const raw of deck.words) {
      const word = raw.trim().replace(/\s+/g, " ");
      if (!word) continue;
      const key = word.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(word);
    }
  }
  return shuffle(words);
};

const emptyTally = (): TurnTally => ({ correct: 0, passed: 0 });

export const createGame = (options: {
  players: Player[];
  decks: Deck[];
  turnSeconds: number;
  shuffleOrder: boolean;
}): ActiveGame => {
  const pool = buildPool(options.decks);
  if (pool.length === 0) {
    throw new Error("Cannot start a game without words");
  }
  const players = options.shuffleOrder
    ? shuffle(options.players)
    : [...options.players];
  const scores: Record<string, TurnTally> = {};
  for (const player of players) scores[player.id] = emptyTally();

  return {
    players,
    deckIds: options.decks.map((deck) => deck.id),
    turnSeconds: options.turnSeconds,
    pool,
    cursor: 0,
    turnIndex: 0,
    stage: "intro",
    turn: emptyTally(),
    scores,
  };
};

export const currentPlayer = (game: ActiveGame): Player =>
  game.players[game.turnIndex];

export const currentWord = (game: ActiveGame): string =>
  game.pool[game.cursor] ?? "Get ready!";

const advance = (
  pool: string[],
  cursor: number,
): { pool: string[]; cursor: number } => {
  if (pool.length <= 1) return { pool, cursor: 0 };
  const next = cursor + 1;
  if (next < pool.length) return { pool, cursor: next };

  const last = pool[cursor];
  const reshuffled = shuffle(pool);
  if (reshuffled[0] === last) {
    [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
  }
  return { pool: reshuffled, cursor: 0 };
};

export const applyGesture = (
  game: ActiveGame,
  gesture: TiltGesture,
): ActiveGame => {
  if (game.stage !== "playing") return game;
  const turn: TurnTally =
    gesture === "correct"
      ? { ...game.turn, correct: game.turn.correct + 1 }
      : { ...game.turn, passed: game.turn.passed + 1 };
  const next = advance(game.pool, game.cursor);
  return { ...game, turn, pool: next.pool, cursor: next.cursor };
};

export const MAX_PLAYERS = 12;
export const MAX_PLAYER_NAME_LENGTH = 20;

export const renamePlayer = (
  game: ActiveGame,
  playerId: string,
  name: string,
): ActiveGame => ({
  ...game,
  players: game.players.map((player) =>
    player.id === playerId ? { ...player, name } : player,
  ),
});

export const addPlayer = (game: ActiveGame, player: Player): ActiveGame => {
  if (game.players.length >= MAX_PLAYERS) return game;
  const players = [...game.players, player];
  const scores = { ...game.scores, [player.id]: emptyTally() };
  if (game.stage === "final") {
    return {
      ...game,
      players,
      scores,
      turnIndex: players.length - 1,
      stage: "intro",
      turn: emptyTally(),
    };
  }
  return { ...game, players, scores };
};

export const finishTurn = (game: ActiveGame): ActiveGame => {
  if (game.stage !== "playing") return game;
  const player = currentPlayer(game);
  const isLast = game.turnIndex >= game.players.length - 1;
  return {
    ...game,
    scores: { ...game.scores, [player.id]: game.turn },
    stage: isLast ? "final" : "summary",
  };
};

export const nextTurn = (game: ActiveGame): ActiveGame => {
  if (game.stage !== "summary") return game;
  return {
    ...game,
    turnIndex: game.turnIndex + 1,
    stage: "intro",
    turn: emptyTally(),
  };
};

export const rankPlayers = (game: ActiveGame): Ranking[] => {
  const rows = game.players
    .map((player) => ({
      player,
      score: game.scores[player.id] ?? emptyTally(),
    }))
    .sort(
      (a, b) =>
        b.score.correct - a.score.correct ||
        a.player.name.localeCompare(b.player.name),
    );

  return rows.map((row) => ({
    ...row,
    rank:
      rows.findIndex((candidate) => candidate.score.correct === row.score.correct) +
      1,
  }));
};

export const winners = (game: ActiveGame): Player[] => {
  const ranked = rankPlayers(game);
  if (ranked.length === 0) return [];
  const topScore = ranked[0].score.correct;
  return ranked
    .filter((row) => row.score.correct === topScore)
    .map((row) => row.player);
};
