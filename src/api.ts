const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const WS_BASE = API_BASE.replace(/^http/, 'ws');

export interface Board {
  letters: string;
  ends_at: string;
}

export type WsMessage = 
  | { event: 'room_created'; room_id: string }
  | { event: 'room_state'; room_id: string; board?: string; ends_at?: string }
  | { event: 'new_board'; board: string; ends_at: string }
  | { event: 'player_joined'; message: string };

export const startNewGame = async (roomId: string) => {
  const res = await fetch(`${API_BASE}/api/rooms/${roomId}/boards`, { 
    method: 'POST' 
  });
    console.log(res)
  if (!res.ok) throw new Error('Failed to start game');
  return res.json();
};

export const getWsUrl = (roomId?: string) => {
  return roomId ? `${WS_BASE}/ws/rooms/${roomId}` : `${WS_BASE}/ws/rooms`;
};