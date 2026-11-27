const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "http://localhost:8080"
).replace(/\/+$/, "");

const WS_BASE = API_BASE.replace(/^http/, "ws");

export interface Card {
  id: string;
  text: string;
}

export interface Prompt {
  id: string;
  text: string;
  pick: 1 | 2;
}

export interface DeckInfo {
  id: string;
  name: string;
  description: string;
  rating: "teen" | "adult";
  prompt_count: number;
  answer_count: number;
  adult: boolean;
}

export interface PlayerView {
  seat: number;
  name: string;
  score: number;
  is_judge: boolean;
}

export interface SelfView {
  token: string;
  seat: number;
  name: string;
  hand: Card[];
  is_host: boolean;
  is_judge: boolean;
  submitted: boolean;
}

export interface SubmissionView {
  id: string;
  cards: Card[];
  seat?: number;
  name?: string;
  winner?: boolean;
}

export interface WinnerView {
  seat: number;
  name: string;
  cards: Card[];
}

export interface StandingView {
  seat: number;
  name: string;
  score: number;
}

export type RoomStatus = "lobby" | "active" | "finished";
export type RoomPhase =
  | "lobby"
  | "submitting"
  | "judging"
  | "reveal"
  | "finished";

export interface RoomState {
  event: "room_state";
  room_id: string;
  code: string;
  status: RoomStatus;
  phase: RoomPhase;
  host_seat: number;
  judge_seat: number;
  round_no: number;
  target_score: number;
  min_players: number;
  max_players: number;
  adult: boolean;
  decks: DeckInfo[];
  players: PlayerView[];
  prompt?: Prompt;
  submitted_count: number;
  needed: number;
  self: SelfView;
  submissions?: SubmissionView[];
  winner?: WinnerView;
  standings?: StandingView[];
  can_start: boolean;
  can_next: boolean;
  can_force: boolean;
  can_rematch: boolean;
  can_remove: boolean;
}

export interface RoomPreview {
  code: string;
  status: RoomStatus;
  phase: RoomPhase;
  player_count: number;
  min_players: number;
  max_players: number;
  target_score: number;
  decks: DeckInfo[];
  adult: boolean;
}

export interface CreateRoomInput {
  name: string;
  decks: string[];
  target_score: number;
  adult_confirmed: boolean;
}

export interface CreateRoomResponse {
  room_id: string;
  code: string;
  token: string;
  seat: number;
  name: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const errorMessage = (text: string, fallback: string): string => {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || fallback;
  } catch {
    return fallback;
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(
      errorMessage(text, `Request failed (${response.status})`),
      response.status,
    );
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export function getDecks(): Promise<DeckInfo[]> {
  return request<{ decks: DeckInfo[] }>("/api/out-of-line/decks").then(
    (data) => data.decks,
  );
}

export function previewRoom(code: string): Promise<RoomPreview> {
  return request<RoomPreview>(
    `/api/out-of-line/rooms/${encodeURIComponent(code)}`,
  );
}

export function createRoom(input: CreateRoomInput): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/out-of-line/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startGame(code: string, token: string): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/start`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function submitCards(
  code: string,
  token: string,
  cards: string[],
): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/submit`, {
    method: "POST",
    body: JSON.stringify({ token, cards }),
  });
}

export function pickWinner(
  code: string,
  token: string,
  submissionID: string,
): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/pick`, {
    method: "POST",
    body: JSON.stringify({ token, submission_id: submissionID }),
  });
}

export function nextRound(code: string, token: string): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/next`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function forceAdvance(code: string, token: string): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/force`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function removePlayer(
  code: string,
  token: string,
  seat: number,
): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/remove`, {
    method: "POST",
    body: JSON.stringify({ token, seat }),
  });
}

export function rematch(code: string, token: string): Promise<void> {
  return request<void>(`/api/out-of-line/rooms/${encodeURIComponent(code)}/rematch`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export interface SocketJoin {
  token?: string;
  name?: string;
  adultConfirmed?: boolean;
}

export function roomSocketUrl(code: string, join: SocketJoin): string {
  const params = new URLSearchParams();
  if (join.token) {
    params.set("token", join.token);
  } else {
    if (join.name) params.set("name", join.name);
    params.set("adult_confirmed", join.adultConfirmed ? "1" : "0");
  }
  return `${WS_BASE}/ws/out-of-line/rooms/${encodeURIComponent(code)}?${params.toString()}`;
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}

export { API_BASE };
