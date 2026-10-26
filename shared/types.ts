export type Role = 'CREW' | 'SABOTEUR';

export type PlayerStatus = 'ALIVE' | 'DEAD' | 'DISCONNECTED';

export type GamePhase = 'LOBBY' | 'PLAYING' | 'MEETING' | 'ENDED';

export type TaskType = 'wires' | 'card_swipe' | 'download' | 'keypad' | 'levers';

export interface PlayerTask {
  id: string;
  type: TaskType;
  roomId: string;
  roomName: string;
  x: number;
  y: number;
  completed: boolean;
}

export interface PlayerPublic {
  id: string;
  name: string;
  colorKey: string;
  colorHex: string;
  isHost: boolean;
  isBot: boolean;
  status: PlayerStatus;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right' | 'up' | 'down';
  isMoving: boolean;
  inVent: boolean;
  role?: Role; // only revealed to self or fellow saboteurs, or at game end
  killCooldown: number;
  emergencyMeetingsLeft: number;
}

export interface DeadBody {
  id: string;
  victimId: string;
  victimName: string;
  victimColorHex: string;
  x: number;
  y: number;
}

export type SabotageType = 'meltdown' | 'blackout' | null;

export interface SabotageState {
  active: SabotageType;
  timeLeft: number; // for meltdown (e.g. 45s down to 0)
  meltdownFix: {
    reactorActive: boolean;
    lifeSupportActive: boolean;
  };
  blackoutSwitches: boolean[]; // 5 electrical breakers to flip on
}

export type MeetingPhase = 'DISCUSSION' | 'VOTING' | 'RESULTS' | 'EJECTION';

export interface MeetingState {
  active: boolean;
  reason: 'emergency_button' | 'body_reported';
  reporterId: string;
  reporterName: string;
  victimName?: string;
  phase: MeetingPhase;
  timeLeft: number;
  votes: Record<string, string>; // voterId -> targetPlayerId | 'skip'
  ejectedId?: string; // playerId or 'skip' or 'tie'
  ejectedName?: string;
  ejectedRole?: Role;
  wasSaboteur?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColorHex: string;
  text: string;
  isGhost: boolean;
  timestamp: number;
}

export interface GameSettings {
  saboteurCount: number; // 1 to 3
  botCount: number; // 0 to 9
  confirmEjects: boolean;
  killCooldownSec: number;
  discussionSec: number;
  votingSec: number;
  emergencyMeetingsPerPlayer: number;
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

export interface VentDef {
  id: string;
  roomId: string;
  x: number;
  y: number;
  connectedTo: string[]; // IDs of connected vents
}

export interface TaskConsoleDef {
  id: string;
  type: TaskType;
  roomId: string;
  x: number;
  y: number;
  label: string;
}

export interface GameStateSnapshot {
  roomCode: string;
  phase: GamePhase;
  players: Record<string, PlayerPublic>;
  tasksTotal: number;
  tasksCompleted: number;
  deadBodies: DeadBody[];
  sabotage: SabotageState;
  meeting: MeetingState | null;
  winner: 'CREW' | 'SABOTEUR' | null;
  winReason: string | null;
  settings: GameSettings;
}
