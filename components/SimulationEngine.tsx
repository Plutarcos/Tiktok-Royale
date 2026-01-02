
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Player, GameMode, GameState, Obstacle } from '../types';

interface EngineProps {
  state: GameState;
  tool: Obstacle['type'] | 'select' | 'shrink' | 'grow' | 'spawn';
  useSnap: boolean;
  selectedId: string | null;
  countdown: number | null;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSpawn: (x: number, y: number) => void;
  onAddObstacle: (obs: Obstacle) => void;
  onUpdateObstacle: (obs: Obstacle) => void;
  onRemoveObstacle: (id: string) => void;
  onSelectObstacle: (id: string | null) => void;
  onFinish: (winner: Player | null) => void;
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}

interface Star {
  x: number; y: number; size: number; opacity: number; blinkSpeed: number;
}

const SimulationEngine = forwardRef((props: EngineProps, ref) => {
  const { state, tool, useSnap, selectedId, countdown, onUpdatePlayers, onUpdateSpawn, onAddObstacle, onUpdateObstacle, onRemoveObstacle, onSelectObstacle, onFinish } = props;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioDestination = useRef<MediaStreamAudioDestinationNode | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const playersRef = useRef<Player[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  
  const destructibleCooldowns = useRef<Record<string, number>>({});
  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [previewRect, setPreviewRect] = useState<any>(null);

  const CANVAS_WIDTH = 450;
  const CANVAS_HEIGHT = 800;
  const GRID_SIZE = 10; 
  const HANDLE_SIZE = 20; 

  // Helper to ensure audio system is ready
  const ensureAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioDestination.current = audioCtx.current.createMediaStreamDestination();
      
      // Keep context alive with a silent oscillator if needed
      const silentOsc = audioCtx.current.createOscillator();
      const silentGain = audioCtx.current.createGain();
      silentGain.gain.value = 0;
      silentOsc.connect(silentGain);
      silentGain.connect(audioCtx.current.destination);
      silentOsc.start();
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
    return { ctx: audioCtx.current, dest: audioDestination.current! };
  };

  useImperativeHandle(ref, () => ({
    getAudioStream: () => {
      const { dest } = ensureAudio();
      return dest.stream;
    }
  }));

  // Inicializar estrelas fixas
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2,
        opacity: Math.random(),
        blinkSpeed: 0.01 + Math.random() * 0.03
      });
    }
    starsRef.current = stars;
  }, []);

  const playSound = (type: 'impact' | 'break' | 'death' | 'win' | 'powerup') => {
    const { ctx, dest } = ensureAudio();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(dest);
    
    const now = ctx.currentTime;

    if (type === 'impact') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.04, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'powerup') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'death') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'win') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    }
  };

  useEffect(() => {
    playersRef.current = state.players;
    obstaclesRef.current = state.obstacles;
  }, [state.players, state.obstacles]);

  const snap = (v: number) => useSnap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const createParticles = (x: number, y: number, color: string, count = 8, size = 2, spread = 5) => {
    for(let i=0; i<count; i++) {
      particles.current.push({
        x, y, vx: (Math.random() - 0.5) * spread, vy: (Math.random() - 0.5) * spread,
        life: 1.0, color, size
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (state.mode !== GameMode.EDITOR) return;
    const coords = getCanvasCoords(e);
    if (tool === 'select') {
      if (selectedId) {
        const obs = obstaclesRef.current.find(o => o.id === selectedId);
        if (obs) {
          const hX = obs.x + obs.width; const hY = obs.y + obs.height;
          if (Math.abs(coords.x - hX) < HANDLE_SIZE && Math.abs(coords.y - hY) < HANDLE_SIZE) { isResizing.current = true; return; }
        }
      }
      const clicked = [...obstaclesRef.current].reverse().find(o => 
        coords.x >= o.x && coords.x <= o.x + o.width && coords.y >= o.y && coords.y <= o.y + o.height
      );
      if (clicked) { onSelectObstacle(clicked.id); isDragging.current = true; dragOffset.current = { x: coords.x - clicked.x, y: coords.y - clicked.y }; } 
      else { onSelectObstacle(null); }
      return;
    }
    if (tool === 'spawn') { onUpdateSpawn(snap(coords.x), snap(coords.y)); return; }
    isDrawing.current = true; startPos.current = { x: snap(coords.x), y: snap(coords.y) };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (state.mode !== GameMode.EDITOR) return;
    const coords = getCanvasCoords(e);
    const obs = obstaclesRef.current.find(o => o.id === selectedId);
    if (isResizing.current && obs) { onUpdateObstacle({ ...obs, width: Math.max(10, snap(coords.x) - obs.x), height: Math.max(10, snap(coords.y) - obs.y) }); return; }
    if (isDragging.current && obs) { onUpdateObstacle({ ...obs, x: snap(coords.x - dragOffset.current.x), y: snap(coords.y - dragOffset.current.y) }); return; }
    if (isDrawing.current) {
      const x = Math.min(startPos.current.x, snap(coords.x)); const y = Math.min(startPos.current.y, snap(coords.y));
      const w = Math.max(GRID_SIZE, Math.abs(snap(coords.x) - startPos.current.x));
      const h = Math.max(GRID_SIZE, Math.abs(snap(coords.y) - startPos.current.y));
      setPreviewRect({ x, y, width: w, height: h });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false; isResizing.current = false;
    if (isDrawing.current && previewRect) { onAddObstacle({ id: `obs-${Date.now()}`, ...previewRect, type: tool as any, rotation: 0, health: tool === 'destructible' ? 3 : 1 }); }
    isDrawing.current = false; setPreviewRect(null);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const time = Date.now() * 0.001;
    const gradCyan = ctx.createRadialGradient(CANVAS_WIDTH * 0.2 + Math.sin(time * 0.5) * 50, CANVAS_HEIGHT * 0.3 + Math.cos(time * 0.5) * 50, 0, CANVAS_WIDTH * 0.2, CANVAS_HEIGHT * 0.3, 300);
    gradCyan.addColorStop(0, 'rgba(0, 242, 234, 0.05)'); gradCyan.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradCyan; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const gradPink = ctx.createRadialGradient(CANVAS_WIDTH * 0.8 + Math.cos(time * 0.3) * 60, CANVAS_HEIGHT * 0.7 + Math.sin(time * 0.3) * 60, 0, CANVAS_WIDTH * 0.8, CANVAS_HEIGHT * 0.7, 400);
    gradPink.addColorStop(0, 'rgba(255, 0, 80, 0.05)'); gradPink.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradPink; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    starsRef.current.forEach(star => {
      star.opacity += star.blinkSpeed; if (star.opacity > 1 || star.opacity < 0.2) star.blinkSpeed *= -1;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`; ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(0, 242, 234, 0.03)'; ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CANVAS_HEIGHT); ctx.stroke(); }
    for(let i=0; i<CANVAS_HEIGHT; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH,i); ctx.stroke(); }
  };

  useEffect(() => {
    if (!state.isRunning) return;
    const runLoop = () => {
      const baseSpeed = 3.5;
      const currentObstacles = [...obstaclesRef.current];
      const obsToRemove: string[] = [];
      let simulationPlayers = [...playersRef.current];
      let foundWinner: Player | null = null;
      
      simulationPlayers = simulationPlayers.map(p => {
        if (p.isEliminated || p.finished) return p;
        let { x, y, vx, vy, size, usedPowerups } = p;
        x += vx; y += vy;

        if (x < 0) { x = 0; vx = Math.abs(vx); playSound('impact'); createParticles(x, y + size/2, p.color); }
        if (x > CANVAS_WIDTH - size) { x = CANVAS_WIDTH - size; vx = -Math.abs(vx); playSound('impact'); createParticles(x + size, y + size/2, p.color); }
        if (y < 0) { y = 0; vy = Math.abs(vy); playSound('impact'); createParticles(x + size/2, y, p.color); }
        if (y > CANVAS_HEIGHT - size) { y = CANVAS_HEIGHT - size; vy = -Math.abs(vy); playSound('impact'); createParticles(x + size/2, y + size, p.color); }

        let isEliminated = false;
        let finished = false;

        currentObstacles.forEach(obs => {
          if (x < obs.x + obs.width && x + size > obs.x && y < obs.y + obs.height && y + size > obs.y) {
            if (obs.type === 'wall' || obs.type === 'destructible') {
              const dx1 = (x + size) - obs.x; const dx2 = (obs.x + obs.width) - x;
              const dy1 = (y + size) - obs.y; const dy2 = (obs.y + obs.height) - y;
              const min = Math.min(dx1, dx2, dy1, dy2);
              if (min === dx1) { x = obs.x - size; vx = -Math.abs(vx); }
              else if (min === dx2) { x = obs.x + obs.width; vx = Math.abs(vx); }
              else if (min === dy1) { y = obs.y - size; vy = -Math.abs(vy); }
              else if (min === dy2) { y = obs.y + obs.height; vy = Math.abs(vy); }
              
              if (obs.type === 'destructible' && obs.health !== undefined) {
                const now = Date.now();
                if (!destructibleCooldowns.current[obs.id] || now - destructibleCooldowns.current[obs.id] > 100) {
                  obs.health -= 1; destructibleCooldowns.current[obs.id] = now;
                  playSound('break'); createParticles(x + size/2, y + size/2, obs.color || '#fff', 12, 3);
                  if (obs.health <= 0) obsToRemove.push(obs.id);
                }
              } else { playSound('impact'); }
            } else if (obs.type === 'death') {
              isEliminated = true; playSound('death'); createParticles(x + size/2, y + size/2, '#ff0050', 25, 4);
            } else if (obs.type === 'finish') {
                finished = true; playSound('win'); foundWinner = p;
            } else if (obs.type === 'powerup') {
              if (!usedPowerups.includes(obs.id)) {
                if (obs.powerupType === 'shrink') { size = Math.max(8, size * 0.6); }
                else if (obs.powerupType === 'grow') { size = Math.min(100, size * 1.5); }
                usedPowerups = [...usedPowerups, obs.id];
                playSound('powerup'); createParticles(x + size/2, y + size/2, p.color, 15, 3);
              }
            }
          }
        });

        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag > 0) { vx = (vx / mag) * baseSpeed; vy = (vy / mag) * baseSpeed; }
        return { ...p, x, y, vx, vy, size, isEliminated, usedPowerups, finished };
      });

      obsToRemove.forEach(id => onRemoveObstacle(id));

      for(let i=0; i<simulationPlayers.length; i++){
        for(let j=i+1; j<simulationPlayers.length; j++){
          const p1 = simulationPlayers[i]; const p2 = simulationPlayers[j];
          if(p1.isEliminated || p2.isEliminated || p1.finished || p2.finished) continue;
          const dx = (p1.x + p1.size/2) - (p2.x + p2.size/2); const dy = (p1.y + p1.size/2) - (p2.y + p2.size/2);
          const dist = Math.sqrt(dx * dx + dy * dy); const minDist = (p1.size + p2.size) / 2;
          if(dist < minDist && dist > 0) {
            const overlap = (minDist - dist); const nx = dx / dist; const ny = dy / dist;
            p1.x += nx * overlap / 2; p1.y += ny * overlap / 2;
            p2.x -= nx * overlap / 2; p2.y -= ny * overlap / 2;
            const dot = (p1.vx - p2.vx) * nx + (p1.vy - p2.vy) * ny;
            p1.vx -= dot * nx; p1.vy -= dot * ny; p2.vx += dot * nx; p2.vy += dot * ny;
            playSound('impact');
          }
        }
      }

      particles.current = particles.current.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.03; return p.life > 0; });
      onUpdatePlayers(simulationPlayers);
      if (foundWinner) { onFinish(foundWinner); return; }
      const survivors = simulationPlayers.filter(p => !p.isEliminated);
      if (simulationPlayers.length > 0) {
        if (survivors.length === 1 && simulationPlayers.length > 1) { onFinish(survivors[0]); return; }
        if (survivors.length === 0) { onFinish(null); return; }
      }
      animationRef.current = requestAnimationFrame(runLoop);
    };
    animationRef.current = requestAnimationFrame(runLoop);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [state.isRunning, state.obstacles]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const render = () => {
      drawBackground(ctx);
      state.obstacles.forEach(obs => {
        ctx.save(); ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2); ctx.rotate((obs.rotation || 0) * Math.PI / 180); ctx.translate(-(obs.width / 2), -(obs.height / 2));
        if (obs.type === 'death') {
          ctx.fillStyle = '#ff0050'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff0050'; ctx.fillRect(0, 0, obs.width, obs.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, obs.width, obs.height);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          for (let i = -obs.width; i < obs.width * 2; i += 15) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 10, 0); ctx.lineTo(i - 5, obs.height); ctx.lineTo(i - 15, obs.height); ctx.closePath(); ctx.fill(); }
        } else if (obs.type === 'destructible') {
          ctx.fillStyle = obs.color || '#f97316'; ctx.fillRect(0, 0, obs.width, obs.height); ctx.strokeStyle = '#fff5'; ctx.strokeRect(0, 0, obs.width, obs.height);
          if (obs.health !== undefined) { ctx.fillStyle = '#fff'; ctx.font = '900 12px Bungee'; ctx.textAlign = 'center'; ctx.fillText(obs.health.toString(), obs.width/2, obs.height/2+5); }
        } else if (obs.type === 'finish') {
            ctx.fillStyle = '#22c55e'; ctx.shadowBlur = 20; ctx.shadowColor = '#22c55e'; ctx.fillRect(0, 0, obs.width, obs.height); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, obs.width, obs.height);
        } else if (obs.type === 'powerup') {
          let color = obs.powerupType === 'shrink' ? '#a855f7' : '#f97316';
          ctx.fillStyle = color + '44'; ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.fillRect(0, 0, obs.width, obs.height); ctx.strokeStyle = color; ctx.setLineDash([4, 4]); ctx.strokeRect(0, 0, obs.width, obs.height); ctx.setLineDash([]);
          ctx.fillStyle = '#fff'; ctx.font = '900 10px Inter'; ctx.textAlign = 'center'; ctx.fillText(obs.powerupType === 'shrink' ? 'MINI' : 'MAXI', obs.width/2, obs.height/2+4);
        } else {
          ctx.fillStyle = obs.color || '#1a1a1e'; ctx.fillRect(0, 0, obs.width, obs.height); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(0, 0, obs.width, obs.height);
        }
        if (selectedId === obs.id) { ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.strokeRect(-4,-4,obs.width+8,obs.height+8); }
        ctx.restore();
      });

      playersRef.current.forEach(p => {
        if (p.isEliminated || p.finished) return;
        ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = p.color; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.size, p.size); ctx.restore();
      });
      particles.current.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); });
      ctx.globalAlpha = 1.0;
      if (previewRect) { ctx.strokeStyle = '#00f2ea'; ctx.setLineDash([5, 5]); ctx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height); ctx.setLineDash([]); }

      // RENDERIZAÇÃO DA CONTAGEM (DIRETO NO CANVAS PARA A GRAVAÇÃO)
      if (countdown !== null) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.font = 'bold 120px Bungee';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff0050';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff0050';
        ctx.fillText(countdown === 0 ? 'GO!' : countdown.toString(), CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
        ctx.restore();
      }

      // RENDERIZAÇÃO DO VENCEDOR (DIRETO NO CANVAS PARA A GRAVAÇÃO)
      if (state.winner) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Modal do Vencedor
        const modalW = 320;
        const modalH = 250;
        const mx = (CANVAS_WIDTH - modalW)/2;
        const my = (CANVAS_HEIGHT - modalH)/2;
        
        ctx.fillStyle = '#1a1a1e';
        ctx.strokeStyle = '#00f2ea';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 50;
        ctx.shadowColor = 'rgba(0, 242, 234, 0.3)';
        ctx.beginPath();
        ctx.roundRect(mx, my, modalW, modalH, 30);
        ctx.fill();
        ctx.stroke();
        
        // "VENCEDOR!"
        ctx.font = '900 24px Bungee';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('VENCEDOR!', CANVAS_WIDTH/2, my + 50);
        
        // Bloco de Cor do Vencedor (Substituindo o ícone generic)
        const blockSize = 60;
        ctx.shadowBlur = 20;
        ctx.shadowColor = state.winner.color;
        ctx.fillStyle = state.winner.color;
        ctx.fillRect(CANVAS_WIDTH/2 - blockSize/2, my + 70, blockSize, blockSize);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_WIDTH/2 - blockSize/2, my + 70, blockSize, blockSize);
        
        // Nome do Vencedor
        ctx.shadowBlur = 0;
        ctx.font = 'bold 20px Inter';
        ctx.fillStyle = state.winner.color;
        ctx.fillText(state.winner.name, CANVAS_WIDTH/2, my + 170);
        
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(render);
    };
    animationRef.current = requestAnimationFrame(render);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [state.obstacles, previewRect, state.isRunning, state.mode, state.players, selectedId, countdown, state.winner]);

  return (
    <div className="w-full h-full p-4 flex items-center justify-center">
      <div className="canvas-container rounded-3xl overflow-hidden relative">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="cursor-crosshair" style={{ width: 'auto', height: '100%', maxHeight: '750px', aspectRatio: '9/16' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} />
      </div>
    </div>
  );
});

export default SimulationEngine;
