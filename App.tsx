
import React, { useState, useEffect, useRef } from 'react';
import { Player, GameMode, GameState, Obstacle, WorldConfig, SpawnLayout } from './types';
import SimulationEngine from './components/SimulationEngine';
import { 
  MousePointer2, Play, Square as SquareIcon, 
  Trash2, XCircle, MapPin, 
  Hammer, Flag, Trash, 
  RotateCcw, Pause, Video, VideoOff, RefreshCw,
  MinusCircle, PlusCircle, Dices, Loader2, ArrowRight
} from 'lucide-react';
import { generateMockFollowers } from './utils/mockData';

const INITIAL_CONFIG: WorldConfig = {
  gravity: 0, friction: 1.0, bounce: 1.0, playerSpeed: 1.0, aiForce: 0, spawnLayout: 'square'
};

const COLORS_THEME = [
  { name: 'TikTok Pink', hex: '#ff0050' }, { name: 'TikTok Cyan', hex: '#00f2ea' },
  { name: 'TikTok White', hex: '#ffffff' }, { name: 'TikTok Yellow', hex: '#ffcc00' },
  { name: 'TikTok Purple', hex: '#a855f7' }, { name: 'TikTok Orange', hex: '#f97316' },
  { name: 'Slate', hex: '#94a3b8' }, { name: 'Dark', hex: '#1a1a1e' },
];

