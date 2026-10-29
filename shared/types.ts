export type Role = 'RUNNER' | 'HUNTER';

export type PlayerStatus = 'ALIVE' | 'FROZEN' | 'DISCONNECTED';

export type GamePhase = 'LOBBY' | 'PLAYING' | 'ENDED';

export type Facing = 'left' | 'right' | 'up' | 'down';

export interface PlayerPublic {
  id: string;
  name: string;
  colorKey: string;
  colorHex: string;
  isHost: boolean;
  isBot: boolean;
  status: PlayerStatus;
  role: Role; // public in freeze tag: everyone knows who the hunters are
  x: number;
  y: number;
  facing: Facing;
  isMoving: boolean;
  thawProgress: number; // 0..1 while teammates are thawing this frozen runner
  immuneFor: number; // seconds of tag immunity left after being thawed
  tags: number;
  rescues: number;
}

export interface GameSettings {
  hunterCount: number; // 1 to 3
  roundSec: number;
}

export interface StationRoomDef {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface StationConsoleDef {
  x: number;
  y: number;
  label: string;
}

export interface GameStateSnapshot {
  roomCode: string;
  phase: GamePhase;
  players: Record<string, PlayerPublic>;
  timeLeft: number;
  hunterReleaseIn: number; // countdown before hunters may move
  winner: Role | null;
  winReason: string | null;
  settings: GameSettings;
}
