
export type ObstacleType = 'wall' | 'death' | 'powerup' | 'destructible' | 'finish';

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  color?: string;
  rotation?: number; 
  powerupType?: 'shrink' | 'grow';
  health?: number;
  maxHealth?: number;
}

export type SpawnLayout = 'horizontal' | 'vertical' | 'square';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  health: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  initialSize: number;
  isEliminated: boolean;
  color: string;
  finished: boolean;
  spawnX: number;
  spawnY: number;
  usedPowerups: string[];
  progress?: number;
  stamina?: number;
  momentum?: number;
  finishTime?: number;
  targetCell?: { r: number, c: number };
  mazeHistory?: string[];
}

export interface WorldConfig {
  gravity: number;
  friction: number;
  bounce: number;
  playerSpeed: number;
  aiForce: number; 
  spawnLayout: SpawnLayout;
}

export enum GameMode {
  EDITOR = 'EDITOR',
  SIMULATING = 'SIMULATING'
}

export interface GameState {
  players: Player[];
  obstacles: Obstacle[];
  mode: GameMode;
  isRunning: boolean;
  winner: Player | null;
  config: WorldConfig;
}

export interface MinigameProps {
  players: Player[];
  onUpdate: (players: Player[]) => void;
  onFinish: (winner: Player | null, results: Player[]) => void;
  isActive: boolean;
}
