import { Server } from 'socket.io';
import {
  Facing,
  GamePhase,
  GameSettings,
  GameStateSnapshot,
  PlayerPublic,
  PowerUp,
  Role
} from '../../shared/types.js';
import {
  COLORS,
  DEFAULT_SETTINGS,
  EMERGENCY_TABLE,
  HUNTER_RELEASE_SEC,
  INTERACTION_DISTANCES,
  MIN_PLAYERS,
  POWER_UPS,
  ROOMS,
  SOCKET_EVENTS,
  THAW_IMMUNITY_SEC,
  THAW_SEC
} from '../../shared/constants.js';
import { StationMapServer } from './StationMapServer.js';
import { BotController } from './BotController.js';

export class GameRoom {
  public code: string;
  private io: Server;
  private phase: GamePhase = 'LOBBY';
  private players: Map<string, PlayerPublic> = new Map();
  private bots: Map<string, BotController> = new Map();
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private timeLeft: number = 0;
  private hunterReleaseIn: number = 0;
  private powerUps: PowerUp[] = [];
  private powerUpTimer: number = 0;
  private winner: Role | null = null;
  private winReason: string | null = null;

  private loopInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  constructor(code: string, io: Server) {
    this.code = code;
    this.io = io;
    this.startLoop();
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public hasActivePlayers(): boolean {
    for (const player of this.players.values()) {
      if (!player.isBot && player.status !== 'DISCONNECTED') {
        return true;
      }
    }
    return false;
  }

  private createPlayer(id: string, name: string, isBot: boolean): PlayerPublic {
    const color = this.getAvailableColor();
    return {
      id,
      name,
      colorKey: color.key,
      colorHex: color.hex,
      isHost: !isBot && this.players.size === 0,
      isBot,
      status: 'ALIVE',
      role: 'RUNNER',
      x: EMERGENCY_TABLE.x,
      y: EMERGENCY_TABLE.y + 140,
      facing: 'down',
      isMoving: false,
      thawProgress: 0,
      immuneFor: 0,
      boostFor: 0,
      tags: 0,
      rescues: 0
    };
  }

  public addPlayer(socketId: string, name: string): PlayerPublic {
    const player = this.createPlayer(socketId, name || `Scientist ${this.players.size + 1}`, false);
    this.players.set(socketId, player);
    this.broadcastState();
    return player;
  }

  public removePlayer(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    if (this.phase === 'LOBBY') {
      this.players.delete(socketId);
      // Transfer host if necessary
      if (player.isHost && this.players.size > 0) {
        const nextHost = Array.from(this.players.values()).find(p => !p.isBot);
        if (nextHost) nextHost.isHost = true;
      }
    } else {
      player.status = 'DISCONNECTED';
      this.checkWinConditions();
    }
    this.broadcastState();
  }

  public selectColor(socketId: string, colorKey: string): boolean {
    const player = this.players.get(socketId);
    if (!player || this.phase !== 'LOBBY') return false;

    // Check if color is taken
    for (const p of this.players.values()) {
      if (p.id !== socketId && p.colorKey === colorKey) {
        return false;
      }
    }

    const colorDef = COLORS.find(c => c.key === colorKey);
    if (colorDef) {
      player.colorKey = colorDef.key;
      player.colorHex = colorDef.hex;
      this.broadcastState();
      return true;
    }
    return false;
  }

  public addBot(): boolean {
    if (this.phase !== 'LOBBY' || this.players.size >= 10) return false;

    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botNames = [
      'Dr. Frost', 'Cmdr. Boreas', 'Bio. Yuki', 'Tech. Blizzard',
      'Spec. Hielo', 'Officer Tundra', 'Geologist Ice', 'Chemist Hail'
    ];
    const usedNames = new Set(Array.from(this.players.values()).map(p => p.name));
    const availableName = botNames.find(n => !usedNames.has(n)) || `Bot ${this.players.size + 1}`;

    this.players.set(botId, this.createPlayer(botId, availableName, true));
    this.bots.set(botId, new BotController());
    this.broadcastState();
    return true;
  }

  public removeBot(): boolean {
    if (this.phase !== 'LOBBY') return false;
    for (const [id, player] of this.players.entries()) {
      if (player.isBot) {
        this.players.delete(id);
        this.bots.delete(id);
        this.broadcastState();
        return true;
      }
    }
    return false;
  }

  public updateSettings(socketId: string, newSettings: Partial<GameSettings>): boolean {
    const player = this.players.get(socketId);
    if (!player || !player.isHost || this.phase !== 'LOBBY') return false;

    this.settings = {
      hunterCount: Math.max(1, Math.min(3, Number(newSettings.hunterCount ?? this.settings.hunterCount))),
      roundSec: Math.max(60, Math.min(300, Number(newSettings.roundSec ?? this.settings.roundSec)))
    };
    this.broadcastState();
    return true;
  }

  public startGame(socketId: string): { success: boolean; message?: string } {
    const player = this.players.get(socketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Only the host can start the game' };
    }

    if (this.players.size < MIN_PLAYERS) {
      return { success: false, message: `At least ${MIN_PLAYERS} players (or bots) required to start` };
    }

    this.phase = 'PLAYING';
    this.winner = null;
    this.winReason = null;
    this.timeLeft = this.settings.roundSec;
    this.hunterReleaseIn = HUNTER_RELEASE_SEC;
    this.powerUps = [];
    this.powerUpTimer = POWER_UPS.SPAWN_SEC;

    // Always leave at least two runners so there is someone to rescue
    const playerArray = Array.from(this.players.values());
    const shuffled = [...playerArray].sort(() => Math.random() - 0.5);
    const hunterCount = Math.max(1, Math.min(this.settings.hunterCount, playerArray.length - 2));

    // Runners scatter into random rooms; hunters wait around the central table
    const spawnRooms = ROOMS.filter(r => r.id !== 'mess_hall');
    let hunterIdx = 0;
    shuffled.forEach((p, i) => {
      p.role = i < hunterCount ? 'HUNTER' : 'RUNNER';
      p.status = 'ALIVE';
      p.thawProgress = 0;
      p.immuneFor = 0;
      p.boostFor = 0;
      p.tags = 0;
      p.rescues = 0;
      p.isMoving = false;
      p.facing = 'down';

      if (p.role === 'HUNTER') {
        const angle = (hunterIdx++ / hunterCount) * Math.PI * 2;
        p.x = Math.round(EMERGENCY_TABLE.x + Math.cos(angle) * 120);
        p.y = Math.round(EMERGENCY_TABLE.y + Math.sin(angle) * 120);
      } else {
        const room = spawnRooms[Math.floor(Math.random() * spawnRooms.length)];
        p.x = Math.round(room.x + 60 + Math.random() * (room.width - 120));
        p.y = Math.round(room.y + 60 + Math.random() * (room.height - 120));
      }
    });

    for (const bot of this.bots.values()) {
      bot.reset();
    }

    this.broadcastState();
    return { success: true };
  }

  public handlePlayerMove(socketId: string, x: number, y: number, facing: Facing, isMoving: boolean): void {
    if (this.phase !== 'PLAYING') return;

    const player = this.players.get(socketId);
    if (!player || !this.canMove(player)) return;

    // Server-authoritative movement validation
    const validated = StationMapServer.validateMovement(player.x, player.y, x, y);
    player.x = validated.x;
    player.y = validated.y;
    player.facing = facing;
    player.isMoving = isMoving;
  }

  private canMove(p: PlayerPublic): boolean {
    if (p.status !== 'ALIVE') return false;
    return p.role === 'RUNNER' || this.hunterReleaseIn <= 0;
  }

  public returnToLobby(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player || !player.isHost || this.phase !== 'ENDED') return;

    this.phase = 'LOBBY';
    this.winner = null;
    this.winReason = null;
    this.powerUps = [];

    // Drop players who left mid-round
    for (const [id, p] of this.players.entries()) {
      if (p.status === 'DISCONNECTED') this.players.delete(id);
    }

    for (const p of this.players.values()) {
      p.status = 'ALIVE';
      p.role = 'RUNNER';
      p.x = EMERGENCY_TABLE.x;
      p.y = EMERGENCY_TABLE.y + 140;
    }

    this.broadcastState();
  }

