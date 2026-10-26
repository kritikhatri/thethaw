import { GameSettings, StationRoomDef, TaskConsoleDef, VentDef } from './types.js';

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
  saboteurCount: 1,
  botCount: 3,
  confirmEjects: true,
  killCooldownSec: 25,
  discussionSec: 15,
  votingSec: 20,
  emergencyMeetingsPerPlayer: 1
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

export const VENTS: VentDef[] = [
  { id: 'vent_reactor', roomId: 'reactor', x: 350, y: 1200, connectedTo: ['vent_medbay', 'vent_storage'] },
  { id: 'vent_medbay', roomId: 'medbay', x: 340, y: 620, connectedTo: ['vent_reactor', 'vent_lab'] },
  { id: 'vent_lab', roomId: 'cryo_lab', x: 550, y: 230, connectedTo: ['vent_medbay', 'vent_storage'] },
  { id: 'vent_storage', roomId: 'storage', x: 1050, y: 1260, connectedTo: ['vent_lab', 'vent_engine', 'vent_reactor'] },
  { id: 'vent_engine', roomId: 'engine_room', x: 1800, y: 1200, connectedTo: ['vent_storage'] }
];

export const TASK_CONSOLES: TaskConsoleDef[] = [
  { id: 'task_wires_storage', type: 'wires', roomId: 'storage', x: 1100, y: 1220, label: 'Wiring Conduit Alpha' },
  { id: 'task_wires_lab', type: 'wires', roomId: 'cryo_lab', x: 720, y: 220, label: 'Wiring Conduit Beta' },
  { id: 'task_card_mess', type: 'card_swipe', roomId: 'mess_hall', x: 1380, y: 390, label: 'Thermal ID Swipe' },
  { id: 'task_card_medbay', type: 'card_swipe', roomId: 'medbay', x: 320, y: 780, label: 'Decon Authorization' },
  { id: 'task_download_comms', type: 'download', roomId: 'hydroponics', x: 1980, y: 300, label: 'Satellite Uplink' },
  { id: 'task_download_storage', type: 'download', roomId: 'storage', x: 1350, y: 1480, label: 'Telemetry Archive' },
  { id: 'task_keypad_reactor', type: 'keypad', roomId: 'reactor', x: 320, y: 1450, label: 'Cryo Core Calibration' },
  { id: 'task_keypad_lab', type: 'keypad', roomId: 'cryo_lab', x: 500, y: 400, label: 'Specimen Cryo Lock' },
  { id: 'task_levers_engine', type: 'levers', roomId: 'engine_room', x: 2050, y: 1200, label: 'Coolant Pressure Levers' },
  { id: 'task_levers_reactor', type: 'levers', roomId: 'reactor', x: 620, y: 1200, label: 'Thermal Dampeners' }
];

// Sabotage fix locations
export const SABOTAGE_FIX_LOCATIONS = {
  meltdownReactor: { x: 490, y: 1320, roomId: 'reactor', label: 'Reactor Thermal Stabilizer' },
  meltdownLifeSupport: { x: 1920, y: 1320, roomId: 'engine_room', label: 'Life Support Stabilizer' },
  electricalBreakers: { x: 1800, y: 740, roomId: 'electrical', label: 'Main Breaker Switchboard' }
};

export const VISION_RADIUS = {
  NORMAL: 360,
  BLACKOUT_CREW: 130,
  BLACKOUT_SABOTEUR: 360,
  GHOST: 600
};

export const INTERACTION_DISTANCES = {
  TASK: 85,
  EMERGENCY: 90,
  KILL: 80,
  VENT: 75,
  REPORT: 110,
  SABOTAGE_FIX: 85
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
  COMPLETE_TASK: 'complete_task',
  USE_VENT: 'use_vent',
  KILL_PLAYER: 'kill_player',
  TRIGGER_SABOTAGE: 'trigger_sabotage',
  FIX_SABOTAGE_STEP: 'fix_sabotage_step',
  REPORT_BODY: 'report_body',
  TRIGGER_EMERGENCY: 'trigger_emergency',
  SEND_CHAT: 'send_chat',
  CAST_VOTE: 'cast_vote',
  RETURN_TO_LOBBY: 'return_to_lobby',

  // Server -> Client
  ROOM_JOINED: 'room_joined',
  ERROR_MSG: 'error_msg',
  GAME_STATE_UPDATE: 'game_state_update',
  PLAYER_ROLE: 'player_role',
  ASSIGNED_TASKS: 'assigned_tasks',
  KILL_OCCURRED: 'kill_occurred',
  MEETING_STARTED: 'meeting_started',
  CHAT_MESSAGE: 'chat_message',
  VOTE_UPDATE: 'vote_update',
  MEETING_ENDED: 'meeting_ended',
  SABOTAGE_UPDATE: 'sabotage_update',
  GAME_OVER: 'game_over'
};
