
import React, { useEffect, useRef, useState } from 'react';
import { MinigameProps, Player } from '../types';

const MinigameBattle: React.FC<MinigameProps> = ({ players, onUpdate, onFinish, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [zoneRadius, setZoneRadius] = useState(600);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let zone = 600;

    const update = () => {
      zone -= 0.2; 
      setZoneRadius(zone);

      const nextPlayers = players.map(p => {
        if (p.isEliminated) return p;

        let { x, y, vx, vy, health } = p;

        // Comportamento: Perseguir o centro ou oponentes
        const angleToCenter = Math.atan2(canvas.height/2 - y, canvas.width/2 - x);
        vx += Math.cos(angleToCenter) * 0.08;
        vy += Math.sin(angleToCenter) * 0.08;

        // Atrito
        vx *= 0.99;
        vy *= 0.99;

        x += vx;
        y += vy;

        // Dano da Zona
        const distToCenter = Math.sqrt(Math.pow(x - canvas.width/2, 2) + Math.pow(y - canvas.height/2, 2));
        if (distToCenter > zone) {
          health -= 0.4;
        }

        // Colisões com paredes (Quique)
        if (x < 20 || x > canvas.width - 20) { vx *= -0.8; x = x < 20 ? 20 : canvas.width - 20; }
        if (y < 20 || y > canvas.height - 20) { vy *= -0.8; y = y < 20 ? 20 : canvas.height - 20; }

        return { ...p, x, y, vx, vy, health, isEliminated: health <= 0 };
      });

      // Física de Colisão entre Bolinhas (Simulando2D Style)
      for (let i = 0; i < nextPlayers.length; i++) {
        for (let j = i + 1; j < nextPlayers.length; j++) {
          const p1 = nextPlayers[i];
          const p2 = nextPlayers[j];
          if (p1.isEliminated || p2.isEliminated) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDistance = 25;

          if (dist < minDistance) {
            // Transferência de força
            const angle = Math.atan2(dy, dx);
            const force = 1.5;
            p1.vx += Math.cos(angle) * force;
            p1.vy += Math.sin(angle) * force;
            p2.vx -= Math.cos(angle) * force;
            p2.vy -= Math.sin(angle) * force;
            
            p1.health -= 1.5;
            p2.health -= 1.5;
            
            // Empurrar para fora para evitar sobreposição
            const overlap = minDistance - dist;
            p1.x += Math.cos(angle) * overlap / 2;
            p1.y += Math.sin(angle) * overlap / 2;
            p2.x -= Math.cos(angle) * overlap / 2;
            p2.y -= Math.sin(angle) * overlap / 2;
          }
        }
      }

      onUpdate(nextPlayers);

      const alive = nextPlayers.filter(p => !p.isEliminated);
      if (alive.length <= 1) {
        onFinish(alive[0] || null, nextPlayers.sort((a,b) => b.health - a.health));
      } else {
        animationRef.current = requestAnimationFrame(update);
      }
    };

    animationRef.current = requestAnimationFrame(update);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid técnico
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

    // Zona de Perigo
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, zoneRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff3e3e';
    ctx.lineWidth = 3;
    ctx.stroke();

    players.forEach(p => {
      if (p.isEliminated) return;
      
      // Glow do jogador
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      
      ctx.shadowBlur = 0;

      // Barra de vida
      ctx.fillStyle = '#111';
      ctx.fillRect(p.x - 12, p.y - 18, 24, 3);
      ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ff3e3e';
      ctx.fillRect(p.x - 12, p.y - 18, (p.health / 100) * 24, 3);
      
      // Nome
      if (players.length < 50) {
        ctx.fillStyle = 'white';
        ctx.font = '900 8px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.substring(0, 10).toUpperCase(), p.x, p.y + 24);
      }
    });
  }, [players, zoneRadius]);

  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} width={1000} height={600} className="w-full h-full object-contain" />
    </div>
  );
};

export default MinigameBattle;
