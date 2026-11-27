import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { navigate, type MisclueRoute } from "../../router";
import { CHARACTERS } from "./characters";
import { requestAiTurn } from "./api";
import {
  advanceReveal,
  alivePlayers,
  clueTurnIndex,
  confirmVoteResult,
  continueAfterNoWinner,
  createGame,
  currentTurnPlayer,
  defaultRoles,
  nextRound,
  roleLabel,
  selectElimination,
  startVote,
  submitClue,
  submitDrifterGuess,
  submitVote,
  type SetupConfig,
} from "./game";
import { clearState, loadState, saveState } from "./storage";
import type { GameState, Mode, Player } from "./types";
import { WORD_PACKS, WORD_PAIRS } from "./words";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function roleClass(role: string) {
  if (role === "native") return "role-native";
  if (role === "tourist") return "role-tourist";
  return "role-drifter";
}

function roleBadge(role: string) {
  if (role === "native") return "ms-role-native";
  if (role === "tourist") return "ms-role-tourist";
  return "ms-role-drifter";
}

function usePersistentState() {
  const [state, setState] = useState<GameState | null>(() => loadState());
  useEffect(() => {
    if (state) saveState(state);
    else clearState();
  }, [state]);
  return [state, setState] as const;
}

export default function MisclueApp({ route }: { route: MisclueRoute }) {
  const [state, setState] = usePersistentState();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRetry, setAiRetry] = useState<(() => void) | null>(null);
  const [setupPrefill, setSetupPrefill] = useState<SetupConfig | null>(null);
  const aiLock = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (route === "home" && state && state.phase !== "setup") {
      // keep state, show landing with resume
    }
  }, [route, state]);

  const go = (r: MisclueRoute) => navigate(`/misclue${r === "home" ? "" : r === "howto" ? "/how-to-play" : "/play"}`);

  const resetToHome = () => { setState(null); clearState(); go("home"); };

  // AI turn automation for solo mode
  useEffect(() => {
    if (!state || state.mode !== "solo" || aiLock.current || aiError || aiRetry) return;
    const p = currentTurnPlayer(state);
    if (state.phase === "clue" && p?.isAI) { void runAiClue(state, p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.turnIndex, state?.round, state?.mode, aiBusy, aiError, aiRetry]);

  useEffect(() => {
    if (!state || state.mode !== "solo" || aiLock.current || aiError || aiRetry) return;
    if (state.phase === "vote") { void runAiVotesIfNeeded(state); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.voteIndex, state?.round, state?.mode, aiBusy, aiError, aiRetry]);

  useEffect(() => {
    if (!state || state.mode !== "solo" || aiLock.current || aiError || aiRetry) return;
    if (state.phase === "drifter_guess") {
      const drifter = state.players.find(p => !p.alive && p.role === "drifter" && !state.results.find(r => r.round === state.round && r.eliminatedSeat === p.seat));
      if (drifter?.isAI) void runAiDrifterGuess(state, drifter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round, state?.mode, aiBusy, aiError, aiRetry]);

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  async function runAiClue(current: GameState, player: Player) {
    if (aiLock.current) return;
    aiLock.current = true; setAiBusy(true); setAiError(null); setAiRetry(null);
    const started = Date.now();
    try {
      const res = await requestAiTurn(buildReq(current, player, "clue"));
      const clue = (res.clue || "").trim().slice(0, 32) || "...";
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await sleep(1400 - elapsed);
      if (res.fallback) setAiError("AI used a fallback clue (model unavailable or invalid output).");
      else setAiError(null);
      setState(prev => prev ? submitClue(prev, player.seat, clue) : prev);
    } catch (e) {
      const elapsed = Date.now() - started;
      if (elapsed < 800) await sleep(800 - elapsed);
      const msg = e instanceof Error ? e.message : "AI failed";
      setAiError(msg);
      setAiRetry(() => () => {
        const fresh = stateRef.current;
        if (!fresh) return;
        const p = fresh.players.find(x => x.seat === player.seat);
        if (!p) return;
        setAiRetry(null); setAiError(null); void runAiClue(fresh, p);
      });
    } finally { aiLock.current = false; setAiBusy(false); }
  }

  async function runAiVotesIfNeeded(current: GameState) {
    if (aiLock.current) return;
    const alive = alivePlayers(current);
    const roundVotes = current.votes.filter(v => v.round === current.round);
    const voted = new Set(roundVotes.map(v => v.voterSeat));
    const human = current.players.find(p => !p.isAI && p.alive);
    if (human && !voted.has(human.seat)) return;
    const pendingAi = alive.filter(p => p.isAI && !voted.has(p.seat));
    if (pendingAi.length === 0) return;
    aiLock.current = true; setAiBusy(true); setAiError(null); setAiRetry(null);
    try {
      // Parallel fetch, sequential reveal
      const results = await Promise.all(pendingAi.map(async (p) => {
        const res = await requestAiTurn(buildReq(current, p, "vote"));
        const target = res.targetSeat && alive.some(x => x.seat === res.targetSeat && x.seat !== p.seat)
          ? res.targetSeat
          : alive.find(x => x.seat !== p.seat)?.seat ?? p.seat;
        return { seat: p.seat, target, fallback: !!res.fallback };
      }));
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (i > 0) await sleep(650);
        if (r.fallback) setAiError("AI used a fallback vote (model unavailable or invalid output).");
        else setAiError(null);
        setState(prev => {
          if (!prev || prev.phase !== "vote") return prev;
          return submitVote(prev, r.seat, r.target);
        });
        await sleep(0);
        if (stateRef.current?.phase !== "vote") break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI failed";
      setAiError(msg);
      setAiRetry(() => () => { const fresh = stateRef.current; if (!fresh) return; setAiRetry(null); setAiError(null); void runAiVotesIfNeeded(fresh); });
    } finally { aiLock.current = false; setAiBusy(false); }
  }

  async function runAiDrifterGuess(current: GameState, drifter: Player) {
    if (aiLock.current) return;
    aiLock.current = true; setAiBusy(true); setAiError(null); setAiRetry(null);
    const started = Date.now();
    try {
      const res = await requestAiTurn(buildReq(current, drifter, "drifter_guess"));
      const guess = (res.guess || "").trim().slice(0, 40) || "no idea";
      const elapsed = Date.now() - started;
      if (elapsed < 1200) await sleep(1200 - elapsed);
      if (res.fallback) setAiError("AI used a fallback guess (model unavailable or invalid output).");
      else setAiError(null);
      setState(prev => prev ? submitDrifterGuess(prev, guess) : prev);
    } catch (e) {
      const elapsed = Date.now() - started;
      if (elapsed < 800) await sleep(800 - elapsed);
      const msg = e instanceof Error ? e.message : "AI failed";
      setAiError(msg);
      setAiRetry(() => () => {
        const fresh = stateRef.current;
        if (!fresh) return;
        const d = fresh.players.find(x => x.seat === drifter.seat);
        if (!d) return;
        setAiRetry(null); setAiError(null); void runAiDrifterGuess(fresh, d);
      });
    } finally { aiLock.current = false; setAiBusy(false); }
  }

  function buildReq(current: GameState, player: Player, action: "clue" | "vote" | "drifter_guess") {
    return {
      action,
      characterId: player.characterId || "mara",
      seat: player.seat,
      publicState: {
        players: current.players.map(p => ({ seat: p.seat, name: p.name, alive: p.alive, isAi: p.isAI, characterId: p.characterId })),
        clues: current.clues.filter(c => c.round === current.round).map(c => ({ seat: c.seat, name: c.name, text: c.text })),
        eliminated: current.results.flatMap(r => {
          const p = current.players.find(pl => pl.seat === r.eliminatedSeat);
          return p ? [{ seat: p.seat, name: p.name, role: roleLabel(p.role) }] : [];
        }),
      },
      privateState: { role: roleLabel(player.role), word: player.word },
      rules: { maxClueLength: 32 },
    };
  }

  if (route === "howto") return <Shell><HowTo onBack={() => go("home")} /></Shell>;
  if (route === "play") {
    if (!state) return <Shell><Setup initial={setupPrefill} onStart={(cfg) => { setSetupPrefill(null); const g = createGame(cfg); setState(g); }} onBack={() => { setSetupPrefill(null); go("home"); }} /></Shell>;
    return <Shell><GameScreen state={state} setState={setState} aiBusy={aiBusy} aiError={aiError} aiRetry={aiRetry} onExit={resetToHome} onNewGame={() => {
      const humans = state.players.filter(p => !p.isAI).map(p => ({ name: p.name }));
      const aiCount = state.players.filter(p => p.isAI).length;
      setSetupPrefill({
        mode: state.mode,
        humans,
        aiCount,
        scoreTarget: state.scoreTarget,
        categories: state.selectedCategories ?? (state.category ? [state.category] : []),
        tourists: state.setupTourists,
        drifters: state.setupDrifters,
      });
      setState(null);
      clearState();
    }} /></Shell>;
  }
  return <Shell><Landing hasSave={!!state} onPlay={() => go("play")} onHowTo={() => go("howto")} onResume={() => go("play")} onNew={resetToHome} /></Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="ms-shell"><div className="ms-page">{children}</div></div>;
}

function TopBar({ onBack, right }: { onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="ms-top">
      <div className="ms-row">
        {onBack && <button className="ms-back" onClick={onBack}>← Back</button>}
        <div className="ms-brand"><span className="ms-brand-badge">🕵️</span> Misclue</div>
      </div>
      {right}
    </div>
  );
}

function Landing({ hasSave, onPlay, onHowTo, onResume, onNew }: { hasSave: boolean; onPlay: () => void; onHowTo: () => void; onResume: () => void; onNew: () => void }) {
  return (
    <>
      <TopBar />
      <section className="ms-hero">
        <p className="ms-kicker">Social deduction · secret words</p>
        <h1 className="ms-title">Find the <span className="accent">Misclue</span>.</h1>
        <p className="ms-sub">Everyone gets a secret word - almost everyone. Natives share a word, Tourists get a similar one, and the Drifter has no word at all. Give clues, spot the odd one out, and don’t get caught bluffing.</p>
        <div className="ms-actions">
          {hasSave ? <button className="ms-btn ms-btn-primary" onClick={onResume}>Resume game</button> : <button className="ms-btn ms-btn-primary" onClick={onPlay}>Play</button>}
          <button className="ms-btn ms-btn-secondary" onClick={onHowTo}>How to play</button>
          {hasSave && <button className="ms-btn ms-btn-ghost" onClick={onNew}>New game</button>}
        </div>
      </section>
      <div className="ms-grid ms-grid-3" style={{marginTop:24}}>
        <div className="ms-card"><div className="ms-big-emoji">🟢</div><h3>Natives</h3><p>Same secret word. Find the impostors.</p></div>
        <div className="ms-card"><div className="ms-big-emoji">🟡</div><h3>Tourists</h3><p>Similar word. Blend in without being obvious.</p></div>
        <div className="ms-card"><div className="ms-big-emoji">🩷</div><h3>Drifter</h3><p>No word. Bluff, survive, and steal the round with a perfect guess.</p></div>
      </div>
    </>
  );
}

function HowTo({ onBack }: { onBack: () => void }) {
  const steps = [
    ["Get your role", "Natives share a word, Tourists get a similar word, and the Drifter gets no word."],
    ["Give clues", "Each player gives a short clue. In Party Mode you say it out loud. In Solo Mode you type it so AI characters can react."],
    ["Discuss", "In Party Mode, humans discuss verbally. Solo Mode skips straight to voting."],
    ["Vote", "Eliminate who you think is the odd one out. Ties trigger a revote."],
    ["Drifter guess", "If the Drifter is eliminated, they get one guess at the Native word. Guess right and they steal the round."],
  ];
  return (
    <>
      <TopBar onBack={onBack} />
      <div className="ms-center">
        <p className="ms-kicker">How to play</p>
        <h1 className="ms-section-title" style={{fontSize:"2.2rem",marginBottom:16}}>Misclue in 60 seconds</h1>
        <div className="ms-howto">
          {steps.map(([h,p],i)=>(
            <div className="ms-howto-step" key={h}>
              <div className="ms-howto-num">{i+1}</div>
              <div><h3>{h}</h3><p>{p}</p></div>
            </div>
          ))}
        </div>
        <div className="ms-card" style={{marginTop:16}}>
          <h3>Modes</h3>
          <p><strong>Party Mode:</strong> pass one phone around, humans only, verbal clues. <strong>Solo Mode:</strong> play against randomly picked AI characters, type clues and votes.</p>
        </div>
      </div>
    </>
  );
}

function Setup({ onStart, onBack, initial }: { onStart: (cfg: SetupConfig) => void; onBack: () => void; initial?: SetupConfig | null }) {
  const [mode, setMode] = useState<Mode | null>(initial?.mode ?? null);
  const [humans, setHumans] = useState<string[]>(() => {
    if (initial?.humans?.length) {
      if (initial.mode === "party") return initial.humans.map(h => h.name);
      return [initial.humans[0]?.name || "You"];
    }
    return ["You", "Player 2", "Player 3"];
  });
  const [aiCount, setAiCount] = useState(initial?.mode === "solo" ? initial.aiCount : 3);
  const [scoreTarget, setScoreTarget] = useState(initial?.scoreTarget ?? 3);
  const [category, setCategory] = useState<string>(initial?.categories?.[0] ?? "all");

  const totalPlayers = mode === "party" ? Math.max(0, humans.filter(h => h.trim()).length) : (mode === "solo" ? 1 + aiCount : 0);
  const roleDefaults = defaultRoles(Math.max(3, Math.min(20, totalPlayers || 3)));
  const [tourists, setTourists] = useState<number>(initial?.tourists ?? roleDefaults.tourists);
  const [drifters, setDrifters] = useState<number>(initial?.drifters ?? roleDefaults.drifters);

  useEffect(() => {
    if (!mode) return;
    const d = defaultRoles(Math.max(3, Math.min(20, totalPlayers || 3)));
    setTourists(t => {
      let nt = Math.min(Math.max(0, t), Math.max(0, totalPlayers - 1));
      let nd = Math.min(Math.max(0, drifters), Math.max(0, totalPlayers - 1));
      const nativesCount = totalPlayers - nt - nd;
      if (nt + nd < 1 || nativesCount <= nt + nd) return d.tourists;
      return nt;
    });
    setDrifters(dr => {
      let nd = Math.min(Math.max(0, dr), Math.max(0, totalPlayers - 1));
      let nt = Math.min(Math.max(0, tourists), Math.max(0, totalPlayers - 1));
      const nativesCount = totalPlayers - nt - nd;
      if (nt + nd < 1 || nativesCount <= nt + nd) return d.drifters;
      return nd;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, totalPlayers]);

  const natives = Math.max(0, totalPlayers - tourists - drifters);
  const rolesValid = totalPlayers >= 3 && totalPlayers <= 20 && tourists >= 0 && drifters >= 0 && tourists + drifters >= 1 && natives > (tourists + drifters);
  const canStart = rolesValid && (mode === "party" ? humans.filter(h => h.trim()).length >= 3 : humans[0]?.trim().length > 0 && aiCount >= 2);

  const start = () => {
    if (!mode) return;
    const cfg: SetupConfig = {
      mode,
      humans: mode === "party" ? humans.filter(h=>h.trim()).map(name=>({name:name.trim()})) : [{name: humans[0].trim() || "You"}],
      aiCount: mode === "solo" ? aiCount : 0,
      scoreTarget,
      categories: category === "all" ? [] : [category],
      tourists,
      drifters,
    };
    onStart(cfg);
  };

  return (
    <>
      <TopBar onBack={onBack} />
      <div className="ms-center">
        <p className="ms-kicker">Setup</p>
        <h1 className="ms-section-title" style={{fontSize:"2rem",marginBottom:16}}>Start a game</h1>

        <div className="ms-grid ms-grid-2" style={{marginBottom:16}}>
          <button className={cx("ms-card ms-mode-card", mode==="party" && "ms-card-strong")} onClick={()=>setMode("party")} style={{"--glow":"rgba(255,92,168,.22)"} as React.CSSProperties}>
            <span className="tag ms-tag-pink">Pass the phone</span>
            <span className="icon">🎉</span>
            <h3>Party Mode</h3>
            <p>Humans only. Say clues out loud, discuss, and vote together.</p>
          </button>
          <button className={cx("ms-card ms-mode-card", mode==="solo" && "ms-card-strong")} onClick={()=>setMode("solo")} style={{"--glow":"rgba(53,226,208,.22)"} as React.CSSProperties}>
            <span className="tag ms-tag-cyan">Vs AI characters</span>
            <span className="icon">🤖</span>
            <h3>Solo Mode</h3>
            <p>Play against randomly picked AI characters. Type clues and votes.</p>
          </button>
        </div>

        {mode && <div className="ms-card ms-card-strong">
          {mode === "party" ? (
            <>
              <h3 style={{marginBottom:12}}>Players</h3>
              <div className="ms-player-list">
                {humans.map((h, i) => (
                  <div className="ms-player-row" key={i}>
                    <input className="ms-input" value={h} maxLength={18} onChange={e=>{const n=[...humans]; n[i]=e.target.value; setHumans(n);}} placeholder={`Player ${i+1}`} />
                    {humans.length > 3 && <button className="ms-remove" onClick={()=>setHumans(humans.filter((_,j)=>j!==i))}>×</button>}
                  </div>
                ))}
              </div>
              {humans.length < 20 && <button className="ms-btn ms-btn-secondary ms-btn-sm" style={{marginTop:12}} onClick={()=>setHumans([...humans, `Player ${humans.length+1}`])}>+ Add player</button>}
            </>
          ) : (
            <>
              <h3 style={{marginBottom:12}}>Your name</h3>
              <input className="ms-input" value={humans[0]} maxLength={18} onChange={e=>setHumans([e.target.value])} placeholder="Your name" />
              <div className="ms-field" style={{marginTop:16}}>
                <label>AI opponents</label>
                <div className="ms-row" style={{gap:12}}>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>setAiCount(c=>Math.max(2,c-1))} disabled={aiCount<=2} aria-label="Fewer AI opponents">−</button>
                  <div style={{minWidth:90,textAlign:"center",fontWeight:800,fontSize:"1.05rem"}}>{aiCount} AI <span className="ms-muted" style={{fontWeight:600,fontSize:".9rem"}}>({1+aiCount} total)</span></div>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>setAiCount(c=>Math.min(19,c+1))} disabled={aiCount>=19} aria-label="More AI opponents">+</button>
                </div>
                <p className="ms-muted" style={{fontSize:".85rem",marginTop:8}}>Random characters picked each game (up to 20 players total).</p>
              </div>
              <div className="ms-divider" />
              <h3 style={{marginBottom:10}}>AI character roster</h3>
              <p className="ms-muted" style={{fontSize:".85rem",marginBottom:12}}>You’ll face a random mix of these characters.</p>
              <div className="ms-char-grid">
                {CHARACTERS.map(c => (
                  <div key={c.id} className="ms-char is-static">
                    <span className="emoji">{c.emoji}</span>
                    <div className="name">{c.name}</div>
                    <div className="bio">{c.bio}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="ms-divider" />
          <div className="ms-card" style={{padding:"16px",marginBottom:16,background:"rgba(255,255,255,.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12}}>
              <h3 style={{margin:0}}>Roles</h3>
              <span className="ms-muted" style={{fontSize:".85rem",fontWeight:700}}>Total {totalPlayers}</span>
            </div>
            <div style={{display:"grid",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:14,background:"rgba(255,255,255,.03)",border:"1px solid var(--ms-line)"}}>
                <span style={{fontWeight:700}}>Natives</span>
                <span style={{fontWeight:800,minWidth:90,textAlign:"center"}}>{natives}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:14,background:"rgba(255,255,255,.03)",border:"1px solid var(--ms-line)"}}>
                <span style={{fontWeight:700}}>Tourists</span>
                <div className="ms-row" style={{gap:10}}>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>setTourists(t=>Math.max(0,t-1))} disabled={tourists<=0 || (tourists-1)+drifters<1} aria-label="Fewer tourists">−</button>
                  <div style={{minWidth:28,textAlign:"center",fontWeight:800,fontSize:"1.05rem"}}>{tourists}</div>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>{ if (natives > tourists + drifters + 2) { setTourists(t=>t+1); } else if (drifters > 0) { setTourists(t=>t+1); setDrifters(d=>d-1); } }} disabled={natives <= (tourists + drifters + 2) && drifters <= 0} aria-label="More tourists">+</button>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:14,background:"rgba(255,255,255,.03)",border:"1px solid var(--ms-line)"}}>
                <span style={{fontWeight:700}}>Drifters</span>
                <div className="ms-row" style={{gap:10}}>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>setDrifters(d=>Math.max(0,d-1))} disabled={drifters<=0 || tourists+(drifters-1)<1} aria-label="Fewer drifters">−</button>
                  <div style={{minWidth:28,textAlign:"center",fontWeight:800,fontSize:"1.05rem"}}>{drifters}</div>
                  <button type="button" className="ms-btn ms-btn-secondary ms-btn-sm" onClick={()=>{ if (natives > tourists + drifters + 2) { setDrifters(d=>d+1); } else if (tourists > 0) { setDrifters(d=>d+1); setTourists(t=>t-1); } }} disabled={natives <= (tourists + drifters + 2) && tourists <= 0} aria-label="More drifters">+</button>
                </div>
              </div>
            </div>
            {!rolesValid && <p style={{margin:"12px 0 0",color:"var(--ms-yellow)",fontSize:".85rem"}}>Need at least 1 infiltrator and more Natives than infiltrators.</p>}
          </div>

          <div className="ms-divider" />
          <div className="ms-grid ms-grid-2">
            <div className="ms-field" style={{gridColumn:"1 / -1"}}>
              <label>Word packs</label>
              <div className="ms-deck-grid">
                {[{id:"all", name:"All packs", description:"Mix everything together.", emoji:"🎲"}, ...WORD_PACKS.map(p => ({...p, emoji: p.id==="everyday"?"🏠":p.id==="fun"?"🎉":"🧠"}))].map(p => {
                  const selected = category === p.id;
                  const count = p.id === "all" ? WORD_PAIRS.length : WORD_PAIRS.filter(w=>w.category===p.id).length;
                  return (
                    <button key={p.id} type="button" className={cx("ms-deck-card", selected && "selected")} onClick={()=>setCategory(p.id)}>
                      <span className="ms-deck-emoji" aria-hidden>{p.emoji}</span>
                      <span style={{minWidth:0,flex:1}}>
                        <div className="ms-deck-name">{p.name}</div>
                        <div className="ms-deck-meta">{count} pairs · {p.description}</div>
                      </span>
                      <span className="ms-deck-check" aria-hidden>✓</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="ms-field">
            <label>Score target</label>
            <div className="ms-row">
              {[3,5,7].map(n => <button key={n} className={cx("ms-pill", scoreTarget===n && "active")} onClick={()=>setScoreTarget(n)}>{n}</button>)}
            </div>
          </div>

          <div className="ms-actions">
            <button className="ms-btn ms-btn-primary" disabled={!canStart} onClick={start}>Start Misclue</button>
          </div>
        </div>}
      </div>
    </>
  );
}


function YourSecret({ state }: { state: GameState }) {
  const human = state.players.find(p => !p.isAI);
  if (!human || state.mode !== "solo") return null;
  return (
    <div className={cx("ms-secret", roleClass(human.role))} style={{margin:"0 0 16px",padding:"14px 16px",maxWidth:"none"}}>
      <div className="ms-secret-label">Your secret</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div className="ms-secret-word" style={{fontSize:"1.5rem"}}>{human.role === "drifter" ? "???" : human.word}</div>
        <div className="ms-secret-role" style={{marginTop:0}}>{roleLabel(human.role)}</div>
      </div>
    </div>
  );
}
function GameScreen({ state, setState, aiBusy, aiError, aiRetry, onExit, onNewGame }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>>; aiBusy: boolean; aiError: string | null; aiRetry: (() => void) | null; onExit: () => void; onNewGame: () => void }) {
  return (
    <>
      <TopBar onBack={onExit} right={<div className="ms-stats"><span className="ms-stat">Round <strong>{state.round}</strong></span><span className="ms-stat">Target <strong>{state.scoreTarget}</strong></span></div>} />
      {aiError && <div className="ms-card" style={{marginBottom:12,borderColor:"rgba(255,107,107,.4)",color:"#ffb1b1"}}><div>AI issue: {aiError}</div>{aiRetry && <button className="ms-btn ms-btn-secondary ms-btn-sm" style={{marginTop:10}} onClick={aiRetry}>Retry AI turn</button>}</div>}
      {state.phase === "reveal" && <RevealScreen state={state} setState={setState} />}
      {state.phase === "clue" && <ClueScreen state={state} setState={setState} aiBusy={aiBusy} />}
      {state.phase === "discussion" && <DiscussionScreen state={state} setState={setState} />}
      {state.phase === "vote" && <VoteScreen state={state} setState={setState} aiBusy={aiBusy} />}
      {state.phase === "elimination_select" && <EliminationSelectScreen state={state} setState={setState} />}
      {state.phase === "vote_result" && <VoteResultScreen state={state} setState={setState} />}
      {state.phase === "drifter_guess" && <DrifterGuessScreen state={state} setState={setState} />}
      {state.phase === "reveal_result" && <RoundResultScreen state={state} setState={setState} />}
      {state.phase === "match_end" && <MatchEndScreen state={state} onExit={onExit} onNewGame={onNewGame} />}
    </>
  );
}

function RevealScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const [shown, setShown] = useState(false);
  const player = state.players[state.revealIndex];
  if (!player) return null;
  const next = () => { setShown(false); setState(prev => prev ? advanceReveal(prev) : prev); };

  if (state.mode === "solo") {
    // In solo, only show human's own reveal, skip AI reveals
    const human = state.players.find(p => !p.isAI);
    if (!human) return null;
    return (
      <div className="ms-center">
        <div className="ms-card ms-reveal-card ms-card-strong">
          <div className="ms-big-emoji">{shown ? (human.role === "drifter" ? "🩷" : human.role === "tourist" ? "🟡" : "🟢") : "🔒"}</div>
          <h2 className="ms-reveal-name">{shown ? `You are a ${roleLabel(human.role)}` : "Your secret role"}</h2>
          <p className="ms-reveal-hint">{shown ? (human.role === "drifter" ? "You have no word. Bluff from the clues and try to guess the Native word if caught." : "Remember your word. Give clues that fit without being too obvious.") : "Tap reveal when you're ready."}</p>
          {shown && (
            <div className={cx("ms-secret", roleClass(human.role))}>
              <div className="ms-secret-label">{human.role === "drifter" ? "Your word" : "Your secret word"}</div>
              <div className="ms-secret-word">{human.role === "drifter" ? "???" : human.word}</div>
              <div className="ms-secret-role">{roleLabel(human.role)}</div>
            </div>
          )}
          {!shown ? <button className="ms-btn ms-btn-primary" onClick={()=>setShown(true)}>Reveal</button> : <button className="ms-btn ms-btn-cyan" onClick={()=>setState(prev => {
            if (!prev) return prev;
            const next = {...prev, phase:"clue" as const, revealIndex: prev.players.length};
            return {...next, turnIndex: clueTurnIndex(next)};
          })}>Start round</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="ms-center">
      <div className="ms-card ms-reveal-card ms-card-strong">
        <div className="ms-big-emoji">{shown ? (player.role === "drifter" ? "🩷" : player.role === "tourist" ? "🟡" : "🟢") : "📱"}</div>
        <h2 className="ms-reveal-name">{shown ? `${player.name}: ${roleLabel(player.role)}` : `Pass to ${player.name}`}</h2>
        <p className="ms-reveal-hint">{shown ? (player.role === "drifter" ? "No word for you. Bluff carefully." : "Memorize your word, then hide it.") : "Only this player should look at the screen."}</p>
        {shown && (
          <div className={cx("ms-secret", roleClass(player.role))}>
            <div className="ms-secret-label">{player.role === "drifter" ? "Your word" : "Your secret word"}</div>
            <div className="ms-secret-word">{player.role === "drifter" ? "???" : player.word}</div>
            <div className="ms-secret-role">{roleLabel(player.role)}</div>
          </div>
        )}
        {!shown ? <button className="ms-btn ms-btn-primary" onClick={()=>setShown(true)}>I’m {player.name}, reveal</button> : <button className="ms-btn ms-btn-cyan" onClick={next}>Hide and pass on</button>}
      </div>
      <p className="ms-muted" style={{textAlign:"center",marginTop:12,fontSize:".85rem"}}>Player {state.revealIndex + 1} of {state.players.length}</p>
    </div>
  );
}

function ClueScreen({ state, setState, aiBusy }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>>; aiBusy: boolean }) {
  const [text, setText] = useState("");
  const player = currentTurnPlayer(state);
  const alive = alivePlayers(state);
  if (!player) return null;

  const submit = () => {
    const clue = text.trim();
    if (!clue) return;
    setState(prev => prev ? submitClue(prev, player.seat, clue) : prev);
    setText("");
  };

  return (
    <div className="ms-board">
      <div className="ms-card ms-card-strong">
        <div className="ms-game-head">
          <div>
            <p className="ms-kicker" style={{marginBottom:4}}>Clue round</p>
            <h2 className="ms-section-title">Give a clue</h2>
          </div>
        </div>
        <div className="ms-turn-banner">
          <h3>{player.isAI ? `${player.emoji || "🤖"} ${player.name} is thinking...` : `🎤 ${player.name}'s turn`}</h3>
          <p>{player.isAI ? "The AI character is coming up with a clue." : state.mode === "party" ? "Say your clue out loud, then tap next." : "Type a short clue. Don’t say your secret word."}</p>
          {player.isAI && aiBusy && <div className="ms-thinking" style={{marginTop:10}}><span className="ms-dot"/><span className="ms-dot"/><span className="ms-dot"/> Thinking</div>}
        </div>

        {!player.isAI && state.mode === "solo" && (
          <div className="ms-input-row">
            <input className="ms-input" value={text} maxLength={32} placeholder="Type a short clue..." onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") submit();}} />
            <button className="ms-btn ms-btn-primary" onClick={submit} disabled={!text.trim()}>Send clue</button>
          </div>
        )}

        {!player.isAI && state.mode === "party" && (
          <div className="ms-actions">
            <button className="ms-btn ms-btn-primary" onClick={()=>setState(prev=>prev?submitClue(prev, player.seat, "(spoken clue)"):prev)}>Clue given - next</button>
          </div>
        )}

        <div className="ms-divider" />
        <p className="ms-muted" style={{fontSize:".9rem"}}>Alive: {alive.length} · Turn {state.turnIndex+1}/{alive.length}</p>
        {state.message && <p style={{marginTop:12,color:"var(--ms-yellow)",fontWeight:700}}>{state.message}</p>}
      </div>

      <div className="ms-card">
        <YourSecret state={state} />
        <h3 style={{marginBottom:12}}>Players</h3>
        <div style={{display:"grid",gap:8}}>
          {state.players.map(p => {
            const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
            const isCurrent = player.seat===p.seat && p.alive;
            return (
              <div key={p.seat} className={cx("ms-reveal-item", !p.alive && "is-out")} style={{alignItems:"flex-start", border: isCurrent ? "1px solid rgba(245,185,66,.35)" : undefined, background: isCurrent ? "rgba(245,185,66,.07)" : undefined}}>
                <div>
                  <strong>{p.isAI ? p.emoji+" " : ""}{p.name}</strong> {!p.alive ? <span style={{color:"var(--ms-dim)"}}>(out)</span> : ""}
                  <div style={{fontSize:".78rem",color:"var(--ms-muted)",marginTop:2,lineHeight:1.35}}>{clues || (p.alive ? "No clue yet" : "—")}</div>
                </div>
                {isCurrent && <span className="ms-role-badge" style={{background:"rgba(245,185,66,.16)",color:"var(--ms-yellow)"}}>Turn</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiscussionScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const roundClues = state.clues.filter(c => c.round === state.round);
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong" style={{textAlign:"center"}}>
        <p className="ms-kicker">Discussion</p>
        <h2 className="ms-section-title" style={{fontSize:"2rem"}}>Talk it out</h2>
        <p className="ms-muted" style={{marginBottom:20}}>Discuss verbally. Who sounded like a Tourist? Who might be the Drifter with no word?</p>
        <div className="ms-clue-feed" style={{textAlign:"left",marginBottom:20,maxHeight:260}}>
          {roundClues.map((c,i)=>(<div className="ms-clue" key={i}><div className="who">{c.name}</div><div className="text">{c.text}</div></div>))}
        </div>
        <button className="ms-btn ms-btn-primary" onClick={()=>setState(prev=>prev?(prev.mode==="party"?{...prev, phase:"elimination_select", message:null}:{...startVote(prev)}):prev)}>{state.mode==="party" ? "Choose elimination" : "Go to vote"}</button>
      </div>
    </div>
  );
}

function VoteScreen({ state, setState, aiBusy }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>>; aiBusy: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const alive = alivePlayers(state);
  const roundVotes = state.votes.filter(v => v.round === state.round);
  const voted = new Set(roundVotes.map(v => v.voterSeat));

  // Solo: human votes if not voted; AI auto via effect
  if (state.mode === "solo") {
    const human = state.players.find(p => !p.isAI);
    const humanVoted = human ? voted.has(human.seat) : true;
    const waitingForAi = !humanVoted ? false : roundVotes.length < alive.length;
    return (
      <div className="ms-center">
        <div className="ms-card ms-card-strong">
          <YourSecret state={state} />
          <p className="ms-kicker">Vote</p>
          <h2 className="ms-section-title" style={{fontSize:"1.8rem"}}>{humanVoted ? "Waiting for AI votes..." : "Cast your vote"}</h2>
          <p className="ms-muted" style={{marginBottom:16}}>{humanVoted ? "AI characters are voting." : "Who do you want to eliminate?"}</p>
          {state.message && <p style={{marginBottom:12,color:"var(--ms-yellow)",fontWeight:700}}>{state.message}</p>}
          {!humanVoted && human && (
            <>
              <div className="ms-vote-grid">
                {alive.filter(p=>p.seat!==human.seat).map(p => {
                  const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
                  return (
                    <button key={p.seat} className={cx("ms-vote-btn", selected===p.seat && "selected")} onClick={()=>setSelected(p.seat)}>
                      <span className="emoji">{p.emoji || "👤"}</span>
                      <span className="name">{p.name}</span>
                      <span style={{display:"block",fontSize:".72rem",color:"var(--ms-muted)",marginTop:4,lineHeight:1.3,fontWeight:600}}>{clues || "No clue yet"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="ms-actions" style={{marginTop:16}}>
                <button className="ms-btn ms-btn-primary" disabled={selected===null} onClick={()=>{ if(selected!==null && human) { setState(prev=>prev?submitVote(prev,human.seat,selected):prev); setSelected(null); } }}>Lock vote</button>
              </div>
            </>
          )}
          {humanVoted && waitingForAi && <div className="ms-thinking" style={{marginTop:12}}><span className="ms-dot"/><span className="ms-dot"/><span className="ms-dot"/> {aiBusy ? "AI voting..." : "Counting votes..."}</div>}
          {roundVotes.length > 0 && (
            <>
              <div className="ms-divider" />
              <h3 style={{marginBottom:10}}>Votes in</h3>
              <div style={{display:"grid",gap:8}}>
                {roundVotes.map((v,i) => {
                  const voter = state.players.find(p=>p.seat===v.voterSeat);
                  const target = state.players.find(p=>p.seat===v.targetSeat);
                  return <div key={i} className="ms-clue"><div className="who">{voter?.name}</div><div className="text">voted for {target?.name}</div></div>;
                })}
              </div>
            </>
          )}
          <div className="ms-divider" />
          <div className="ms-player-chips">{alive.map(p => <span key={p.seat} className="ms-chip">{p.emoji||"👤"} {p.name} {voted.has(p.seat)?"✅":"…"}</span>)}</div>
        </div>
      </div>
    );
  }

  // Party mode: pass-the-phone private voting
  const currentVoter = alive.find(p => !voted.has(p.seat));
  if (!currentVoter) return <div className="ms-center"><div className="ms-card">Tallying votes...</div></div>;
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong">
        <p className="ms-kicker">Private vote</p>
        {!revealed ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div className="ms-big-emoji">🗳️</div>
            <h2 className="ms-reveal-name">Pass to {currentVoter.name}</h2>
            <p className="ms-reveal-hint">Only {currentVoter.name} should see the vote.</p>
            <button className="ms-btn ms-btn-primary" onClick={()=>setRevealed(true)}>I’m {currentVoter.name}</button>
          </div>
        ) : (
          <>
            <h2 className="ms-section-title" style={{fontSize:"1.8rem"}}>{currentVoter.name}, vote to eliminate</h2>
            <p className="ms-muted" style={{marginBottom:16}}>Pick one player.</p>
            <div className="ms-vote-grid">
              {alive.filter(p=>p.seat!==currentVoter.seat).map(p => {
                const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
                return (
                  <button key={p.seat} className={cx("ms-vote-btn", selected===p.seat && "selected")} onClick={()=>setSelected(p.seat)}>
                    <span className="emoji">👤</span>
                    <span className="name">{p.name}</span>
                    <span style={{display:"block",fontSize:".72rem",color:"var(--ms-muted)",marginTop:4,lineHeight:1.3,fontWeight:600}}>{clues || "No clue yet"}</span>
                  </button>
                );
              })}
            </div>
            <div className="ms-actions" style={{marginTop:16}}>
              <button className="ms-btn ms-btn-primary" disabled={selected===null} onClick={()=>{ if(selected!==null){ setState(prev=>prev?submitVote(prev,currentVoter.seat,selected):prev); setSelected(null); setRevealed(false); } }}>Confirm vote</button>
            </div>
          </>
        )}
        <div className="ms-divider" />
        {state.message && <p style={{marginTop:10,color:"var(--ms-yellow)",fontWeight:700}}>{state.message}</p>}
        <p className="ms-muted" style={{fontSize:".85rem"}}>{roundVotes.length}/{alive.length} votes cast</p>
      </div>
    </div>
  );
}


function EliminationSelectScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const alive = alivePlayers(state);
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong">
        <p className="ms-kicker">Group decision</p>
        <h2 className="ms-section-title" style={{fontSize:"1.8rem"}}>Who was eliminated?</h2>
        <p className="ms-muted" style={{marginBottom:16}}>The group decides together. Select the player who is out.</p>
        <div className="ms-vote-grid">
          {alive.map(p => {
            const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
            return (
              <button key={p.seat} className="ms-vote-btn" onClick={()=>setState(prev=>prev?selectElimination(prev,p.seat):prev)}>
                <span className="emoji">👤</span>
                <span className="name">{p.name}</span>
                <span style={{display:"block",fontSize:".72rem",color:"var(--ms-muted)",marginTop:4,lineHeight:1.3,fontWeight:600}}>{clues || "No clue"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VoteResultScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const vr = state.voteResult;
  if (!vr) return null;
  const eliminated = state.players.find(p => p.seat === vr.eliminatedSeat);
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong">
        <p className="ms-kicker">Vote results</p>
        <h2 className="ms-section-title" style={{fontSize:"1.8rem"}}>{eliminated?.name} eliminated</h2>
        <p className="ms-muted" style={{marginBottom:16}}>Here’s how the votes landed.</p>
        <div className="ms-reveal-list" style={{marginBottom:16}}>
          {vr.counts.map(c => {
            const p = state.players.find(x => x.seat === c.seat);
            return (
              <div className="ms-reveal-item" key={c.seat}>
                <span><strong>{p?.emoji ? p.emoji+" " : ""}{p?.name}</strong></span>
                <span className="ms-role-badge ms-role-native" style={{background:"rgba(255,255,255,.1)",color:"var(--ms-text)"}}>{c.votes} vote{c.votes!==1?"s":""}</span>
              </div>
            );
          })}
        </div>
        <div className="ms-divider" />
        <h3 style={{marginBottom:10}}>Who voted for whom</h3>
        <div style={{display:"grid",gap:8,marginBottom:16}}>
          {vr.votes.map((v,i) => {
            const voter = state.players.find(p=>p.seat===v.voterSeat);
            const target = state.players.find(p=>p.seat===v.targetSeat);
            return <div key={i} className="ms-clue"><div className="who">{voter?.name}</div><div className="text">voted for {target?.name}</div></div>;
          })}
        </div>
        <div className="ms-actions">
          <button className="ms-btn ms-btn-primary" onClick={()=>setState(prev=>prev?confirmVoteResult(prev):prev)}>Continue</button>
        </div>
      </div>
    </div>
  );
}
function DrifterGuessScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const [guess, setGuess] = useState("");
  const drifter = state.players.find(p => !p.alive && p.role === "drifter" && !state.results.find(r => r.round === state.round && r.eliminatedSeat === p.seat));
  if (!drifter) return null;
  const isAi = drifter.isAI;

  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong" style={{textAlign:"center"}}>
        <YourSecret state={state} />
        <p className="ms-kicker">Drifter guess</p>
        <div className="ms-big-emoji">🩷</div>
        <h2 className="ms-section-title" style={{fontSize:"2rem"}}>{drifter.name} was the Drifter!</h2>
        <p className="ms-muted" style={{marginBottom:20}}>One chance to guess the Natives’ secret word. Get it right to steal the round.</p>
        <div style={{marginBottom:16,textAlign:"left"}}>
          <h3 style={{marginBottom:8,fontSize:".95rem"}}>Clues this round</h3>
          <div className="ms-reveal-list" style={{marginTop:0}}>
            {state.players.filter(p=>p.alive || p.seat===drifter.seat).map(p => {
              const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
              return (
                <div className="ms-reveal-item" key={p.seat}>
                  <div>
                    <strong>{p.emoji ? p.emoji+" " : ""}{p.name}</strong>
                    <div style={{fontSize:".78rem",color:"var(--ms-muted)",marginTop:2}}>{clues || "No clue"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {isAi ? (
          <div className="ms-thinking" style={{justifyContent:"center"}}><span className="ms-dot"/><span className="ms-dot"/><span className="ms-dot"/> {drifter.name} is guessing...</div>
        ) : (
          <>
            <input className="ms-input" value={guess} maxLength={40} placeholder="Guess the Native word..." onChange={e=>setGuess(e.target.value)} onKeyDown={e=>{if(e.key==="Enter" && guess.trim()) setState(prev=>prev?submitDrifterGuess(prev,guess.trim()):prev);}} style={{textAlign:"center",fontSize:"1.1rem"}} />
            <div className="ms-actions" style={{justifyContent:"center",marginTop:16}}>
              <button className="ms-btn ms-btn-primary" disabled={!guess.trim()} onClick={()=>setState(prev=>prev?submitDrifterGuess(prev,guess.trim()):prev)}>Submit guess</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoundResultScreen({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState | null>> }) {
  const result = state.results[state.results.length - 1];
  if (!result) return null;
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong ms-result">
        <p className="ms-kicker">Round {result.round} result</p>
        <div className="ms-big-emoji">{result.winner === "natives" ? "🟢" : result.winner === "drifter_steal" ? "🩷" : result.winner === "infiltrators" ? "🟡" : "🔍"}</div>
        <div className="big">{result.winner === "natives" ? "Natives win!" : result.winner === "drifter_steal" ? "Drifter steal!" : result.winner === "infiltrators" ? "Infiltrators win!" : "Round continues"}</div>
        <p className="summary">{result.summary}</p>
        <div className="ms-reveal-list">
          {state.players.map(p => {
            const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
            return (
              <div className="ms-reveal-item" key={p.seat} style={{alignItems:"flex-start"}}>
                <div>
                  <strong>{p.emoji ? p.emoji+" " : ""}{p.name}</strong> {!p.alive ? <span style={{color:"var(--ms-dim)"}}>(out)</span> : ""}
                  {clues && <div style={{fontSize:".78rem",color:"var(--ms-muted)",marginTop:2}}>{clues}</div>}
                </div>
                <span className={cx("ms-role-badge", roleBadge(p.role))}>{roleLabel(p.role)}</span>
              </div>
            );
          })}
        </div>
        <div className="ms-divider" />
        <div className="ms-scoreboard">
          <div className="ms-score-row"><span>Natives score</span><strong>{Math.max(0,...state.players.filter(p=>p.role==="native").map(p=>p.score))}</strong></div>
          <div className="ms-score-row"><span>Tourists & Drifters score</span><strong>{Math.max(0,...state.players.filter(p=>p.role==="tourist"||p.role==="drifter").map(p=>p.score))}</strong></div>
        </div>
        <div className="ms-actions" style={{justifyContent:"center"}}>
          {result.winner ? <button className="ms-btn ms-btn-primary" onClick={()=>setState(prev=>prev?nextRound(prev):prev)}>Next round</button> : <button className="ms-btn ms-btn-primary" onClick={()=>setState(prev=>prev?continueAfterNoWinner(prev):prev)}>Continue</button>}
        </div>
      </div>
    </div>
  );
}

function MatchEndScreen({ state, onExit, onNewGame }: { state: GameState; onExit: () => void; onNewGame: () => void }) {
  const winner = state.winner;
  return (
    <div className="ms-center">
      <div className="ms-card ms-card-strong ms-result">
        <p className="ms-kicker">Match over</p>
        <div className="ms-big-emoji">{winner === "natives" ? "🏆" : "🎭"}</div>
        <div className="big">{winner === "natives" ? "Natives win the match!" : "Tourists & Drifters win the match!"}</div>
        <p className="summary">Final score target was {state.scoreTarget}. Play again with new words and random roles.</p>
        <div className="ms-reveal-list">
          {state.players.map(p => {
            const clues = state.clues.filter(c=>c.round===state.round && c.seat===p.seat).map(c=>c.text).join(" · ");
            return (
              <div className="ms-reveal-item" key={p.seat} style={{alignItems:"flex-start"}}>
                <div>
                  <strong>{p.emoji ? p.emoji+" " : ""}{p.name}</strong>
                  {clues && <div style={{fontSize:".78rem",color:"var(--ms-muted)",marginTop:2}}>{clues}</div>}
                </div>
                <span className={cx("ms-role-badge", roleBadge(p.role))}>{roleLabel(p.role)} · {p.score}</span>
              </div>
            );
          })}
        </div>
        <div className="ms-actions" style={{justifyContent:"center",marginTop:20,gap:12,flexWrap:"wrap"}}>
          <button className="ms-btn ms-btn-primary" onClick={onNewGame}>New game with same setup</button>
          <button className="ms-btn ms-btn-secondary" onClick={onExit}>Back to Misclue</button>
        </div>
      </div>
    </div>
  );
}
