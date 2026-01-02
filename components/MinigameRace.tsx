
import React, { useEffect, useRef, useState } from 'react';
import { MinigameProps, Player } from '../types';
import { Zap, Flag } from 'lucide-react';

const MinigameRace: React.FC<MinigameProps> = ({ players, onUpdate, onFinish, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Pré-carregar avatares para o canvas
  useEffect(() => {
    players.forEach(p => {
      if (!imagesRef.current[p.id]) {
        const img = new Image();
        img.src = p.avatar || '';
        imagesRef.current[p.id] = img;
      }
    });
  }, [players]);

  useEffect(() => {
    if (!isActive) return;

    const update = () => {
      const newPlayers = players.map(p => {
        if (p.finished) return p;

        let { progress, stamina, momentum } = p;
        // Handle optional properties initialization
        if (progress === undefined) progress = 0;
        if (stamina === undefined) stamina = 100;
        if (momentum === undefined) momentum = 1;

        // Lógica de fadiga e momentum
        const effort = Math.random();
        if (effort > 0.7 && stamina > 0) {
          momentum += 0.05;
          stamina -= 0.5;
        } else {
          momentum *= 0.99; // Perda natural de momentum
          stamina += 0.2; // Recuperação
        }

        stamina = Math.max(0, Math.min(100, stamina));
        momentum = Math.max(0.5, Math.min(3, momentum));

        const step = (0.05 + (Math.random() * 0.1)) * momentum;
        progress += step;

        const isFinished = progress >= 100;
        return { 
          ...p, 
          progress: isFinished ? 100 : progress, 
          finished: isFinished, 
          finishTime: isFinished ? Date.now() : p.finishTime,
          stamina,
          momentum
        };
      });

      onUpdate(newPlayers);

      const stillRunning = newPlayers.filter(p => !p.finished);
      if (stillRunning.length === 0) {
        const sorted = [...newPlayers].sort((a,b) => (a.finishTime||0) - (b.finishTime||0));
        onFinish(sorted[0], sorted);
      } else {
        animationRef.current = requestAnimationFrame(update);
      }
    };

    animationRef.current = requestAnimationFrame(update);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isActive, players, onUpdate, onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fundo da Pista
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Linhas de perspectiva/pista
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.height; i+=40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Linha de Chegada
    ctx.fillStyle = '#ff005022';
    ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);
    ctx.strokeStyle = '#ff0050';
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(canvas.width - 50, 0, 50, canvas.height);
    ctx.setLineDash([]);

    // Ordenar para desenhar os da frente por cima
    const sortedToDraw = [...players].sort((a,b) => (a.progress || 0) - (b.progress || 0));

    sortedToDraw.forEach((p, index) => {
      const progress = p.progress || 0;
      const momentum = p.momentum || 1;
      const x = (progress / 100) * (canvas.width - 80) + 40;
      // Distribuir verticalmente se forem muitos
      const y = (index % 15) * 35 + 40; 

      // Efeito de velocidade (trilha)
      if (momentum > 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 30, y);
        ctx.strokeStyle = p.color + '44';
        ctx.lineWidth = 15;
        ctx.stroke();
      }

      // Avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.clip();
      const img = imagesRef.current[p.id];
      if (img && img.complete) {
        ctx.drawImage(img, x - 15, y - 15, 30, 30);
      } else {
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();

      // Borda colorida baseada no momentum
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = momentum > 2 ? '#fff' : p.color;
      ctx.lineWidth = momentum > 2 ? 3 : 1;
      ctx.stroke();

      // Nome pequeno
      if (players.length < 50) {
        ctx.fillStyle = 'white';
        ctx.font = '8px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, x, y + 25);
      }
    });
  }, [players]);

  return (
    <div className="w-full h-full bg-slate-950 relative overflow-hidden">
      <canvas ref={canvasRef} width={1000} height={600} className="w-full h-full" />
      <div className="absolute top-6 left-6 flex items-center gap-4 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
        <Zap className="text-yellow-400 fill-yellow-400" size={24} />
        <div>
          <h3 className="font-bungee text-lg leading-none">GRAND PRIX</h3>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Simulação de Momentum Ativa</p>
        </div>
      </div>
    </div>
  );
};

export default MinigameRace;
