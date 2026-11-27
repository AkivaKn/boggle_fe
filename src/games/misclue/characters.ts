import type { CharacterDef } from "./types";

export const CHARACTERS: CharacterDef[] = [
  { id: "mara", name: "Mara", emoji: "🕵️", bio: "Calm and careful. Blends in with safe clues." },
  { id: "jinx", name: "Riley", emoji: "🃏", bio: "Playful risk-taker. Likes creative swings." },
  { id: "professor", name: "Elliot", emoji: "🧠", bio: "Analytical and precise. Watches for inconsistencies." },
  { id: "rook", name: "Marcus", emoji: "🪨", bio: "Blunt and confident. Short, direct clues." },
  { id: "sunny", name: "Hannah", emoji: "🌞", bio: "Warm and social. Tries to sound believable." },
  { id: "ghost", name: "Owen", emoji: "👻", bio: "Quiet and minimal. Keeps clues vague but plausible." },
  { id: "vega", name: "Lena", emoji: "🎭", bio: "Dramatic and expressive. Memorable clues." },
  { id: "pip", name: "Jamie", emoji: "🐣", bio: "Nervous overthinker. Careful and cautious." },
  { id: "atlas", name: "Victor", emoji: "🦁", bio: "Competitive and bold. Quick to accuse." },
  { id: "nova", name: "Claire", emoji: "✨", bio: "Clever lateral thinker. Creative connections." },
];

export function characterById(id: string) {
  return CHARACTERS.find((c) => c.id === id);
}
