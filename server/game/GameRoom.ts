import { Server } from 'socket.io';
import {
  GamePhase,
  GameSettings,
  GameStateSnapshot,
  PlayerPublic,
  PlayerStatus,
  PlayerTask,
  Role,
  DeadBody,
  ChatMessage
} from '../../shared/types.js';
import {
  COLORS,
  DEFAULT_SETTINGS,
  EMERGENCY_TABLE,
  INTERACTION_DISTANCES,
  SOCKET_EVENTS,
  VENTS
} from '../../shared/constants.js';
import { StationMapServer } from './StationMapServer.js';
import { TaskManager } from './TaskManager.js';
import { SabotageManager } from './SabotageManager.js';
import { MeetingManager } from './MeetingManager.js';
import { BotController } from './BotController.js';

interface InternalPlayer extends PlayerPublic {
  role: Role;
  assignedTasks: PlayerTask[];
  inVent: boolean;
  currentVentId: string | null;
}

export class GameRoom {
  public code: string;
  private io: Server;
  private phase: GamePhase = 'LOBBY';
  private players: Map<string, InternalPlayer> = new Map();
  private bots: Map<string, BotController> = new Map();
  private deadBodies: DeadBody[] = [];
  private chatMessages: ChatMessage[] = [];
  private sabotageManager: SabotageManager = new SabotageManager();
  private meetingManager: MeetingManager;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private winner: 'CREW' | 'SABOTEUR' | null = null;
  private winReason: string | null = null;

  private loopInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  constructor(code: string, io: Server) {
    this.code = code;
    this.io = io;
    this.meetingManager = new MeetingManager(this.settings.discussionSec, this.settings.votingSec);
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

  public addPlayer(socketId: string, name: string): InternalPlayer {
    const isHost = this.players.size === 0;
    const availableColor = this.getAvailableColor();

    const player: InternalPlayer = {
      id: socketId,
      name: name || `Scientist ${this.players.size + 1}`,
      colorKey: availableColor.key,
      colorHex: availableColor.hex,
      isHost,
      isBot: false,
      status: 'ALIVE',
      x: EMERGENCY_TABLE.x,
      y: EMERGENCY_TABLE.y,
      vx: 0,
      vy: 0,
      facing: 'down',
      isMoving: false,
      inVent: false,
      currentVentId: null,
      role: 'CREW',
      assignedTasks: [],
      killCooldown: this.settings.killCooldownSec,
      emergencyMeetingsLeft: this.settings.emergencyMeetingsPerPlayer
    };

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
    const color = this.getAvailableColor();
    const botNames = [
      'Dr. Frost', 'Cmdr. Boreas', 'Bio. Yuki', 'Tech. Blizzard',
      'Spec. Hielo', 'Officer Tundra', 'Geologist Ice', 'Chemist Hail'
    ];
    const usedNames = new Set(Array.from(this.players.values()).map(p => p.name));
    const availableName = botNames.find(n => !usedNames.has(n)) || `Bot ${this.players.size + 1}`;

    const botPlayer: InternalPlayer = {
      id: botId,
      name: availableName,
      colorKey: color.key,
      colorHex: color.hex,
      isHost: false,
      isBot: true,
      status: 'ALIVE',
      x: EMERGENCY_TABLE.x,
      y: EMERGENCY_TABLE.y,
      vx: 0,
      vy: 0,
      facing: 'down',
      isMoving: false,
      inVent: false,
      currentVentId: null,
      role: 'CREW',
      assignedTasks: [],
      killCooldown: this.settings.killCooldownSec,
      emergencyMeetingsLeft: this.settings.emergencyMeetingsPerPlayer
    };

    this.players.set(botId, botPlayer);
    this.bots.set(botId, new BotController(botId));
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

    this.settings = { ...this.settings, ...newSettings };
    this.meetingManager = new MeetingManager(this.settings.discussionSec, this.settings.votingSec);
    this.broadcastState();
    return true;
  }

  public startGame(socketId: string): { success: boolean; message?: string } {
    const player = this.players.get(socketId);
    if (!player || !player.isHost) {
      return { success: false, message: 'Only the host can start the game' };
    }

    if (this.players.size < 4) {
      return { success: false, message: 'At least 4 players (or bots) required to start' };
    }

    this.phase = 'PLAYING';
    this.winner = null;
    this.winReason = null;
    this.deadBodies = [];
    this.chatMessages = [];
    this.sabotageManager.clearSabotage();

    // Assign roles randomly
    const playerArray = Array.from(this.players.values());
    const shuffled = [...playerArray].sort(() => Math.random() - 0.5);

    const saboteurCount = Math.min(this.settings.saboteurCount, Math.floor(this.players.size / 2));
    const saboteurIds = new Set<string>();

    for (let i = 0; i < shuffled.length; i++) {
      if (i < saboteurCount) {
        shuffled[i].role = 'SABOTEUR';
        saboteurIds.add(shuffled[i].id);
      } else {
        shuffled[i].role = 'CREW';
      }
      shuffled[i].status = 'ALIVE';
      shuffled[i].killCooldown = this.settings.killCooldownSec;
      shuffled[i].emergencyMeetingsLeft = this.settings.emergencyMeetingsPerPlayer;
      shuffled[i].inVent = false;
      shuffled[i].currentVentId = null;

      // Assign 4 tasks to Crew
      if (shuffled[i].role === 'CREW') {
        shuffled[i].assignedTasks = TaskManager.generateTasksForPlayer(shuffled[i].id);
      } else {
        shuffled[i].assignedTasks = [];
      }
    }

    // Position players around the emergency table in a circle
    const count = playerArray.length;
    playerArray.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      p.x = Math.round(EMERGENCY_TABLE.x + Math.cos(angle) * 140);
      p.y = Math.round(EMERGENCY_TABLE.y + Math.sin(angle) * 140);
      p.facing = 'down';
      p.isMoving = false;
    });

