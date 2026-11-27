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
  round: number;
  turn: number;
  seat: number;
  name: string;
  text: string;
};

export type Vote = {
  round: number;
  voterSeat: number;
  targetSeat: number;
};

export type RoundResult = {
  round: number;
  eliminatedSeat: number | null;
  eliminatedRole: Role | null;
  drifterGuess?: string;
  drifterCorrect?: boolean;
  winner: "natives" | "infiltrators" | "drifter_steal" | null;
  summary: string;
};

export type VoteResult = {
  eliminatedSeat: number;
  counts: { seat: number; votes: number }[];
  votes: Vote[];
};

export type GameState = {
  mode: Mode;
  phase: Phase;
  round: number;
  turnIndex: number; // index in alive turn order
  turnStartSeat: number; // seat that starts clue rounds for the current round
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
  scoreTarget: number;
  setupTourists: number;
  setupDrifters: number;
  winner: "natives" | "infiltrators" | "drifter_steal" | null;
  revealIndex: number; // for pass-the-phone reveal
  voteIndex: number; // for private voting
  discussionSeconds: number;
  message: string | null;
};