const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: 'Azul', health: 100, x: 210, y: 110, vx: 0, vy: 0, size: 24, initialSize: 24, isEliminated: false, color: '#3b82f6', finished: false, spawnX: 210, spawnY: 110, usedPowerups: [] },
  { id: 'p2', name: 'Vermelho', health: 100, x: 240, y: 110, vx: 0, vy: 0, size: 24, initialSize: 24, isEliminated: false, color: '#ef4444', finished: false, spawnX: 240, spawnY: 110, usedPowerups: [] },
  { id: 'p3', name: 'Amarelo', health: 100, x: 210, y: 140, vx: 0, vy: 0, size: 24, initialSize: 24, isEliminated: false, color: '#eab308', finished: false, spawnX: 210, spawnY: 140, usedPowerups: [] },
  { id: 'p4', name: 'Verde', health: 100, x: 240, y: 140, vx: 0, vy: 0, size: 24, initialSize: 24, isEliminated: false, color: '#10b981', finished: false, spawnX: 240, spawnY: 140, usedPowerups: [] },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    players: INITIAL_PLAYERS, obstacles: [], mode: GameMode.EDITOR, isRunning: false, winner: null, config: INITIAL_CONFIG,
  });
  
  const [mapSnapshot, setMapSnapshot] = useState<Obstacle[]>([]);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tool, setTool] = useState<Obstacle['type'] | 'select' | 'shrink' | 'grow' | 'spawn'>('wall');
  const [selectedColor, setSelectedColor] = useState('#1a1a1e');
  const [useSnap, setUseSnap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tiktokUser, setTiktokUser] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const engineRef = useRef<{ getAudioStream: () => MediaStream | null, resetTime: () => void, stopSimulation: () => void }>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        engineRef.current?.resetTime(); 
        setGameState(prev => ({ 
          ...prev, 
          isRunning: true,
          players: prev.players.map(p => {
            const angle = Math.random() * Math.PI * 2;
            return { ...p, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4 };
          })
        }));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const startRecording = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const audioStream = engineRef.current?.getAudioStream();
    const canvasStream = canvas.captureStream(60);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioStream) tracks.push(...audioStream.getAudioTracks());

    const combinedStream = new MediaStream(tracks);
    const recorder = new MediaRecorder(combinedStream, { 
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' : 'video/webm' 
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiktok-royale-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const importFollowers = async () => {
    if (!tiktokUser) return;
    setIsImporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const mockFollowers = generateMockFollowers(16);
      setGameState(prev => {
        const sx = prev.players[0]?.spawnX || 225;
        const sy = prev.players[0]?.spawnY || 100;
        return {
          ...prev,
          players: applySpawnLayout(sx, sy, prev.config.spawnLayout, mockFollowers)
        };
      });
      setTiktokUser('');
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleSimulation = () => {
    if (gameState.isRunning) {
      setGameState(prev => ({ ...prev, isRunning: false }));
    } else {
      if (isGameEnded || gameState.mode === GameMode.EDITOR || gameState.winner || gameState.players.every(p => p.vx === 0)) {
        setIsGameEnded(false);
        const currentObstacles = gameState.mode === GameMode.EDITOR 
          ? JSON.parse(JSON.stringify(gameState.obstacles)) 
          : mapSnapshot;

        if (gameState.mode === GameMode.EDITOR) {
          setMapSnapshot(currentObstacles);
        }

        // Reseta o tempo no engine
        engineRef.current?.stopSimulation();

        setGameState(prev => ({
          ...prev, 
          mode: GameMode.SIMULATING, 
          isRunning: false, 
          winner: null,
          obstacles: JSON.parse(JSON.stringify(currentObstacles)),
          players: prev.players.map(p => ({
            ...p, x: p.spawnX, y: p.spawnY, vx: 0, vy: 0, isEliminated: false, finished: false, health: 100, size: p.initialSize, usedPowerups: []
          }))
        }));
        setCountdown(3);
      } else {
        setGameState(prev => ({ ...prev, isRunning: true }));
      }
    }
  };

  const handleResetSimulation = () => {
    setCountdown(null);
    setIsGameEnded(false);
    engineRef.current?.stopSimulation();
    setGameState(prev => ({
      ...prev, 
      isRunning: false, 
      winner: null,
      obstacles: JSON.parse(JSON.stringify(mapSnapshot)),
      players: prev.players.map(p => ({
        ...p, x: p.spawnX, y: p.spawnY, vx: 0, vy: 0, isEliminated: false, finished: false, health: 100, size: p.initialSize, usedPowerups: []
      }))
    }));
  };

  const applySpawnLayout = (x: number, y: number, layout: SpawnLayout, players: Player[]) => {
    const spacing = 32;
    return players.map((p, i) => {
      let nx = x, ny = y;
      if (layout === 'square') { nx = x + (i % 2 - 0.5) * spacing; ny = y + (Math.floor(i / 2) - 0.5) * spacing; }
      else if (layout === 'horizontal') { nx = x + (i - (players.length - 1) / 2) * spacing; }
      else if (layout === 'vertical') { ny = y + (i - (players.length - 1) / 2) * spacing; }
      return { ...p, x: nx, y: ny, spawnX: nx, spawnY: ny, vx: 0, vy: 0, isEliminated: false, finished: false, usedPowerups: [], health: 100 };
    });
  };

  const generateWinnableMap = () => {
    const newObstacles: Obstacle[] = [];
    const canvasWidth = 450; const canvasHeight = 800;
    const spawnX = 225, spawnY = 80; const finishX = 225, finishY = 720;
    newObstacles.push({ id: 'finish-line', x: finishX - 60, y: finishY - 15, width: 120, height: 30, type: 'finish', color: '#22c55e', rotation: 0 });
    const rows = 10, cols = 6; const cellW = canvasWidth / cols, cellH = (canvasHeight - 200) / rows; const startY = 150;
    const mainPath: {r: number, c: number}[] = []; let curR = 0, curC = Math.floor(cols / 2);
    while (curR < rows) { mainPath.push({r: curR, c: curC}); const move = Math.random(); if (move < 0.3 && curC > 0) curC--; else if (move < 0.6 && curC < cols - 1) curC++; else curR++; }
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) { if (mainPath.some(p => p.r === r && p.c === c)) continue; const x = c * cellW + cellW * 0.1, y = startY + r * cellH + cellH * 0.1; const w = cellW * 0.8, h = cellH * 0.8; const roll = Math.random(); if (roll < 0.4) newObstacles.push({ id: `wall-${r}-${c}`, x, y, width: w, height: h * 0.2, type: 'wall', color: COLORS_THEME[Math.floor(Math.random() * COLORS_THEME.length)].hex }); else if (roll < 0.55) newObstacles.push({ id: `dest-${r}-${c}`, x, y, width: w * 0.6, height: h * 0.6, type: 'destructible', health: 3, color: '#f97316' }); else if (roll < 0.65) newObstacles.push({ id: `death-${r}-${c}`, x: x + w*0.25, y: y + h*0.25, width: w*0.5, height: h*0.5, type: 'death' }); else if (roll < 0.72) newObstacles.push({ id: `pwr-${r}-${c}`, x: x + w*0.3, y: y + h*0.3, width: w*0.4, height: h*0.4, type: 'powerup', powerupType: Math.random() > 0.5 ? 'shrink' : 'grow' }); } }
    setGameState(s => ({ ...s, obstacles: newObstacles, players: applySpawnLayout(spawnX, spawnY, s.config.spawnLayout, s.players) }));
  };

  const selectedObstacle = gameState.obstacles.find(o => o.id === selectedId);

  return (
    <div className="min-h-screen bg-[#08080a] text-[#e2e8f0] font-sans flex flex-col overflow-hidden">
      <header className="bg-[#0f0f12] border-b border-white/5 px-6 py-3 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ff0050] rounded-lg flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(255,0,80,0.4)]"><SquareIcon className="text-white w-5 h-5 fill-current" /></div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic font-bungee">TIKTOK<span className="text-[#00f2ea]">ROYALE</span></h1>
        </div>
        <div className="flex items-center gap-3">
          {gameState.mode === GameMode.SIMULATING ? (
            <>
              <button onClick={handleResetSimulation} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 group"><RotateCcw size={20} className="group-active:rotate-[-180deg] transition-transform" /><span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Reset</span></button>
              <button onClick={handleToggleSimulation} className={`p-4 rounded-2xl transition-all shadow-lg flex items-center gap-2 ${gameState.isRunning ? 'bg-amber-500 text-black' : 'bg-[#00f2ea] text-black'}`}>{gameState.isRunning ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}<span className="text-xs font-black uppercase tracking-wider">{gameState.isRunning ? 'Pausar' : 'Iniciar'}</span></button>
              <div className="h-8 w-px bg-white/10 mx-2" />
              <button onClick={() => isRecording ? (mediaRecorderRef.current?.stop(), setIsRecording(false)) : (startRecording(), handleToggleSimulation())} className={`p-4 rounded-2xl transition-all flex items-center gap-2 shadow-lg ${isRecording ? 'bg-slate-700 text-white' : 'bg-red-600 text-white shadow-red-600/20'}`}>{isRecording ? <VideoOff size={24} /> : <Video size={24} />}<span className="text-xs font-black uppercase tracking-wider">{isRecording ? 'Parar' : 'Gravar'}</span></button>
            </>
          ) : (
            <div className="flex gap-2">
              <input type="text" placeholder="TikTok Username..." value={tiktokUser} onChange={e => setTiktokUser(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-sm font-bold focus:border-[#00f2ea]/50 outline-none w-48" />
              <button onClick={importFollowers} disabled={!tiktokUser || isImporting} className="bg-[#00f2ea] hover:bg-[#00f2ea]/80 text-black px-6 rounded-xl text-[10px] font-black uppercase disabled:opacity-30">{isImporting ? <Loader2 size={14} className="animate-spin" /> : 'CONVOCAR'}</button>
            </div>
          )}
        </div>
        <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/5">
          <button onClick={() => { engineRef.current?.stopSimulation(); setGameState(s => ({ ...s, mode: GameMode.EDITOR, isRunning: false, obstacles: mapSnapshot.length > 0 ? JSON.parse(JSON.stringify(mapSnapshot)) : s.obstacles })); }} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${gameState.mode === GameMode.EDITOR ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>EDITOR</button>
          <button onClick={() => { if (gameState.mode === GameMode.EDITOR) setMapSnapshot(JSON.parse(JSON.stringify(gameState.obstacles))); setGameState(s => ({ ...s, mode: GameMode.SIMULATING })); }} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${gameState.mode === GameMode.SIMULATING ? 'bg-[#ff0050] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>SIMULAR</button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        {gameState.mode === GameMode.EDITOR && (
          <aside className="w-80 bg-[#0f0f12] border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between"><p className="text-[10px] font-black text-[#00f2ea] uppercase tracking-widest">Builder Tools</p><button onClick={generateWinnableMap} className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg hover:bg-amber-500/20"><Dices size={18} /></button></div>
            <div className="grid grid-cols-2 gap-2">
              <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={18} />} label="Mover" color="text-amber-400" />
              <ToolBtn active={tool === 'spawn'} onClick={() => setTool('spawn')} icon={<MapPin size={18} />} label="Início" color="text-[#00f2ea]" />
              <ToolBtn active={tool === 'wall'} onClick={() => setTool('wall')} icon={<SquareIcon size={18} />} label="Parede" color="text-slate-300" />
              <ToolBtn active={tool === 'filling_wall'} onClick={() => setTool('filling_wall')} icon={<ArrowRight size={18} />} label="Enchimento" color="text-[#00f2ea]" />
              <ToolBtn active={tool === 'finish'} onClick={() => setTool('finish')} icon={<Flag size={18} />} label="Chegada" color="text-green-400" />
              <ToolBtn active={tool === 'destructible'} onClick={() => setTool('destructible')} icon={<Hammer size={18} />} label="Quebrável" color="text-orange-400" />
              <ToolBtn active={tool === 'death'} onClick={() => setTool('death')} icon={<XCircle size={18} />} label="Morte" color="text-red-500" />
              <ToolBtn active={tool === 'shrink'} onClick={() => setTool('shrink')} icon={<MinusCircle size={18} />} label="Mini" color="text-purple-400" />
              <ToolBtn active={tool === 'grow'} onClick={() => setTool('grow')} icon={<PlusCircle size={18} />} label="Maxi" color="text-blue-400" />
            </div>
            {selectedObstacle && (
              <div className="pt-4 border-t border-white/5 bg-black/20 p-4 rounded-xl space-y-4 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between"><p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Propriedades</p><button onClick={() => { setGameState(s => ({ ...s, obstacles: s.obstacles.filter(o => o.id !== selectedId) })); setSelectedId(null); }} className="text-red-500 p-1"><Trash2 size={14}/></button></div>
                <div className="space-y-4">
                  <div className="space-y-2"><div className="flex justify-between text-[9px] font-bold uppercase text-slate-500"><span>Rotação</span><span>{selectedObstacle.rotation || 0}°</span></div><input type="range" min={0} max={360} step={45} value={selectedObstacle.rotation || 0} onChange={e => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, rotation: parseInt(e.target.value)} : o) }))} className="w-full accent-[#00f2ea]" /></div>
                  {selectedObstacle.type === 'filling_wall' && (
                    <><div className="space-y-2"><div className="flex justify-between text-[9px] font-bold uppercase text-slate-500"><span>Início (s)</span><span>{selectedObstacle.fillingStartTime || 0}s</span></div><input type="range" min={0} max={60} step={1} value={selectedObstacle.fillingStartTime || 0} onChange={e => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, fillingStartTime: parseInt(e.target.value)} : o) }))} className="w-full accent-[#ff0050]" /></div><div className="space-y-2"><div className="flex justify-between text-[9px] font-bold uppercase text-slate-500"><span>Duração (s)</span><span>{selectedObstacle.fillingDuration || 5}s</span></div><input type="range" min={1} max={30} step={1} value={selectedObstacle.fillingDuration || 5} onChange={e => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, fillingDuration: parseInt(e.target.value)} : o) }))} className="w-full accent-[#00f2ea]" /></div><div className="space-y-2"><p className="text-[9px] font-bold uppercase text-slate-500">Direção</p><div className="grid grid-cols-4 gap-1">{['up', 'down', 'left', 'right'].map(dir => (<button key={dir} onClick={() => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, fillingDirection: dir as any} : o) }))} className={`p-2 rounded-lg border text-[8px] font-black uppercase transition-all ${selectedObstacle.fillingDirection === dir ? 'bg-[#00f2ea] text-black border-[#00f2ea]' : 'bg-black/40 text-white/40 border-white/5'}`}>{dir}</button>))}</div></div></>
                  )}
                  {selectedObstacle.type === 'destructible' && (<div className="space-y-2"><div className="flex justify-between text-[9px] font-bold uppercase text-slate-500"><span>Vida</span><span>{selectedObstacle.health}</span></div><input type="range" min={1} max={10} step={1} value={selectedObstacle.health} onChange={e => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, health: parseInt(e.target.value)} : o) }))} className="w-full accent-orange-500" /></div>)}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">{COLORS_THEME.map(c => (<button key={c.hex} onClick={() => { setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === selectedId ? {...o, color: c.hex} : o) })); setSelectedColor(c.hex); }} className={`w-6 h-6 rounded-md border-2 ${selectedColor === c.hex ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.hex }} />))}</div>
                </div>
              </div>
            )}
            <button onClick={() => { if (window.confirm("Limpar todo o mapa?")) setGameState(s => ({ ...s, obstacles: [], mapSnapshot: [] })); }} className="mt-auto w-full p-4 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"><Trash size={14} /> Limpar Mapa</button>
          </aside>
        )}
        <main className="flex-1 relative bg-[#050505] flex flex-col items-center justify-center p-4">
          <SimulationEngine 
            ref={engineRef} state={gameState} tool={tool as any} useSnap={useSnap} selectedId={selectedId} countdown={countdown}
            onUpdatePlayers={(p) => setGameState(s => ({...s, players: p}))} 
            onUpdateSpawn={(x, y) => setGameState(s => ({ ...s, players: applySpawnLayout(x, y, s.config.spawnLayout, s.players) }))} 
            onAddObstacle={(obs) => { let finalType = obs.type; let pwr = undefined; if (tool === 'shrink') { finalType = 'powerup'; pwr = 'shrink'; } else if (tool === 'grow') { finalType = 'powerup'; pwr = 'grow'; } setGameState(s => ({...s, obstacles: [...s.obstacles, { ...obs, type: finalType, powerupType: pwr as any, color: selectedColor, health: finalType === 'destructible' ? 3 : 1, fillingStartTime: 0, fillingDuration: 5, fillingDirection: 'down' }]})); }} 
            onUpdateObstacle={(updated) => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === updated.id ? updated : o) }))}
            onRemoveObstacle={(id) => setGameState(s => ({ ...s, obstacles: s.obstacles.filter(o => o.id !== id) }))}
            onSelectObstacle={setSelectedId} 
            onFinish={(w) => { setGameState(s => ({...s, winner: w, isRunning: false})); setIsGameEnded(true); }} 
          />
          {isGameEnded && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
               <div className="bg-[#1a1a1e] border-2 border-[#00f2ea] p-10 rounded-[40px] shadow-2xl flex flex-col items-center gap-6">
                 <p className="font-bungee text-3xl text-white">FIM DA BATALHA!</p>
                 <button onClick={handleResetSimulation} className="w-full bg-[#00f2ea] text-black py-4 px-10 rounded-2xl font-black uppercase hover:scale-105 transition-all flex items-center justify-center gap-3"><RefreshCw size={20} /> REINICIAR</button>
                 <button onClick={() => { engineRef.current?.stopSimulation(); setGameState(s => ({ ...s, mode: GameMode.EDITOR, isRunning: false, winner: null, obstacles: JSON.parse(JSON.stringify(mapSnapshot)) })); setIsGameEnded(false); }} className="w-full bg-white text-black py-4 px-10 rounded-2xl font-black uppercase hover:scale-105 transition-all">VOLTAR AO EDITOR</button>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, label, color }: any) => (<button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${active ? 'bg-white/10 border-white/20 scale-105 shadow-lg' : 'border-transparent hover:bg-white/5 opacity-60'}`}><div className={color}>{icon}</div><span className="text-[10px] font-bold uppercase text-slate-400">{label}</span></button>);

export default App;
