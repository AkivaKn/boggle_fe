import { useState,  useRef } from 'react';
import { getWsUrl, startNewGame, type WsMessage } from './api';
import { BoggleBoard } from './components/BoggleBoard';
import { Timer } from './components/Timer';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [board, setBoard] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
  const [joinInput, setJoinInput] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (msg: string) => setLogs(p => [msg, ...p].slice(0, 5));

  const connect = (id?: string) => {
    if (wsRef.current) wsRef.current.close();
    
    const ws = new WebSocket(getWsUrl(id));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const data: WsMessage = JSON.parse(e.data);
      switch (data.event) {
        case 'room_created':
          setRoomId(data.room_id);
          addLog("Lobby created!");
          break;
        case 'room_state':
          setRoomId(data.room_id);
          if (data.board) {
            setBoard(data.board);
            setEndsAt(data.ends_at!);
          }
          addLog("Joined lobby.");
          break;
        case 'new_board':
          setBoard(data.board);
          setEndsAt(data.ends_at);
          addLog("Game started!");
          break;
        case 'player_joined':
          addLog(data.message);
          break;
      }
    };
  };

  const handleStartGame = async () => {
    if (roomId) {
      try {
        await startNewGame(roomId);
      } catch  {
        addLog("Error starting game.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl p-8">
        <h1 className="text-3xl font-black text-center text-indigo-600 mb-8">BOGGLE</h1>

        {!roomId ? (
          <div className="space-y-4">
            <button onClick={() => connect()} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">
              Create New Lobby
            </button>
            <div className="flex items-center gap-2">
              <input 
                className="flex-1 border p-3 rounded-xl" 
                placeholder="Room UUID" 
                value={joinInput} 
                onChange={e => setJoinInput(e.target.value)} 
              />
              <button onClick={() => connect(joinInput)} className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold">
                Join
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 p-3 rounded-xl text-center">
              <span className="text-xs text-gray-400 uppercase font-bold">Lobby ID</span>
              <p className="font-mono text-sm break-all select-all">{roomId}</p>
            </div>

            {!board ? (
              <div className="py-12 border-4 border-dashed rounded-2xl flex flex-col items-center">
                <p className="text-gray-400 mb-4">Waiting for game to start...</p>
                <button onClick={handleStartGame} className="bg-orange-500 text-white px-8 py-3 rounded-xl font-bold shadow-md">
                  Start Game
                </button>
              </div>
            ) : (
              <>
                <Timer endsAt={endsAt} />
                <BoggleBoard board={board} />
                <button onClick={handleStartGame} className="w-full text-indigo-600 font-bold underline mt-4">
                  Regenerate Board
                </button>
              </>
            )}

            <button onClick={() => { wsRef.current?.close(); setRoomId(null); setBoard(''); }} className="w-full py-2 text-gray-400 text-sm">
              Leave Lobby
            </button>
          </div>
        )}

        <div className="mt-8 border-t pt-4">
          {logs.map((l, i) => (
            <div key={i} className="text-[10px] text-gray-400 font-mono mb-1">
              {">"} {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;