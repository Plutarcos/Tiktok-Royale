
import React, { useEffect, useRef, useState } from 'react';
import { MinigameProps, Player } from '../types';
import { generateMaze, Cell } from '../utils/mazeGenerator';

const MinigameMaze: React.FC<MinigameProps> = ({ players, onUpdate, onFinish, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const ROWS = 15;
  const COLS = 25;

  useEffect(() => {
    if (isActive) {
      const newGrid = generateMaze(ROWS, COLS);
      setGrid(newGrid);
      
      const nextPlayers = players.map(p => ({
        ...p,
        x: 20, y: 20,
        targetCell: { r: 0, c: 0 },
        mazeHistory: ["0,0"],
        finished: false,
        isEliminated: false
      }));
      onUpdate(nextPlayers);
    }
  }, [isActive, players, onUpdate]);

  useEffect(() => {
    if (!isActive || grid.length === 0) return;

    const update = () => {
      const cellW = 1000 / COLS;
      const cellH = 600 / ROWS;

      const newPlayers = players.map(p => {
        if (p.finished) return p;

        let { x, y, targetCell, mazeHistory } = p;
        if (!targetCell) targetCell = { r: 0, c: 0 };
        // Handle optional mazeHistory
        if (!mazeHistory) mazeHistory = ["0,0"];

        const targetX = targetCell.c * cellW + cellW/2;
        const targetY = targetCell.r * cellH + cellH/2;

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 3) {
          // Chegou na célula alvo, escolher próxima
          const cell = grid[targetCell.r][targetCell.c];
          const options: {r: number, c: number}[] = [];
          
          if (!cell.walls[0]) options.push({ r: targetCell.r - 1, c: targetCell.c });
          if (!cell.walls[1]) options.push({ r: targetCell.r, c: targetCell.c + 1 });
          if (!cell.walls[2]) options.push({ r: targetCell.r + 1, c: targetCell.c });
          if (!cell.walls[3]) options.push({ r: targetCell.r, c: targetCell.c - 1 });

          // Tentar não voltar pelo mesmo caminho imediatamente, a menos que seja beco sem saída
          let next = options[Math.floor(Math.random() * options.length)];
          const validOptions = options.filter(opt => !mazeHistory!.includes(`${opt.r},${opt.c}`));
          if (validOptions.length > 0) {
            next = validOptions[Math.floor(Math.random() * validOptions.length)];
          }

          targetCell = next;
          mazeHistory = [...mazeHistory.slice(-10), `${next.r},${next.c}`]; // Memória curta

          if (next.c === COLS - 1) {
            return { ...p, finished: true, finishTime: Date.now() };
          }
        } else {
          const moveSpeed = 2 + (Math.random() * 1);
          x += (dx / dist) * moveSpeed;
          y += (dy / dist) * moveSpeed;
        }

        return { ...p, x, y, targetCell, mazeHistory };
      });

      onUpdate(newPlayers);

      const winners = newPlayers.filter(p => p.finished).sort((a,b) => (a.finishTime||0) - (b.finishTime||0));
      if (winners.length > 0 && winners.length === players.length) {
        onFinish(winners[0], winners);
      } else {
        animationRef.current = requestAnimationFrame(update);
      }
    };

    animationRef.current = requestAnimationFrame(update);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isActive, grid, players, onUpdate, onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / COLS;
    const cellH = canvas.height / ROWS;

    // Paredes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const x = c * cellW;
        const y = r * cellH;
        if (cell.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellW, y); ctx.stroke(); }
        if (cell.walls[1]) { ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW, y + cellH); ctx.stroke(); }
        if (cell.walls[2]) { ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + cellW, y + cellH); ctx.stroke(); }
        if (cell.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellH); ctx.stroke(); }
      });
    });

    // Saída
    ctx.fillStyle = '#22c55e33';
    ctx.fillRect(canvas.width - cellW, 0, cellW, canvas.height);

    // Jogadores como pequenos pontos/icones
    players.forEach(p => {
      if (p.finished) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
  }, [players, grid]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} width={1000} height={600} className="w-full h-full" />
    </div>
  );
};

export default MinigameMaze;
