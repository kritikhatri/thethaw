import { GameSettings, StationConsoleDef, StationRoomDef } from './types.js';

export const COLORS = [
  { key: 'cyan', name: 'Glacier Cyan', hex: '#22d3ee', darkHex: '#0891b2' },
  { key: 'orange', name: 'Hazard Orange', hex: '#fb923c', darkHex: '#ea580c' },
  { key: 'white', name: 'Cryo White', hex: '#f8fafc', darkHex: '#94a3b8' },
  { key: 'navy', name: 'Deep Abyss', hex: '#38bdf8', darkHex: '#0369a1' },
  { key: 'lime', name: 'Biosafety Lime', hex: '#a3e635', darkHex: '#65a30d' },
  { key: 'violet', name: 'Aurora Violet', hex: '#c084fc', darkHex: '#9333ea' },
  { key: 'crimson', name: 'Sub-Zero Crimson', hex: '#f87171', darkHex: '#dc2626' },
  { key: 'yellow', name: 'Solar Flare', hex: '#facc15', darkHex: '#ca8a04' },
  { key: 'grey', name: 'Permafrost Grey', hex: '#9ca3af', darkHex: '#4b5563' },
  { key: 'teal', name: 'Thermal Teal', hex: '#2dd4bf', darkHex: '#0d9488' }
];

export const DEFAULT_SETTINGS: GameSettings = {
  hunterCount: 1,
  roundSec: 120
};

export const MIN_PLAYERS = 3;
export const HUNTER_RELEASE_SEC = 4;
export const THAW_SEC = 2;
export const THAW_IMMUNITY_SEC = 2.5;

export const SPEED = {
  RUNNER: 200,
  HUNTER: 215
};

export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1800;

export const EMERGENCY_TABLE = {
  x: 1200,
  y: 575,
  radius: 65
};

export const ROOMS: StationRoomDef[] = [
  { id: 'mess_hall', name: 'Central Hub / Mess Hall', x: 900, y: 350, width: 600, height: 450, color: '#1e293b' },
  { id: 'cryo_lab', name: 'Sub-surface Bio-Lab', x: 450, y: 150, width: 380, height: 320, color: '#0f172a' },
  { id: 'medbay', name: 'Medbay & Decontamination', x: 260, y: 550, width: 440, height: 360, color: '#111827' },
  { id: 'reactor', name: 'Cryo Reactor Core', x: 250, y: 1100, width: 480, height: 460, color: '#022c22' },
  { id: 'storage', name: 'Permafrost Cargo Storage', x: 950, y: 1180, width: 500, height: 420, color: '#1c1917' },
  { id: 'engine_room', name: 'Thermal Life Support & Engine', x: 1680, y: 1100, width: 480, height: 460, color: '#31101e' },
  { id: 'electrical', name: 'Auxiliary Power Grid', x: 1620, y: 680, width: 360, height: 320, color: '#172554' },
  { id: 'hydroponics', name: 'Sub-zero Greenhouse Dome', x: 1650, y: 220, width: 460, height: 380, color: '#064e3b' }
];

// Corridor definitions connecting rooms
export const CORRIDORS = [
  // Mess Hall to Cryo Lab
  { x: 750, y: 380, width: 200, height: 100 },
  // Mess Hall to Medbay
  { x: 670, y: 620, width: 260, height: 100 },
  // Medbay to Reactor
  { x: 380, y: 880, width: 120, height: 260 },
  // Mess Hall to Storage (Central spine)
  { x: 1140, y: 770, width: 120, height: 440 },
  // Reactor to Storage
  { x: 700, y: 1300, width: 280, height: 100 },
  // Storage to Engine
  { x: 1420, y: 1300, width: 290, height: 100 },
  // Mess Hall to Hydroponics
  { x: 1470, y: 440, width: 210, height: 100 },
  // Hydroponics to Electrical
  { x: 1780, y: 570, width: 100, height: 140 },
  // Electrical to Engine
  { x: 1780, y: 970, width: 100, height: 160 }
];

// Decorative consoles scattered around the station
export const STATION_CONSOLES: StationConsoleDef[] = [
  { x: 1100, y: 1220, label: 'Wiring Conduit Alpha' },
  { x: 720, y: 220, label: 'Wiring Conduit Beta' },
  { x: 1380, y: 390, label: 'Thermal ID Swipe' },
  { x: 320, y: 780, label: 'Decon Authorization' },
  { x: 1980, y: 300, label: 'Satellite Uplink' },
  { x: 1350, y: 1480, label: 'Telemetry Archive' },
  { x: 320, y: 1450, label: 'Cryo Core Calibration' },
  { x: 500, y: 400, label: 'Specimen Cryo Lock' },
  { x: 2050, y: 1200, label: 'Coolant Pressure Levers' },
  { x: 620, y: 1200, label: 'Thermal Dampeners' }
];

export const VISION_RADIUS = {
  RUNNER: 380,
  HUNTER: 320,
  FROZEN: 600
};

export const INTERACTION_DISTANCES = {
  TAG: 46,
  THAW: 70
};

export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_ROOM: 'join_room',
  CREATE_ROOM: 'create_room',
  SELECT_COLOR: 'select_color',
  UPDATE_SETTINGS: 'update_settings',
  ADD_BOT: 'add_bot',
  REMOVE_BOT: 'remove_bot',
  START_GAME: 'start_game',
  PLAYER_MOVE: 'player_move',
  RETURN_TO_LOBBY: 'return_to_lobby',

  // Server -> Client
  ROOM_JOINED: 'room_joined',
  ERROR_MSG: 'error_msg',
  GAME_STATE_UPDATE: 'game_state_update',
  PLAYER_FROZEN: 'player_frozen',
  PLAYER_THAWED: 'player_thawed'
};
