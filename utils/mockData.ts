
import { Player } from '../types';

const COLORS = ['#FF0050', '#00F2EA', '#FFFFFF', '#FFD700', '#ADFF2F', '#FF69B4', '#1E90FF'];

const getRandomName = () => {
  const prefixes = ['The', 'Real', 'Official', 'Its', 'Super', 'Crazy', 'Mega'];
  const names = ['User', 'Gamer', 'TikToker', 'Ninja', 'Master', 'Legend', 'Star', 'Vibe', 'Chief', 'Queen'];
  const suffixes = ['123', '_br', '_oficial', 'TV', 'Gamer', '07', 'BR', 'XP'];
  
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${names[Math.floor(Math.random() * names.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
};

export const generateMockFollowers = (count: number): Player[] => {
  return Array.from({ length: count }).map((_, i) => {
    const name = getRandomName();
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    return {
      id: `p-${i}`,
      name: name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      health: 100,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      size: 20,
      // Fixed: Added missing initialSize property required by Player interface
      initialSize: 20,
      isEliminated: false,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      finished: false,
      spawnX: x,
      spawnY: y,
      // Fixed: Added missing usedPowerups property
      usedPowerups: [],
      progress: 0,
      stamina: 100,
      momentum: 1,
      mazeHistory: [],
    };
  });
};