    // Notify each human player of their role and tasks
    for (const p of this.players.values()) {
      if (!p.isBot) {
        const socket = this.io.sockets.sockets.get(p.id);
        if (socket) {
          const fellowSaboteurs = p.role === 'SABOTEUR'
            ? Array.from(saboteurIds).filter(id => id !== p.id)
            : [];
          socket.emit(SOCKET_EVENTS.PLAYER_ROLE, {
            role: p.role,
            fellowSaboteurs,
            tasks: p.assignedTasks
          });
        }
      }
    }

    this.broadcastState();
    return { success: true };
  }

  public handlePlayerMove(socketId: string, x: number, y: number, facing: 'left' | 'right' | 'up' | 'down', isMoving: boolean): void {
    if (this.phase !== 'PLAYING') return;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE' || player.inVent) return;

    // Server-authoritative movement validation
    const validated = StationMapServer.validateMovement(player.x, player.y, x, y);
    player.x = validated.x;
    player.y = validated.y;
    player.facing = facing;
    player.isMoving = isMoving;
  }

  public handleUseVent(socketId: string, targetVentId?: string): boolean {
    if (this.phase !== 'PLAYING') return false;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE' || player.role !== 'SABOTEUR') return false;

    if (!player.inVent) {
      // Enter nearest vent if within interaction distance
      const nearest = StationMapServer.getNearestVent(player.x, player.y, INTERACTION_DISTANCES.VENT);
      if (nearest) {
        player.inVent = true;
        player.currentVentId = nearest.id;
        player.x = nearest.x;
        player.y = nearest.y;
        this.broadcastState();
        return true;
      }
    } else {
      // Currently in vent: traverse or exit
      if (targetVentId) {
        const currentVent = VENTS.find(v => v.id === player.currentVentId);
        if (currentVent && currentVent.connectedTo.includes(targetVentId)) {
          const destVent = VENTS.find(v => v.id === targetVentId);
          if (destVent) {
            player.currentVentId = destVent.id;
            player.x = destVent.x;
            player.y = destVent.y;
            this.broadcastState();
            return true;
          }
        }
      } else {
        // Exit vent
        player.inVent = false;
        player.currentVentId = null;
        this.broadcastState();
        return true;
      }
    }
    return false;
  }

  public handleKill(killerId: string, victimId: string): boolean {
    if (this.phase !== 'PLAYING') return false;

    const killer = this.players.get(killerId);
    const victim = this.players.get(victimId);

    if (!killer || killer.status !== 'ALIVE' || killer.role !== 'SABOTEUR' || killer.killCooldown > 0 || killer.inVent) {
      return false;
    }

    if (!victim || victim.status !== 'ALIVE' || victim.role === 'SABOTEUR' || victim.inVent) {
      return false;
    }

    const dist = Math.hypot(killer.x - victim.x, killer.y - victim.y);
    if (dist > INTERACTION_DISTANCES.KILL + 35) {
      return false;
    }

    // Kill confirmed!
    victim.status = 'DEAD';
    killer.killCooldown = this.settings.killCooldownSec;

    // Spawn dead body at victim position
    const body: DeadBody = {
      id: `body_${Date.now()}_${victim.id}`,
      victimId: victim.id,
      victimName: victim.name,
      victimColorHex: victim.colorHex,
      x: victim.x,
      y: victim.y
    };
    this.deadBodies.push(body);

    // Teleport killer to victim position
    killer.x = victim.x;
    killer.y = victim.y;

    this.io.to(this.code).emit(SOCKET_EVENTS.KILL_OCCURRED, {
      killerId: killer.id,
      victimId: victim.id,
      body
    });

    this.checkWinConditions();
    this.broadcastState();
    return true;
  }

  public handleCompleteTask(socketId: string, taskId: string): boolean {
    if (this.phase !== 'PLAYING') return false;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE' || player.role !== 'CREW') return false;

    const success = TaskManager.validateAndComplete(player.x, player.y, player.assignedTasks, taskId);
    if (success) {
      this.checkWinConditions();
      this.broadcastState();
      return true;
    }
    return false;
  }

  public handleReportBody(socketId: string, bodyId: string): boolean {
    if (this.phase !== 'PLAYING') return false;

    const reporter = this.players.get(socketId);
    if (!reporter || reporter.status !== 'ALIVE') return false;

    const body = this.deadBodies.find(b => b.id === bodyId);
    if (!body) return false;

    const dist = Math.hypot(reporter.x - body.x, reporter.y - body.y);
    if (dist > INTERACTION_DISTANCES.REPORT + 40) return false;

    this.startMeeting('body_reported', reporter, body.victimName);
    return true;
  }

  public handleEmergency(socketId: string): boolean {
    if (this.phase !== 'PLAYING') return false;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE' || player.emergencyMeetingsLeft <= 0) return false;

    // Cannot call emergency during active sabotage
    if (this.sabotageManager.getState().active !== null) return false;

    const dist = Math.hypot(player.x - EMERGENCY_TABLE.x, player.y - EMERGENCY_TABLE.y);
    if (dist > INTERACTION_DISTANCES.EMERGENCY + 40) return false;

    player.emergencyMeetingsLeft--;
    this.startMeeting('emergency_button', player);
    return true;
  }

  private startMeeting(reason: 'emergency_button' | 'body_reported', reporter: InternalPlayer, victimName?: string): void {
    this.phase = 'MEETING';
    this.deadBodies = []; // Clear reported dead bodies from map
    this.sabotageManager.clearSabotage(); // Clear any sabotage

    // Reset player positions around the emergency table
    const playerArray = Array.from(this.players.values());
    const count = playerArray.length;
    playerArray.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      p.x = Math.round(EMERGENCY_TABLE.x + Math.cos(angle) * 140);
      p.y = Math.round(EMERGENCY_TABLE.y + Math.sin(angle) * 140);
      p.inVent = false;
      p.currentVentId = null;
      p.isMoving = false;
    });

    // Reset bot controllers for meeting
    for (const bot of this.bots.values()) {
      bot.resetForMeeting();
    }

    const meetingState = this.meetingManager.startMeeting(reason, reporter.id, reporter.name, victimName);
    this.io.to(this.code).emit(SOCKET_EVENTS.MEETING_STARTED, meetingState);
    this.broadcastState();
  }

  public handleChat(socketId: string, text: string): void {
    if (this.phase !== 'MEETING') return;

    const sender = this.players.get(socketId);
    if (!sender || !text.trim()) return;

    const msg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderColorHex: sender.colorHex,
      text: text.trim().slice(0, 160),
      isGhost: sender.status === 'DEAD',
      timestamp: Date.now()
    };

    this.chatMessages.push(msg);

    // Filter: if sender is ghost, only send to dead players
    for (const player of this.players.values()) {
      if (!player.isBot) {
        const socket = this.io.sockets.sockets.get(player.id);
        if (socket) {
          if (!msg.isGhost || player.status === 'DEAD') {
            socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, msg);
          }
        }
      }
    }
  }

  public handleCastVote(socketId: string, targetId: string): boolean {
    if (this.phase !== 'MEETING') return false;

    const voter = this.players.get(socketId);
    if (!voter || voter.status !== 'ALIVE') return false;

    const ok = this.meetingManager.recordVote(socketId, targetId);
    if (ok) {
      this.io.to(this.code).emit(SOCKET_EVENTS.VOTE_UPDATE, {
        voterId: socketId,
        hasVoted: true
      });
      this.broadcastState();
      return true;
    }
    return false;
  }

  public handleTriggerSabotage(socketId: string, type: 'meltdown' | 'blackout'): boolean {
    if (this.phase !== 'PLAYING') return false;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE' || player.role !== 'SABOTEUR') return false;

    const ok = this.sabotageManager.trigger(type);
    if (ok) {
      this.broadcastState();
      return true;
    }
    return false;
  }

  public handleFixSabotageStep(
    socketId: string,
    fixType: 'meltdown_reactor' | 'meltdown_lifesupport' | 'blackout_switch',
    switchIndex?: number
  ): boolean {
    if (this.phase !== 'PLAYING') return false;

    const player = this.players.get(socketId);
    if (!player || player.status !== 'ALIVE') return false;

    const ok = this.sabotageManager.applyFixStep(player.x, player.y, fixType, switchIndex);
    if (ok) {
      this.broadcastState();
      return true;
    }
    return false;
  }

  public returnToLobby(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player || !player.isHost || this.phase !== 'ENDED') return;

    this.phase = 'LOBBY';
    this.winner = null;
    this.winReason = null;
    this.deadBodies = [];
    this.chatMessages = [];
    this.sabotageManager.clearSabotage();
    this.meetingManager.endMeeting();

    for (const p of this.players.values()) {
      p.status = 'ALIVE';
      p.role = 'CREW';
      p.inVent = false;
      p.currentVentId = null;
      p.assignedTasks = [];
      p.x = EMERGENCY_TABLE.x;
      p.y = EMERGENCY_TABLE.y;
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
    if (this.phase === 'PLAYING') {
      // 1. Tick kill cooldowns
      for (const p of this.players.values()) {
        if (p.role === 'SABOTEUR' && p.killCooldown > 0) {
          p.killCooldown = Math.max(0, p.killCooldown - deltaSec);
        }
      }

      // 2. Tick Sabotage
      this.sabotageManager.updateCooldown(deltaSec);
      const sabotageResult = this.sabotageManager.tick(deltaSec);
      if (sabotageResult === 'MELTDOWN_CRITICAL') {
        this.endGame('SABOTEUR', 'The reactor reached critical meltdown! The station froze and collapsed.');
        return;
      }

      // 3. Tick Bots
      for (const [botId, botController] of this.bots.entries()) {
        const botPlayer = this.players.get(botId);
        if (!botPlayer || botPlayer.status !== 'ALIVE') continue;

        // Bot movement and task progress
        const moveResult = botController.updateMovement(botPlayer, botPlayer.assignedTasks, deltaSec);
        botPlayer.x = moveResult.newX;
        botPlayer.y = moveResult.newY;
        botPlayer.facing = moveResult.facing;
        botPlayer.isMoving = moveResult.isMoving;

        if (moveResult.completedTaskId) {
          const task = botPlayer.assignedTasks.find(t => t.id === moveResult.completedTaskId);
          if (task) task.completed = true;
          this.checkWinConditions();
        }

        // Bot body detection and reporting
        if (botPlayer.role === 'CREW') {
          for (const body of this.deadBodies) {
            const dist = Math.hypot(botPlayer.x - body.x, botPlayer.y - body.y);
            if (dist < 130 && Math.random() < 0.05) {
              this.startMeeting('body_reported', botPlayer, body.victimName);
              return;
            }
          }
        } else if (botPlayer.role === 'SABOTEUR' && botPlayer.killCooldown <= 0) {
          // Bot saboteur kill attempt if isolated
          for (const target of this.players.values()) {
            if (target.id !== botId && target.status === 'ALIVE' && target.role === 'CREW') {
              const dist = Math.hypot(botPlayer.x - target.x, botPlayer.y - target.y);
              if (dist <= INTERACTION_DISTANCES.KILL) {
                this.handleKill(botId, target.id);
                break;
              }
            }
          }
        }
      }
    } else if (this.phase === 'MEETING') {
      const alivePlayerIds = Array.from(this.players.values())
        .filter(p => p.status === 'ALIVE')
        .map(p => p.id);

      const playerMap: Record<string, { name: string; role?: Role }> = {};
      for (const p of this.players.values()) {
        playerMap[p.id] = { name: p.name, role: p.role };
      }

      // Tick bot chats during discussion
      const meetingState = this.meetingManager.getState();
      if (meetingState?.phase === 'DISCUSSION') {
        for (const [botId, botController] of this.bots.entries()) {
          const botPlayer = this.players.get(botId);
          if (botPlayer && botPlayer.status === 'ALIVE' && botController.shouldChat()) {
            const chatText = botController.getRandomChatMessage(meetingState.reporterName, botPlayer.role === 'SABOTEUR');
            this.handleChat(botId, chatText);
          }
        }
      }

      // Tick bot voting during voting phase
      if (meetingState?.phase === 'VOTING') {
        const candidateIds = alivePlayerIds;
        for (const [botId, botController] of this.bots.entries()) {
          const botPlayer = this.players.get(botId);
          if (botPlayer && botPlayer.status === 'ALIVE') {
            const vote = botController.tickVote(deltaSec, candidateIds.filter(id => id !== botId));
            if (vote) {
              this.handleCastVote(botId, vote);
            }
          }
        }
      }

      const result = this.meetingManager.tick(deltaSec, alivePlayerIds, playerMap);

      if (result.finished) {
        // Meeting concluded!
        if (result.ejectedId && result.ejectedId !== 'skip' && result.ejectedId !== 'tie') {
          const ejectedPlayer = this.players.get(result.ejectedId);
          if (ejectedPlayer) {
            ejectedPlayer.status = 'DEAD';
          }
        }

        const gameOver = this.checkWinConditions();
        if (!gameOver) {
          this.phase = 'PLAYING';
          // Reset player cooldowns
          for (const p of this.players.values()) {
            if (p.role === 'SABOTEUR') {
              p.killCooldown = this.settings.killCooldownSec;
            }
          }
        }
      }
    }

    this.broadcastState();
  }

  private checkWinConditions(): boolean {
    if (this.phase !== 'PLAYING' && this.phase !== 'MEETING') return false;

    let aliveCrew = 0;
    let aliveSaboteurs = 0;
    let totalCrewTasks = 0;
    let completedCrewTasks = 0;

    for (const p of this.players.values()) {
      if (p.role === 'CREW') {
        totalCrewTasks += p.assignedTasks.length;
        completedCrewTasks += p.assignedTasks.filter(t => t.completed).length;
        if (p.status === 'ALIVE') aliveCrew++;
      } else if (p.role === 'SABOTEUR') {
        if (p.status === 'ALIVE') aliveSaboteurs++;
      }
    }

    // 1. Crew wins if all saboteurs are dead/ejected
    if (aliveSaboteurs === 0) {
      this.endGame('CREW', 'All Saboteurs have been ejected! The station is secured.');
      return true;
    }

    // 2. Saboteurs win if alive Saboteurs >= alive Crew
    if (aliveSaboteurs >= aliveCrew) {
      this.endGame('SABOTEUR', 'The Saboteurs have overwhelmed the crew! The outpost is lost.');
      return true;
    }

    // 3. Crew wins if all tasks are 100% completed
    if (totalCrewTasks > 0 && completedCrewTasks >= totalCrewTasks) {
      this.endGame('CREW', 'All station maintenance tasks completed! The outpost is saved.');
      return true;
    }

    return false;
  }

  private endGame(winner: 'CREW' | 'SABOTEUR', reason: string): void {
    this.phase = 'ENDED';
    this.winner = winner;
    this.winReason = reason;

    this.io.to(this.code).emit(SOCKET_EVENTS.GAME_OVER, {
      winner,
      reason,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        colorHex: p.colorHex
      }))
    });

    this.broadcastState();
  }

  private getAvailableColor() {
    const usedKeys = new Set(Array.from(this.players.values()).map(p => p.colorKey));
    const available = COLORS.find(c => !usedKeys.has(c.key));
    return available || COLORS[0];
  }

  private broadcastState(): void {
    let totalTasks = 0;
    let completedTasks = 0;
    for (const p of this.players.values()) {
      if (p.role === 'CREW') {
        totalTasks += p.assignedTasks.length;
        completedTasks += p.assignedTasks.filter(t => t.completed).length;
      }
    }

    // Prepare public players list
    const publicPlayers: Record<string, PlayerPublic> = {};
    for (const [id, p] of this.players.entries()) {
      publicPlayers[id] = {
        id: p.id,
        name: p.name,
        colorKey: p.colorKey,
        colorHex: p.colorHex,
        isHost: p.isHost,
        isBot: p.isBot,
        status: p.status,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        isMoving: p.isMoving,
        inVent: p.inVent,
        // Role is hidden during play, unless ended
        role: this.phase === 'ENDED' ? p.role : undefined,
        killCooldown: p.killCooldown,
        emergencyMeetingsLeft: p.emergencyMeetingsLeft
      };
    }

    const snapshot: GameStateSnapshot = {
      roomCode: this.code,
      phase: this.phase,
      players: publicPlayers,
      tasksTotal: totalTasks,
      tasksCompleted: completedTasks,
      deadBodies: this.deadBodies,
      sabotage: this.sabotageManager.getState(),
      meeting: this.meetingManager.getState(),
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
