export type Mode = "party" | "solo";
export type Role = "native" | "tourist" | "drifter";
export type Phase =
  | "setup"
  | "reveal"
  | "clue"
  | "discussion"
  | "vote"
  | "elimination_select"
  | "vote_result"
  | "drifter_guess"
  | "reveal_result"
  | "game_end"
  | "match_end";

export type CharacterDef = {
  id: string;
  name: string;
  emoji: string;
  bio: string;
};

export type Player = {
  id: string;
  seat: number;
  name: string;
  isAI: boolean;
  characterId?: string;
  emoji?: string;
  role: Role;
  word: string; // empty for drifter
  alive: boolean;
  score: number;
};

export type Clue = {
  game: number;
  round: number;
  turn: number;
  seat: number;
  name: string;
  text: string;
};

export type Vote = {
  game: number;
  round: number;
  voterSeat: number;
  targetSeat: number;
};

export type RoundResult = {
  game: number;
  round: number;
  eliminatedSeat: number | null;
  eliminatedRole: Role | null;
  drifterGuess?: string;
  drifterCorrect?: boolean;
  winner: "natives" | "infiltrators" | "drifter_steal" | null;
  summary: string;
  pointsAwarded?: { seat: number; points: number }[];
};

export type VoteResult = {
  eliminatedSeat: number;
  counts: { seat: number; votes: number }[];
  votes: Vote[];
};

export type GameState = {
  mode: Mode;
  phase: Phase;
  gameNumber: number; // which game/deal in the match (1-based)
  roundNumber: number; // clue/vote cycle within the current game (1-based)
  totalGames: number; // games per match
  turnIndex: number; // clues given this clue round (position in rotated order)
  turnStartSeat: number; // seat that starts clue rounds for the current game
  players: Player[];
  clues: Clue[];
  votes: Vote[];
  voteResult: VoteResult | null;
  revoteCount: number;
  results: RoundResult[];
  nativeWord: string;
  touristWord: string;
  category: string;
  selectedCategories: string[];
  usedPairIds: string[];
  setupTourists: number;
  setupDrifters: number;
  winner: "natives" | "infiltrators" | "drifter_steal" | null; // current game winner
  matchWinners: number[]; // player seats with highest score at match end
  revealIndex: number; // for pass-the-phone reveal
  voteIndex: number; // for private voting
  discussionSeconds: number;
  message: string | null;
};