  private startLoop(): void {
    this.loopInterval = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      this.tick(deltaSec);
    }, 50); // 20 Hz
  }

  private tick(deltaSec: number): void {
    if (this.phase !== 'PLAYING') return;

    this.hunterReleaseIn = Math.max(0, this.hunterReleaseIn - deltaSec);
    this.timeLeft = Math.max(0, this.timeLeft - deltaSec);
    if (this.timeLeft <= 0) {
      this.endGame('RUNNER', 'The clock ran out and the runners survived the cold!');
      return;
    }

    for (const p of this.players.values()) {
      if (p.immuneFor > 0) p.immuneFor = Math.max(0, p.immuneFor - deltaSec);
      if (p.boostFor > 0) p.boostFor = Math.max(0, p.boostFor - deltaSec);
    }

    // 1. Bots
    const everyone = Array.from(this.players.values());
    for (const [botId, controller] of this.bots.entries()) {
      const bot = this.players.get(botId);
      if (!bot || !this.canMove(bot)) {
        if (bot) bot.isMoving = false;
        continue;
      }
      const move = controller.update(bot, everyone, this.powerUps, deltaSec);
      bot.x = move.x;
      bot.y = move.y;
      bot.facing = move.facing;
      bot.isMoving = move.isMoving;
    }

    this.updatePowerUps(deltaSec, everyone);

    // 2. Tagging: hunters freeze any runner they touch
    if (this.hunterReleaseIn <= 0) {
      for (const hunter of everyone) {
        if (hunter.role !== 'HUNTER' || hunter.status !== 'ALIVE') continue;
        for (const runner of everyone) {
          if (runner.role !== 'RUNNER' || runner.status !== 'ALIVE' || runner.immuneFor > 0) continue;
          if (Math.hypot(hunter.x - runner.x, hunter.y - runner.y) <= INTERACTION_DISTANCES.TAG) {
            runner.status = 'FROZEN';
            runner.isMoving = false;
            runner.thawProgress = 0;
            hunter.tags++;
            this.io.to(this.code).emit(SOCKET_EVENTS.PLAYER_FROZEN, { hunterId: hunter.id, runnerId: runner.id });
          }
        }
      }
    }

    // 3. Thawing: free runners standing next to a frozen teammate melt them out
    for (const frozen of everyone) {
      if (frozen.status !== 'FROZEN') continue;
      const rescuers = everyone.filter(r =>
        r.role === 'RUNNER' &&
        r.status === 'ALIVE' &&
        Math.hypot(r.x - frozen.x, r.y - frozen.y) <= INTERACTION_DISTANCES.THAW
      );

      if (rescuers.length > 0) {
        frozen.thawProgress += (deltaSec / THAW_SEC) * rescuers.length;
      } else {
        frozen.thawProgress = Math.max(0, frozen.thawProgress - deltaSec / THAW_SEC);
      }

      if (frozen.thawProgress >= 1) {
        frozen.status = 'ALIVE';
        frozen.thawProgress = 0;
        frozen.immuneFor = THAW_IMMUNITY_SEC;
        rescuers.forEach(r => r.rescues++);
        this.io.to(this.code).emit(SOCKET_EVENTS.PLAYER_THAWED, { runnerId: frozen.id, rescuerIds: rescuers.map(r => r.id) });
      }
    }

    if (this.checkWinConditions()) return;
    this.broadcastState();
  }

  private updatePowerUps(deltaSec: number, everyone: PlayerPublic[]): void {
    this.powerUpTimer -= deltaSec;
    if (this.powerUpTimer <= 0) {
      this.powerUpTimer = POWER_UPS.SPAWN_SEC;
      if (this.powerUps.length < POWER_UPS.MAX_ON_MAP) this.spawnPowerUp();
    }

    this.powerUps = this.powerUps.filter(powerUp => {
      const taker = everyone.find(p =>
        p.status === 'ALIVE' &&
        // Shields only protect runners, so hunters leave them on the floor
        (powerUp.type === 'boost' || p.role === 'RUNNER') &&
        Math.hypot(p.x - powerUp.x, p.y - powerUp.y) <= POWER_UPS.PICKUP_DISTANCE
      );
      if (!taker) return true;

      if (powerUp.type === 'boost') {
        taker.boostFor = POWER_UPS.BOOST_SEC;
      } else {
        taker.immuneFor = Math.max(taker.immuneFor, POWER_UPS.SHIELD_SEC);
      }
      this.io.to(this.code).emit(SOCKET_EVENTS.POWER_UP_TAKEN, { playerId: taker.id, type: powerUp.type });
      return false;
    });
  }

  private spawnPowerUp(): void {
    // Retry because a random point can land on the central table
    for (let attempt = 0; attempt < 10; attempt++) {
      const room = ROOMS[Math.floor(Math.random() * ROOMS.length)];
      const x = Math.round(room.x + 50 + Math.random() * (room.width - 100));
      const y = Math.round(room.y + 50 + Math.random() * (room.height - 100));
      if (StationMapServer.isWalkable(x, y)) {
        this.powerUps.push({
          id: `power_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: Math.random() < 0.5 ? 'boost' : 'shield',
          x,
          y
        });
        return;
      }
    }
  }

  private checkWinConditions(): boolean {
    if (this.phase !== 'PLAYING') return false;

    let freeRunners = 0;
    let activeHunters = 0;
    for (const p of this.players.values()) {
      if (p.role === 'RUNNER' && p.status === 'ALIVE') freeRunners++;
      if (p.role === 'HUNTER' && p.status !== 'DISCONNECTED') activeHunters++;
    }

    if (activeHunters === 0) {
      this.endGame('RUNNER', 'The hunters fled the station. Runners win!');
      return true;
    }

    if (freeRunners === 0) {
      this.endGame('HUNTER', 'Every runner is frozen solid. The frost hunters win!');
      return true;
    }

    return false;
  }

  private endGame(winner: Role, reason: string): void {
    this.phase = 'ENDED';
    this.winner = winner;
    this.winReason = reason;
    this.broadcastState();
  }

  private getAvailableColor() {
    const usedKeys = new Set(Array.from(this.players.values()).map(p => p.colorKey));
    const available = COLORS.find(c => !usedKeys.has(c.key));
    return available || COLORS[0];
  }

  private broadcastState(): void {
    const players: Record<string, PlayerPublic> = {};
    for (const [id, p] of this.players.entries()) {
      players[id] = { ...p };
    }

    const snapshot: GameStateSnapshot = {
      roomCode: this.code,
      phase: this.phase,
      players,
      timeLeft: this.timeLeft,
      hunterReleaseIn: this.hunterReleaseIn,
      powerUps: this.powerUps,
      winner: this.winner,
      winReason: this.winReason,
      settings: this.settings
    };

    this.io.to(this.code).emit(SOCKET_EVENTS.GAME_STATE_UPDATE, snapshot);
  }

  public destroy(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }
}
