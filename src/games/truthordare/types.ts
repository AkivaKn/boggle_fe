export type TodLevel = "pg" | "spicy" | "nsfw";

export type TodKind = "truth" | "dare";

export type Prompt = {
  id: string;
  level: TodLevel;
  kind: TodKind;
  text: string;
  forfeit: number;
  drinking?: true;
};

export type Player = {
  id: string;
  name: string;
};

export type SetupConfig = {
  playerNames: string[];
  levels: TodLevel[];
  shuffleOrder: boolean;
  drinkingMode: boolean;
};

export type GameStage = "choose" | "prompt" | "final";

export type ActiveGame = {
  players: Player[];
  levels: TodLevel[];
  order: string[];
  turnIndex: number;
  turnNumber: number;
  completedTurns: number;
  used: Record<TodKind, string[]>;
  currentPrompt: Prompt | null;
  stage: GameStage;
  drinkingMode: boolean;
};
