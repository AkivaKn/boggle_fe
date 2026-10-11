import { useState, useEffect, useRef } from "react";
import {
  getWsUrl,
  ROOM_CODE_RE,
  startNewGame,
  type Die,
  type WsMessage,
} from "./boggleApi";
import { BoggleBoard } from "./components_boggle/BoggleBoard";
import { Timer } from "./components_boggle/Timer";

function App() {
  const [roomId, setRoomId] = useState<string | null>(
    localStorage.getItem("roomId"),
  );
  // M-A2: the CODE is the shareable surface (what a friend types). The id
  // stays as the internal key for the REST round trip.
  const [roomCode, setRoomCode] = useState<string>(
    localStorage.getItem("roomCode") ?? "",
  );
  const [board, setBoard] = useState<Die[]>([]);
  const [endsAt, setEndsAt] = useState<string>("");
  const [joinInput, setJoinInput] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev].slice(0, 3));
  };

  // M-A2: `ref` is a room CODE — that is what the WS route accepts.
  const connect = (ref?: string) => {
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(getWsUrl(ref));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data: WsMessage = JSON.parse(event.data);
      switch (data.event) {
        case "room_created":
          setRoomId(data.room_id);
          setRoomCode(data.code);
          addLog("Lobby created!");
          break;
        case "room_state":
          setRoomId(data.room_id);
          setRoomCode(data.code);
          if (data.board) {
            setBoard(data.board);
            setEndsAt(data.ends_at!);
          }
          addLog("Connected to lobby.");
          break;
        case "new_board":
          setBoard(data.board);
          setEndsAt(data.ends_at);
          addLog("Game started!");
          break;
        case "player_joined":
          addLog(data.message);
          break;
      }
    };

    ws.onclose = () => {
      setBoard([]);
      setEndsAt("");
      addLog("Disconnected.");
    };
  };

  const handleStartGame = async () => {
    const ref = roomCode || roomId;
    if (ref) {
      setTimeout(async () => {
        try {
          await startNewGame(ref);
        } catch {
          addLog("Error starting game.");
        }
      }, 500); // 1/2 second delay
    }
  };

  const handleLeave = () => {
    if (wsRef.current) wsRef.current.close();
    setRoomId(null);
    setBoard([]);
    setEndsAt("");
    setJoinInput("");
    setLogs([]);
    setRoomCode("");
    localStorage.removeItem("roomId");
    localStorage.removeItem("roomCode");
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog("Code copied!");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: "ping" }));
      }
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    // On mount, reconnect with the CODE if we have one (M-A2 — the join
    // route is code-keyed), falling back to the stored id.
    const savedCode = localStorage.getItem("roomCode");
    const savedRoomId = localStorage.getItem("roomId");
    const ref = savedCode || savedRoomId;
    if (ref) {
      connect(ref);
    }
    // Cleanup on unmount
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    // Save roomId to localStorage when it changes
    if (roomId) {
      localStorage.setItem("roomId", roomId);
    } else {
      localStorage.removeItem("roomId");
    }
  }, [roomId]);

  useEffect(() => {
    // The code is what a returning player needs (the join route is code-keyed
    // now), so it is persisted beside the id and preferred on reconnect.
    if (roomCode) {
      localStorage.setItem("roomCode", roomCode);
    } else {
      localStorage.removeItem("roomCode");
    }
  }, [roomCode]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100">
      <div className="max-w-md mx-auto py-4 px-4 flex flex-col items-center">
        <header className="text-center mb-4">
          <h1 className="text-4xl font-black text-indigo-600 tracking-tighter italic transform -rotate-1">
            BOGGLE<span className="text-orange-500">.</span>
          </h1>
        </header>

        {!roomId ? (
          <div className="w-full bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-center text-slate-700">
              Get Started
            </h2>
            <div className="grid gap-6">
              <button onClick={() => connect()} className="group relative">
                <div className="absolute -inset-0.5 bg-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition"></div>
                <div className="relative bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl w-full text-lg shadow-lg transition-all active:scale-95">
                  Create New Lobby
                </div>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="absolute bg-white px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Or Join Room
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="Enter Room Code (WORD-WORD-77)..."
                  value={joinInput}
                  onChange={(e) =>
                    setJoinInput(
                      e.target.value.toUpperCase().replace(/\s+/g, "-"),
                    )
                  }
                />
                <button
                  onClick={() => connect(joinInput)}
                  // M-A2: the join route is code-keyed, so a malformed code
                  // can only fail server-side — hint the shape here instead of
                  // silently attempting it. The server stays the authority.
                  disabled={!ROOM_CODE_RE.test(joinInput)}
                  className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-black transition-colors disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Room Code
                  </span>
                  <button
                    onClick={copyRoomCode}
                    className={`font-mono text-sm transition-colors mt-0.5 font-bold text-left ${copied ? "text-green-600" : "text-indigo-600"}`}
                  >
                    {copied
                      ? "✓ COPIED!"
                      : `${roomCode || "…"} (Copy)`}
                  </button>
                </div>
                <button
                  onClick={handleLeave}
                  className="px-3 py-1.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-lg text-[10px] font-bold uppercase transition-all"
                >
                  Leave
                </button>
              </div>

              {!board || board.length === 0 ? (
                <div className="py-12 flex flex-col items-center border-4 border-dashed border-slate-50 rounded-3xl">
                  <div className="text-5xl mb-4 grayscale opacity-20">🎲</div>
                  <p className="text-slate-400 text-sm mb-8 text-center px-4">
                    Lobby is open. Shake the dice to start.
                  </p>
                  <button
                    onClick={handleStartGame}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform"
                  >
                    SHAKE DICE
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Timer endsAt={endsAt} />
                  <BoggleBoard board={board} />
                  <button
                    onClick={handleStartGame}
                    className="mt-8 text-indigo-600 font-bold text-sm hover:underline flex items-center gap-2"
                  >
                    <span>🔄</span> New Round
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 w-full px-2">
          <div className="space-y-1.5">
            {logs.map((log, i) => (
              <p
                key={i}
                className="text-[10px] font-medium text-slate-400 font-mono text-center opacity-70"
              >
                {">"} {log}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
