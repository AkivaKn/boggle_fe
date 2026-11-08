export type Deck = {
  id: string;
  name: string;
  emoji: string;
  words: string[];
  builtin: boolean;
  group?: string;
};

export type Player = {
  id: string;
  name: string;
};

export type TurnTally = {
  correct: number;
  passed: number;
};

export type GameStage = "intro" | "playing" | "summary" | "final";

export type ActiveGame = {
  players: Player[];
  deckIds: string[];
  turnSeconds: number;
  pool: string[];
  cursor: number;
  turnIndex: number;
  stage: GameStage;
  turn: TurnTally;
  scores: Record<string, TurnTally>;
};

export type SetupConfig = {
  playerNames: string[];
  deckIds: string[];
  turnSeconds: number;
  shuffleOrder: boolean;
};

export type Ranking = {
  player: Player;
  score: TurnTally;
  rank: number;
};

export type TiltGesture = "correct" | "pass";

export type TiltPermission = "unknown" | "granted" | "denied" | "unsupported";
