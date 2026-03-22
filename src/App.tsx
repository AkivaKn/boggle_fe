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

  const handleLeave = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setRoomId(null);
    setBoard('');
    setEndsAt('');
    setJoinInput('');
    setLogs([]);
  };
  
   const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      addLog("Room ID copied to clipboard!");
    }
   };
  
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100">
      <div className="max-w-2xl mx-auto py-12 px-6">
        
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-6xl font-black text-indigo-600 tracking-tighter italic transform -rotate-2">
            BOGGLE<span className="text-orange-500">.</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2">Multiplayer Word Hunting</p>
        </header>

        {!roomId ? (
          /* START SCREEN */
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-center">Get Started</h2>
            <div className="grid gap-6">
              <button onClick={() => connect()} className="group relative">
                <div className="absolute -inset-0.5 bg-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition"></div>
                <div className="relative bg-indigo-600 text-white font-bold py-5 rounded-2xl w-full text-lg shadow-lg">
                  Create New Lobby
                </div>
              </button>
              
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="absolute bg-white px-4 text-xs font-bold text-slate-400 uppercase">Or Join Game</span>
              </div>

              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-mono"
                  placeholder="Enter Room UUID..."
                  value={joinInput}
                  onChange={e => setJoinInput(e.target.value)}
                />
                <button onClick={() => connect(joinInput)} className="bg-slate-800 text-white px-8 rounded-2xl font-bold hover:bg-black transition-colors">
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* GAME SCREEN */
          <div className="space-y-8">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lobby ID</h3>
                  <button onClick={copyRoomId} className="font-mono text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
                    {roomId.split('-')[0]}... (Click to Copy)
                  </button>
                </div>
                <button onClick={handleLeave} className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase transition-colors">
                  Leave Game
                </button>
              </div>

              {!board ? (
                <div className="py-16 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-3xl">
                  <div className="text-5xl mb-4 text-slate-200">🎲</div>
                  <p className="text-slate-400 font-medium mb-8 text-center">Waiting for the host to<br/>shake the dice...</p>
                  <button onClick={handleStartGame} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg transform transition active:scale-95">
                    SHAKE DICE
                  </button>
                </div>
              ) : (
                <>
                  <Timer endsAt={endsAt} />
                  <BoggleBoard board={board} />
                  <div className="mt-10 flex justify-center">
                    <button onClick={handleStartGame} className="text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-2 transition-colors">
                      <span className="text-xl">🔄</span> Regenerate New Board
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* LOG FEED */}
        <div className="mt-12 px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Game Feed</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
          <div className="space-y-2">
            {logs.map((log, i) => (
              <p key={i} className="text-[11px] font-medium text-slate-400 font-mono text-center">
                {log}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;