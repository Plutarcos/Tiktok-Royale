
import React, { useState, useEffect, useRef } from 'react';
import { Player, GameMode, GameState, Obstacle, WorldConfig, SpawnLayout } from './types';
import SimulationEngine from './components/SimulationEngine';
import { 
  MousePointer2, Play, Square as SquareIcon, 
  Trash2, XCircle, MapPin, 
  Grid3X3, Hammer, X, LayoutGrid, Rows, Columns,
  MinusCircle, PlusCircle, Dices, Users, Loader2, Flag, Trash, RotateCw, Heart, 
  RotateCcw, Pause, PlayCircle, Video, VideoOff
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
  const engineRef = useRef<{ getAudioStream: () => MediaStream | null }> (null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        // Ao fim da contagem, iniciamos com velocidade
        setGameState(prev => ({ 
          ...prev, 
          isRunning: true,
          players: prev.players.map(p => {
            const angle = Math.random() * Math.PI * 2;
            return { ...p, vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5 };
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
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264') 
      ? 'video/webm;codecs=h264' 
      : 'video/webm;codecs=vp9';

    const recorder = new MediaRecorder(combinedStream, { mimeType });
    chunksRef.current = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleStartRecordingAndSim = () => {
    if (!isRecording) {
      startRecording();
    }
    // Sempre reinicia a simulação se clicar em gravar (para pegar a contagem)
    handleRestartSimulation();
  };

  const importFollowers = () => {
    if (!tiktokUser) return;
    setIsImporting(true);
    setTimeout(() => {
      const count = 20 + Math.floor(Math.random() * 30);
      const followers = generateMockFollowers(count);
      const currentSpawnX = gameState.players[0]?.spawnX || 225;
      const currentSpawnY = gameState.players[0]?.spawnY || 125;
      setGameState(s => ({
        ...s,
        players: applySpawnLayout(currentSpawnX, currentSpawnY, s.config.spawnLayout, followers)
      }));
      setIsImporting(false);
    }, 1200);
  };

  const applySpawnLayout = (x: number, y: number, layout: SpawnLayout, players: Player[]) => {
    const spacing = 32;
    const boxSize = 30;
    return players.map((p, i) => {
      let nx = x, ny = y;
      if (layout === 'square') {
        if (i === 0) { nx = x - boxSize/2; ny = y - boxSize/2; }
        else if (i === 1) { nx = x + boxSize/2; ny = y - boxSize/2; }
        else if (i === 2) { nx = x - boxSize/2; ny = y + boxSize/2; }
        else if (i === 3) { nx = x + boxSize/2; ny = y + boxSize/2; }
        else { 
          const angle = (i / players.length) * Math.PI * 2;
          const radius = boxSize + (Math.floor(i/4) * spacing);
          nx = x + Math.cos(angle) * radius; 
          ny = y + Math.sin(angle) * radius;
        }
      } else if (layout === 'horizontal') {
        nx = x + (i - (players.length - 1) / 2) * spacing;
      } else if (layout === 'vertical') {
        ny = y + (i - (players.length - 1) / 2) * spacing;
      }
      return { ...p, x: nx, y: ny, spawnX: nx, spawnY: ny, vx: 0, vy: 0, isEliminated: false, finished: false, usedPowerups: [] };
    });
  };

  const handleLayoutChange = (layout: SpawnLayout) => {
    const p1 = gameState.players[0];
    if (!p1) return;
    setGameState(s => ({
      ...s,
      config: { ...s.config, spawnLayout: layout },
      players: applySpawnLayout(p1.spawnX, p1.spawnY, layout, s.players)
    }));
  };

  const handleRestartSimulation = () => {
    setIsGameEnded(false);
    setGameState(prev => ({ 
      ...prev, mode: GameMode.SIMULATING, isRunning: false, winner: null,
      players: prev.players.map(p => ({ ...p, isEliminated: false, size: p.initialSize, x: p.spawnX, y: p.spawnY, vx: 0, vy: 0, usedPowerups: [], finished: false, health: 100 }))
    }));
    setCountdown(3);
  };

  const startSimulation = () => {
    if (gameState.mode === GameMode.EDITOR || gameState.winner || isGameEnded) {
      handleRestartSimulation();
    } else {
      setGameState(prev => ({ ...prev, isRunning: true }));
    }
  };

  const pauseSimulation = () => {
    setGameState(prev => ({ ...prev, isRunning: false }));
  };

  const resetSimulation = () => {
    setCountdown(null);
    setIsGameEnded(false);
    setGameState(prev => ({
      ...prev, isRunning: false, winner: null,
      players: prev.players.map(p => ({ ...p, x: p.spawnX, y: p.spawnY, vx: 0, vy: 0, size: p.initialSize, isEliminated: false, usedPowerups: [], finished: false, health: 100 }))
    }));
  };

  const stopSimAndEdit = () => {
    setCountdown(null);
    setIsGameEnded(false);
    // Não paramos a gravação automaticamente para deixar o usuário decidir
    setGameState(prev => ({
      ...prev, mode: GameMode.EDITOR, isRunning: false, winner: null,
      players: prev.players.map(p => ({ ...p, x: p.spawnX, y: p.spawnY, vx: 0, vy: 0, size: p.initialSize, isEliminated: false, usedPowerups: [] }))
    }));
  };

  const generateRandomMap = () => {
    const newObstacles: Obstacle[] = [];
    const canvasWidth = 450;
    const canvasHeight = 800;
    
    const side = Math.floor(Math.random() * 4);
    let spawnX = 225, spawnY = 100;
    let finishX = 225, finishY = 700;
    
    if (side === 0) { spawnX = 50 + Math.random() * (canvasWidth - 100); spawnY = 80; finishX = 50 + Math.random() * (canvasWidth - 100); finishY = canvasHeight - 80; }
    else if (side === 1) { spawnX = 50 + Math.random() * (canvasWidth - 100); spawnY = canvasHeight - 80; finishX = 50 + Math.random() * (canvasWidth - 100); finishY = 80; }
    else if (side === 2) { spawnX = 80; spawnY = 100 + Math.random() * (canvasHeight - 200); finishX = canvasWidth - 120; finishY = 100 + Math.random() * (canvasHeight - 200); }
    else { spawnX = canvasWidth - 80; spawnY = 100 + Math.random() * (canvasHeight - 200); finishX = 80; finishY = 100 + Math.random() * (canvasHeight - 200); }

    newObstacles.push({ id: 'finish-line', x: finishX - 50, y: finishY - 20, width: 100, height: 40, type: 'finish', color: '#22c55e', rotation: 0 });

    const rows = 12; const cols = 7;
    const cellW = canvasWidth / cols; const cellH = canvasHeight / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cellW; const cy = r * cellH;
        const distToSpawn = Math.sqrt(Math.pow(cx + cellW/2 - spawnX, 2) + Math.pow(cy + cellH/2 - spawnY, 2));
        const distToFinish = Math.sqrt(Math.pow(cx + cellW/2 - finishX, 2) + Math.pow(cy + cellH/2 - finishY, 2));
        if (distToSpawn < 100 || distToFinish < 100) continue;

        const roll = Math.random();
        if (roll < 0.35) {
          const isVert = Math.random() > 0.5;
          newObstacles.push({ id: `wall-${r}-${c}`, x: cx + 10, y: cy + 10, width: isVert ? 15 : cellW - 20, height: isVert ? cellH - 20 : 15, type: 'wall', color: COLORS_THEME[Math.floor(Math.random() * COLORS_THEME.length)].hex, rotation: 0 });
        } else if (roll < 0.45) {
          newObstacles.push({ id: `death-${r}-${c}`, x: cx + cellW/4, y: cy + cellH/4, width: cellW/2, height: cellH/2, type: 'death', rotation: Math.random() < 0.5 ? 45 : 0 });
        } else if (roll < 0.52) {
          const isShrink = Math.random() > 0.5;
          newObstacles.push({ id: `pwr-${r}-${c}`, x: cx + cellW/4, y: cy + cellH/4, width: cellW/2, height: cellH/2, type: 'powerup', powerupType: isShrink ? 'shrink' : 'grow', rotation: 0 });
        } else if (roll < 0.60) {
          newObstacles.push({ id: `dest-${r}-${c}`, x: cx + 5, y: cy + 5, width: cellW - 10, height: cellH - 10, type: 'destructible', health: 3, color: '#f97316' });
        }
      }
    }

    setGameState(s => ({ ...s, obstacles: newObstacles, players: applySpawnLayout(spawnX, spawnY, s.config.spawnLayout, s.players) }));
  };

  const clearBuild = () => {
    if (window.confirm("Limpar todo o mapa?")) {
      setGameState(s => ({ ...s, obstacles: [] }));
      setSelectedId(null);
    }
  };

  const handleUpdateSpawn = (x: number, y: number) => {
    setGameState(s => ({ ...s, players: applySpawnLayout(x, y, s.config.spawnLayout, s.players) }));
  };

  const handleAddObstacle = (obs: Obstacle) => {
    let finalType = obs.type;
    let powerupType: Obstacle['powerupType'] = undefined;
    if ((tool as string) === 'shrink') { finalType = 'powerup'; powerupType = 'shrink'; }
    else if ((tool as string) === 'grow') { finalType = 'powerup'; powerupType = 'grow'; }
    setGameState(s => ({...s, obstacles: [...s.obstacles, { ...obs, type: finalType, powerupType, color: selectedColor, health: finalType === 'destructible' ? (obs.health || 3) : 1 }]}));
  };

  const handleUpdateObstacle = (updated: Obstacle) => setGameState(s => ({ ...s, obstacles: s.obstacles.map(o => o.id === updated.id ? updated : o) }));
  const handleRemoveObstacle = (id: string) => { setGameState(s => ({ ...s, obstacles: s.obstacles.filter(o => o.id !== id) })); if (selectedId === id) setSelectedId(null); };

  const selectedObstacle = gameState.obstacles.find(o => o.id === selectedId);

  return (
    <div className="min-h-screen bg-[#08080a] text-[#e2e8f0] font-sans flex flex-col overflow-hidden">
      <header className="bg-[#0f0f12] border-b border-white/5 px-6 py-3 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#ff0050] rounded-lg flex items-center justify-center rotate-3 shadow-[0_0_15px_rgba(255,0,80,0.4)]">
            <SquareIcon className="text-white w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic font-bungee">TIKTOK<span className="text-[#00f2ea]">ROYALE</span></h1>
        </div>

        <div className="flex-1 max-w-md mx-8 flex items-center justify-center gap-4">
          {gameState.mode === GameMode.EDITOR ? (
            <div className="w-full flex gap-2">
              <input 
                type="text" 
                placeholder="Username do TikTok..." 
                value={tiktokUser}
                onChange={e => setTiktokUser(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-sm font-bold focus:border-[#00f2ea]/50 transition-all outline-none"
              />
              <button 
                onClick={importFollowers}
                disabled={!tiktokUser || isImporting}
                className="bg-[#00f2ea] hover:bg-[#00f2ea]/80 text-black px-6 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : 'CONVOCAR'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={resetSimulation} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 text-white transition-all flex items-center gap-2 group" title="Resetar Posições">
                <RotateCcw size={20} className="group-active:rotate-[-180deg] transition-transform duration-500" />
                <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Resetar</span>
              </button>
              
              {gameState.isRunning ? (
                <button onClick={pauseSimulation} className="p-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2" title="Pausar">
                  <Pause size={24} fill="currentColor" />
                  <span className="text-xs font-black uppercase tracking-wider">Pausar</span>
                </button>
              ) : (
                <button onClick={startSimulation} className="p-4 bg-[#00f2ea] text-black rounded-2xl hover:bg-[#00f2ea]/80 transition-all shadow-lg shadow-[#00f2ea]/20 flex items-center gap-2" title="Iniciar">
                  <Play size={24} fill="currentColor" />
                  <span className="text-xs font-black uppercase tracking-wider">Iniciar</span>
                </button>
              )}

              <div className="h-8 w-px bg-white/10 mx-2" />

              {!isRecording ? (
                <button onClick={handleStartRecordingAndSim} className="p-4 bg-red-600 text-white rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 flex items-center gap-2" title="Gravar e Iniciar">
                  <Video size={24} />
                  <span className="text-xs font-black uppercase tracking-wider">Gravar</span>
                </button>
              ) : (
                <button onClick={stopRecording} className="p-4 bg-slate-700 text-white rounded-2xl hover:bg-slate-600 transition-all flex items-center gap-2" title="Parar Gravação">
                  <VideoOff size={24} />
                  <span className="text-xs font-black uppercase tracking-wider">Parar</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full border border-red-500/50 animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-[10px] font-black uppercase text-red-500">Rec 🔴</span>
            </div>
          )}
          <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
            <button onClick={stopSimAndEdit} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${gameState.mode === GameMode.EDITOR ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>EDITOR</button>
            <button onClick={() => setGameState(s => ({ ...s, mode: GameMode.SIMULATING }))} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${gameState.mode === GameMode.SIMULATING ? 'bg-[#ff0050] text-white shadow-lg shadow-[#ff0050]/20' : 'text-slate-500 hover:text-slate-300'}`}>SIMULAR</button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {gameState.mode === GameMode.EDITOR && (
          <aside className="w-80 bg-[#0f0f12] border-r border-white/5 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                   <p className="text-[10px] font-black text-[#00f2ea] uppercase tracking-widest">Map Builder</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={generateRandomMap} className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all hover:scale-110" title="Gerar Labirinto Aleatório"><Dices size={18} /></button>
                  <button onClick={() => setUseSnap(!useSnap)} className={`p-2 border rounded-lg transition-all ${useSnap ? 'bg-[#00f2ea]/10 border-[#00f2ea] text-[#00f2ea]' : 'border-white/10 text-slate-500'}`}><Grid3X3 size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={18} />} label="Mover" color="text-amber-400" />
                <ToolBtn active={tool === 'spawn'} onClick={() => setTool('spawn')} icon={<MapPin size={18} />} label="Início" color="text-[#00f2ea]" />
                <ToolBtn active={tool === 'wall'} onClick={() => setTool('wall')} icon={<SquareIcon size={18} />} label="Parede" color="text-slate-300" />
                <ToolBtn active={tool === 'finish'} onClick={() => setTool('finish')} icon={<Flag size={18} />} label="Chegada" color="text-green-400" />
                <ToolBtn active={tool === 'destructible'} onClick={() => setTool('destructible')} icon={<Hammer size={18} />} label="Quebrável" color="text-orange-400" />
                <ToolBtn active={tool === 'death'} onClick={() => setTool('death')} icon={<XCircle size={18} />} label="Morte" color="text-red-500" />
              </div>
            </section>

            <section className="pt-4 border-t border-white/5">
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3">Powerups</p>
              <div className="grid grid-cols-2 gap-2">
                <ToolBtn active={tool === 'shrink'} onClick={() => setTool('shrink')} icon={<MinusCircle size={18} />} label="Mini" color="text-purple-400" />
                <ToolBtn active={tool === 'grow'} onClick={() => setTool('grow')} icon={<PlusCircle size={18} />} label="Maxi" color="text-orange-400" />
              </div>
            </section>

            {selectedObstacle && (
              <section className="pt-4 border-t border-white/5 bg-black/20 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Propriedades</p>
                  <button onClick={() => handleRemoveObstacle(selectedId!)} className="text-red-500 hover:bg-red-500/10 p-1 rounded-md transition-colors"><Trash2 size={14}/></button>
                </div>
                
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Cores</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS_THEME.map(c => (
                      <button 
                        key={c.hex} 
                        onClick={() => handleUpdateObstacle({...selectedObstacle, color: c.hex})} 
                        className={`w-6 h-6 rounded-md border-2 transition-all ${selectedObstacle.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                        style={{ backgroundColor: c.hex }} 
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Rotação</p>
                    <span className="text-[10px] font-mono text-amber-500 font-bold">{selectedObstacle.rotation || 0}°</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RotateCw size={14} className="text-slate-500" />
                    <input 
                      type="range" min={0} max={360} step={45} 
                      value={selectedObstacle.rotation || 0} 
                      onChange={e => handleUpdateObstacle({...selectedObstacle, rotation: parseInt(e.target.value)})} 
                      className="flex-1 accent-[#00f2ea] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                </div>

                {selectedObstacle.type === 'destructible' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Resistência (Hits)</p>
                      <span className="text-[10px] font-mono text-orange-500 font-bold">{selectedObstacle.health || 3}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Heart size={14} className="text-slate-500" />
                      <input 
                        type="range" min={1} max={10} step={1} 
                        value={selectedObstacle.health || 3} 
                        onChange={e => handleUpdateObstacle({...selectedObstacle, health: parseInt(e.target.value)})} 
                        className="flex-1 accent-orange-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" 
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="pt-4 border-t border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Spawn Layout</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleLayoutChange('square')} className={`p-2 rounded-lg border transition-all ${gameState.config.spawnLayout === 'square' ? 'bg-[#00f2ea]/10 border-[#00f2ea] text-[#00f2ea]' : 'border-white/5 text-slate-500 hover:bg-white/5'}`}><LayoutGrid size={16}/></button>
                <button onClick={() => handleLayoutChange('horizontal')} className={`p-2 rounded-lg border transition-all ${gameState.config.spawnLayout === 'horizontal' ? 'bg-[#00f2ea]/10 border-[#00f2ea] text-[#00f2ea]' : 'border-white/5 text-slate-500 hover:bg-white/5'}`}><Rows size={16}/></button>
                <button onClick={() => handleLayoutChange('vertical')} className={`p-2 rounded-lg border transition-all ${gameState.config.spawnLayout === 'vertical' ? 'bg-[#00f2ea]/10 border-[#00f2ea] text-[#00f2ea]' : 'border-white/5 text-slate-500 hover:bg-white/5'}`}><Columns size={16}/></button>
              </div>
            </section>

            <button onClick={clearBuild} className="mt-auto w-full p-4 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
              <Trash size={14} /> Limpar Mapa
            </button>
          </aside>
        )}
        <main className="flex-1 relative bg-[#050505] flex flex-col items-center justify-center p-4 overflow-hidden">
          <SimulationEngine 
            ref={engineRef}
            state={gameState} 
            tool={tool as any} 
            useSnap={useSnap} 
            selectedId={selectedId} 
            countdown={countdown}
            onUpdatePlayers={(p) => setGameState(s => ({...s, players: p}))} 
            onUpdateSpawn={handleUpdateSpawn} 
            onAddObstacle={handleAddObstacle} 
            onUpdateObstacle={handleUpdateObstacle} 
            onRemoveObstacle={handleRemoveObstacle} 
            onSelectObstacle={setSelectedId} 
            onFinish={(w) => { 
                setGameState(s => ({...s, winner: w, isRunning: false})); 
                setIsGameEnded(true); 
            }} 
          />
          
          {isGameEnded && (
            <div className="absolute top-10 right-10 z-[100] animate-in slide-in-from-top-10 duration-500 flex flex-col gap-3">
               <button onClick={handleRestartSimulation} className="bg-[#00f2ea] text-black px-6 py-3 rounded-xl font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                 <RotateCcw size={16} /> RECOMEÇAR
               </button>
               <button onClick={stopSimAndEdit} className="bg-white text-black px-6 py-3 rounded-xl font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">VOLTAR AO EDITOR</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, label, color }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${active ? 'bg-white/10 border-white/20 scale-105 shadow-lg' : 'border-transparent hover:bg-white/5 opacity-60'}`}>
    <div className={color}>{icon}</div><span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
  </button>
);

export default App;
