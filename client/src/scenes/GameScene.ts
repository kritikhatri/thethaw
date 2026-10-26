import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import {
  CORRIDORS,
  EMERGENCY_TABLE,
  INTERACTION_DISTANCES,
  MAP_HEIGHT,
  MAP_WIDTH,
  ROOMS,
  SABOTAGE_FIX_LOCATIONS,
  SOCKET_EVENTS,
  TASK_CONSOLES,
  VENTS,
  VISION_RADIUS
} from '@shared/constants';
import {
  ChatMessage,
  DeadBody,
  GameStateSnapshot,
  MeetingState,
  PlayerPublic,
  PlayerTask,
  Role
} from '@shared/types';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';
import { HudOverlay } from '../ui/HudOverlay.js';
import { MeetingModal } from '../ui/MeetingModal.js';
import { SabotageModal } from '../ui/SabotageModal.js';
import { CardSwipeTask } from '../ui/tasks/CardSwipeTask.js';
import { DownloadTask } from '../ui/tasks/DownloadTask.js';
import { KeypadTask } from '../ui/tasks/KeypadTask.js';
import { LeversTask } from '../ui/tasks/LeversTask.js';
import { WiringTask } from '../ui/tasks/WiringTask.js';

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
}

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private myPlayerId!: string;
  private myRole: Role = 'CREW';
  private fellowSaboteurs: string[] = [];
  private myTasks: PlayerTask[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    R: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    V: Phaser.Input.Keyboard.Key;
  };

  private playerVisuals: Map<string, PlayerVisual> = new Map();
  private deadBodySprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  private localX: number = EMERGENCY_TABLE.x;
  private localY: number = EMERGENCY_TABLE.y;
  private localFacing: 'left' | 'right' | 'up' | 'down' = 'down';
  private localIsMoving: boolean = false;
  private localInVent: boolean = false;

  private latestSnapshot: GameStateSnapshot | null = null;
  private chatMessages: ChatMessage[] = [];
  private hudOverlay!: HudOverlay;
  private isModalOpen: boolean = false;

  // Fog of war
  private fogMaskGraphics!: Phaser.GameObjects.Graphics;
  private darknessLayer!: Phaser.GameObjects.RenderTexture;

  // Visual Theme Touch: Dynamic Frosting / Melting Overlay
  private frostVignette!: Phaser.GameObjects.Image;
  private targetFrostAlpha: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { snapshot: GameStateSnapshot; myPlayerId: string }): void {
    this.latestSnapshot = data.snapshot;
    this.myPlayerId = data.myPlayerId;
  }

  create(): void {
    this.socket = this.registry.get('socket');
    const uiLayer = document.getElementById('ui-layer')!;
    uiLayer.innerHTML = '';

    // Setup input keys
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      Q: Phaser.Input.Keyboard.KeyCodes.Q,
      V: Phaser.Input.Keyboard.KeyCodes.V
    }) as typeof this.wasdKeys;

    // Render Station Architecture
    this.renderStationMap();

    // Camera setup
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setZoom(1.15);

    // Fog of War Darkness Mask
    this.darknessLayer = this.make.renderTexture({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2
    }, false);
    this.darknessLayer.setDepth(40);
    this.add.existing(this.darknessLayer);

    this.fogMaskGraphics = this.make.graphics({ x: 0, y: 0 });

    // Frosting/Thawing Overlay
    this.frostVignette = this.add.image(0, 0, 'frost_vignette');
    this.frostVignette.setScrollFactor(0);
    this.frostVignette.setDisplaySize(this.scale.width, this.scale.height);
    this.frostVignette.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.frostVignette.setDepth(60);
    this.frostVignette.setAlpha(0);

    // Initialize HUD Overlay
    this.hudOverlay = new HudOverlay(uiLayer, {
      onUse: () => this.handleActionUse(),
      onReport: () => this.handleActionReport(),
      onKill: () => this.handleActionKill(),
      onSabotage: () => this.handleActionSabotage(),
      onVent: () => this.handleActionVent()
    });

    // Initialize Meeting Modal on dedicated modal-layer
    const modalLayer = document.getElementById('modal-layer') || uiLayer;
    MeetingModal.init(modalLayer, this.myPlayerId);

    // Setup Socket Listeners
    this.setupSocketListeners();

    // Resize handling
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.frostVignette.setDisplaySize(gameSize.width, gameSize.height);
      this.frostVignette.setPosition(gameSize.width / 2, gameSize.height / 2);
    });

    (window as any).__gameScene = this;
  }

  private setupSocketListeners(): void {
    this.socket.on(SOCKET_EVENTS.PLAYER_ROLE, ({ role, fellowSaboteurs, tasks }) => {
      this.myRole = role;
      this.fellowSaboteurs = fellowSaboteurs || [];
      this.myTasks = tasks || [];
      SoundSynthesizer.playAlarm();
    });

    this.socket.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (snapshot: GameStateSnapshot) => {
      this.latestSnapshot = snapshot;

      if (snapshot.phase === 'ENDED') {
        const uiLayer = document.getElementById('ui-layer')!;
        uiLayer.innerHTML = '';
        this.scene.start('EndScene', { snapshot, myPlayerId: this.myPlayerId });
        return;
      }

      this.updateWorldState(snapshot);
    });

    this.socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg: ChatMessage) => {
      this.chatMessages.push(msg);
      if (this.latestSnapshot?.meeting?.active) {
        MeetingModal.update(
          this.latestSnapshot.meeting,
          this.latestSnapshot.players,
          this.chatMessages,
          (targetId) => this.socket.emit(SOCKET_EVENTS.CAST_VOTE, { targetId }),
          (text) => this.socket.emit(SOCKET_EVENTS.SEND_CHAT, { text })
        );
      }
    });

    this.socket.on(SOCKET_EVENTS.KILL_OCCURRED, () => {
      SoundSynthesizer.playKill();
    });

    this.socket.on(SOCKET_EVENTS.MEETING_STARTED, () => {
      SoundSynthesizer.playAlarm();
      this.isModalOpen = false;
      const modalEl = document.querySelector('#ui-layer .interactive');
      if (modalEl && modalEl !== document.getElementById('ui-layer')) {
        modalEl.innerHTML = '';
      }
    });
  }

  private renderStationMap(): void {
    // 1. Corridors
    for (const c of CORRIDORS) {
      for (let x = c.x; x < c.x + c.width; x += 64) {
        for (let y = c.y; y < c.y + c.height; y += 64) {
          const tile = this.add.image(x + 32, y + 32, 'tile_corridor');
          tile.setDepth(1);
        }
      }
    }

    // 2. Rooms
    for (const r of ROOMS) {
      // Floor tiles
      for (let x = r.x; x < r.x + r.width; x += 64) {
        for (let y = r.y; y < r.y + r.height; y += 64) {
          const tile = this.add.image(x + 32, y + 32, 'tile_floor');
          tile.setDepth(2);
        }
      }

      // Walls
      const wallG = this.add.graphics();
      wallG.setDepth(5);
      wallG.lineStyle(6, 0x38bdf8, 0.9);
      wallG.strokeRect(r.x, r.y, r.width, r.height);

      // Room Name Header
      const label = this.add.text(r.x + 16, r.y + 14, r.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#38bdf8'
      });
      label.setDepth(6);
    }

    // 3. Emergency Meeting Table in Mess Hall
    const table = this.add.image(EMERGENCY_TABLE.x, EMERGENCY_TABLE.y, 'table_emergency');
    table.setDepth(10);

    // 4. Task Consoles
    for (const tc of TASK_CONSOLES) {
      const consoleSprite = this.add.image(tc.x, tc.y, 'console_task');
      consoleSprite.setDepth(10);

      const tcLabel = this.add.text(tc.x, tc.y - 30, tc.label, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#e0f2fe',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        padding: { x: 4, y: 2 }
      });
      tcLabel.setOrigin(0.5);
      tcLabel.setDepth(11);
    }

    // 5. Sabotage Consoles
    const reactorFix = this.add.image(SABOTAGE_FIX_LOCATIONS.meltdownReactor.x, SABOTAGE_FIX_LOCATIONS.meltdownReactor.y, 'console_task');
    reactorFix.setTint(0xef4444);
    reactorFix.setDepth(10);

    const lifeSupportFix = this.add.image(SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.x, SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.y, 'console_task');
    lifeSupportFix.setTint(0xef4444);
    lifeSupportFix.setDepth(10);

    const elecFix = this.add.image(SABOTAGE_FIX_LOCATIONS.electricalBreakers.x, SABOTAGE_FIX_LOCATIONS.electricalBreakers.y, 'console_task');
    elecFix.setTint(0x38bdf8);
    elecFix.setDepth(10);

    // 6. Vents
    for (const v of VENTS) {
      const ventSprite = this.add.image(v.x, v.y, 'vent_grate');
      ventSprite.setDepth(3);
    }
  }

  update(time: number, delta: number): void {
    if (!this.latestSnapshot) return;

    // Handle local movement during PLAYING phase
    if (this.latestSnapshot.phase === 'PLAYING' && !this.isModalOpen && !this.localInVent) {
      this.handlePlayerInput(delta);
    }

    // Update smooth positions for all players
    this.updatePlayerVisuals(delta);

    // Update Fog of War
    this.updateFogOfWar();

    // Update Frosting / Melting Visual Theme Touch
    this.updateFrostEffect(delta);

    // Update HUD buttons and interaction states
    this.updateInteractions();
  }

  private handlePlayerInput(delta: number): void {
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (!me || me.status !== 'ALIVE') return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) dy += 1;

    // Hotkey triggers
    if (Phaser.Input.Keyboard.JustDown(this.wasdKeys.E)) this.handleActionUse();
    if (Phaser.Input.Keyboard.JustDown(this.wasdKeys.R)) this.handleActionReport();
    if (Phaser.Input.Keyboard.JustDown(this.wasdKeys.Q)) this.handleActionKill();
    if (Phaser.Input.Keyboard.JustDown(this.wasdKeys.V)) this.handleActionVent();

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const speed = 200; // px/sec
      const len = Math.hypot(dx, dy);
      const step = (speed * delta) / 1000;

      const newX = this.localX + (dx / len) * step;
      const newY = this.localY + (dy / len) * step;

      // Predict locally
      this.localX = Math.max(30, Math.min(MAP_WIDTH - 30, newX));
      this.localY = Math.max(30, Math.min(MAP_HEIGHT - 30, newY));

      if (Math.abs(dx) > Math.abs(dy)) {
        this.localFacing = dx < 0 ? 'left' : 'right';
      } else {
        this.localFacing = dy < 0 ? 'up' : 'down';
      }

      this.localIsMoving = true;

      // Send to server
      this.socket.emit(SOCKET_EVENTS.PLAYER_MOVE, {
        x: Math.round(this.localX),
        y: Math.round(this.localY),
        facing: this.localFacing,
        isMoving: true
      });
    } else if (this.localIsMoving) {
      this.localIsMoving = false;
      this.socket.emit(SOCKET_EVENTS.PLAYER_MOVE, {
        x: Math.round(this.localX),
        y: Math.round(this.localY),
        facing: this.localFacing,
        isMoving: false
      });
    }

    // Camera track
    this.cameras.main.centerOn(this.localX, this.localY);
  }

  private updateWorldState(snapshot: GameStateSnapshot): void {
    const me = snapshot.players[this.myPlayerId];
    if (me) {
      this.localInVent = me.inVent;
      // Soft reconcile if drifted too far from server
      const drift = Math.hypot(this.localX - me.x, this.localY - me.y);
      if (drift > 65) {
        this.localX = me.x;
        this.localY = me.y;
      }
    }

    // Update Dead Bodies
    const currentBodyIds = new Set(snapshot.deadBodies.map(b => b.id));
    for (const [id, sprite] of this.deadBodySprites.entries()) {
      if (!currentBodyIds.has(id)) {
        sprite.destroy();
        this.deadBodySprites.delete(id);
      }
    }
    for (const body of snapshot.deadBodies) {
      if (!this.deadBodySprites.has(body.id)) {
        const colorKey = this.getColorKeyFromHex(body.victimColorHex);
        const sprite = this.add.sprite(body.x, body.y, `dead_${colorKey}`);
        sprite.setDepth(15);
        this.deadBodySprites.set(body.id, sprite);
      }
    }

    // Meeting modal sync
    if (snapshot.phase === 'MEETING' && snapshot.meeting) {
      MeetingModal.update(
        snapshot.meeting,
        snapshot.players,
        this.chatMessages,
        (targetId) => this.socket.emit(SOCKET_EVENTS.CAST_VOTE, { targetId }),
        (text) => this.socket.emit(SOCKET_EVENTS.SEND_CHAT, { text })
      );
    } else if (snapshot.phase === 'PLAYING') {
      MeetingModal.update(null, snapshot.players, [], () => {}, () => {});
    }
  }

  private updatePlayerVisuals(delta: number): void {
    if (!this.latestSnapshot) return;

    const currentIds = new Set(Object.keys(this.latestSnapshot.players));

    // Remove old players
    for (const [id, visual] of this.playerVisuals.entries()) {
      if (!currentIds.has(id)) {
        visual.container.destroy();
        this.playerVisuals.delete(id);
      }
    }

    // Create or update players
    for (const [id, p] of Object.entries(this.latestSnapshot.players)) {
      let visual = this.playerVisuals.get(id);

      if (!visual) {
        const container = this.add.container(p.x, p.y);
        container.setDepth(20);

        const sprite = this.add.sprite(0, 0, `player_${p.colorKey}`);
        const nameText = this.add.text(0, -32, p.name, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        });
        nameText.setOrigin(0.5);

        container.add([sprite, nameText]);
        visual = { container, sprite, nameText, targetX: p.x, targetY: p.y };
        this.playerVisuals.set(id, visual);
      }

      visual.targetX = p.x;
      visual.targetY = p.y;

      // Handle visibility & vent invisibility
      visual.container.setVisible(!p.inVent && p.status !== 'DEAD');

      // Highlight fellow Saboteurs in red
      if (this.myRole === 'SABOTEUR' && (this.fellowSaboteurs.includes(id) || id === this.myPlayerId)) {
        visual.nameText.setColor('#f87171');
      }

      // Smooth interpolation for remote players
      if (id !== this.myPlayerId) {
        const lerpFactor = Math.min(1, (12 * delta) / 1000);
        visual.container.x += (visual.targetX - visual.container.x) * lerpFactor;
        visual.container.y += (visual.targetY - visual.container.y) * lerpFactor;

        // Flip sprite facing
        if (p.facing === 'left') visual.sprite.setFlipX(true);
        else if (p.facing === 'right') visual.sprite.setFlipX(false);

        // Bobbing animation if moving
        if (p.isMoving) {
          visual.sprite.y = Math.sin(this.time.now * 0.015) * 3;
        } else {
          visual.sprite.y = 0;
        }
      } else {
        // Local player position
        visual.container.x = this.localX;
        visual.container.y = this.localY;
        visual.sprite.setFlipX(this.localFacing === 'left');
        if (this.localIsMoving) {
          visual.sprite.y = Math.sin(this.time.now * 0.015) * 3;
        } else {
          visual.sprite.y = 0;
        }
      }
    }
  }

  private updateFogOfWar(): void {
    if (!this.latestSnapshot) return;

    const me = this.latestSnapshot.players[this.myPlayerId];
    const isGhost = me ? me.status === 'DEAD' : false;
    const isSabotageBlackout = this.latestSnapshot.sabotage.active === 'blackout';

    let radius = VISION_RADIUS.NORMAL;
    if (isGhost) {
      radius = VISION_RADIUS.GHOST;
    } else if (isSabotageBlackout) {
      radius = this.myRole === 'SABOTEUR' ? VISION_RADIUS.BLACKOUT_SABOTEUR : VISION_RADIUS.BLACKOUT_CREW;
    }

    // Clear darkness and render radial cutout centered on player
    this.darknessLayer.clear();
    this.fogMaskGraphics.clear();

    // Fill map in darkness
    this.darknessLayer.fill(0x030712, isGhost ? 0.2 : 0.94);

    // Erase flashlight circle around player
    this.fogMaskGraphics.fillStyle(0xffffff, 1);
    this.fogMaskGraphics.fillCircle(this.localX, this.localY, radius);

    this.darknessLayer.erase(this.fogMaskGraphics, 0, 0);
  }

  private updateFrostEffect(delta: number): void {
    if (!this.latestSnapshot) return;

    const isSabotage = this.latestSnapshot.sabotage.active !== null;
    if (isSabotage) {
      if (this.latestSnapshot.sabotage.active === 'meltdown') {
        // As countdown lowers, frost deepens and pulses
        const timeLeft = this.latestSnapshot.sabotage.timeLeft;
        const urgency = 1 - Math.min(1, timeLeft / 45);
        this.targetFrostAlpha = 0.5 + urgency * 0.4 + Math.sin(this.time.now * 0.008) * 0.1;
      } else {
        this.targetFrostAlpha = 0.6;
      }
    } else {
      // Normal thawed state
      this.targetFrostAlpha = 0;
    }

    // Smooth frost transition
    const currentAlpha = this.frostVignette.alpha;
    const lerp = Math.min(1, (2 * delta) / 1000);
    this.frostVignette.setAlpha(currentAlpha + (this.targetFrostAlpha - currentAlpha) * lerp);
  }

  private updateInteractions(): void {
    if (!this.latestSnapshot || this.latestSnapshot.phase !== 'PLAYING') return;

    const me = this.latestSnapshot.players[this.myPlayerId];
    if (!me || me.status !== 'ALIVE') return;

    const canUse = this.checkCanUse();
    const canReport = this.checkCanReport();
    const canKill = this.checkCanKill();
    const canVent = this.checkCanVent();

    this.hudOverlay.update(
      this.latestSnapshot,
      this.myPlayerId,
      this.myRole,
      this.myTasks,
      canUse,
      canReport,
      canKill,
      canVent,
      this.localInVent
    );
  }

  private checkCanUse(): boolean {
    if (this.isModalOpen || this.localInVent) return false;

    // 1. Check if near task console
    for (const t of this.myTasks) {
      if (!t.completed) {
        const dist = Math.hypot(this.localX - t.x, this.localY - t.y);
        if (dist <= INTERACTION_DISTANCES.TASK) return true;
      }
    }

    // 2. Check if near Emergency table
    const tableDist = Math.hypot(this.localX - EMERGENCY_TABLE.x, this.localY - EMERGENCY_TABLE.y);
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (
      tableDist <= INTERACTION_DISTANCES.EMERGENCY &&
      me &&
      me.emergencyMeetingsLeft > 0 &&
      this.latestSnapshot?.sabotage.active === null
    ) {
      return true;
    }

    // 3. Check if near Sabotage Fix
    if (this.latestSnapshot?.sabotage.active === 'meltdown') {
      const d1 = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.meltdownReactor.x, this.localY - SABOTAGE_FIX_LOCATIONS.meltdownReactor.y);
      const d2 = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.x, this.localY - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.y);
      if (d1 <= INTERACTION_DISTANCES.SABOTAGE_FIX || d2 <= INTERACTION_DISTANCES.SABOTAGE_FIX) return true;
    } else if (this.latestSnapshot?.sabotage.active === 'blackout') {
      const d = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.electricalBreakers.x, this.localY - SABOTAGE_FIX_LOCATIONS.electricalBreakers.y);
      if (d <= INTERACTION_DISTANCES.SABOTAGE_FIX) return true;
    }

    return false;
  }

  private checkCanReport(): boolean {
    if (this.isModalOpen || this.localInVent) return false;
    for (const b of this.latestSnapshot?.deadBodies || []) {
      const dist = Math.hypot(this.localX - b.x, this.localY - b.y);
      if (dist <= INTERACTION_DISTANCES.REPORT) return true;
    }
    return false;
  }

  private checkCanKill(): boolean {
    if (this.myRole !== 'SABOTEUR' || this.isModalOpen || this.localInVent) return false;
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (!me || me.killCooldown > 0) return false;

    for (const target of Object.values(this.latestSnapshot?.players || {})) {
      if (
        target.id !== this.myPlayerId &&
        target.status === 'ALIVE' &&
        !this.fellowSaboteurs.includes(target.id) &&
        !target.inVent
      ) {
        const dist = Math.hypot(this.localX - target.x, this.localY - target.y);
        if (dist <= INTERACTION_DISTANCES.KILL) return true;
      }
    }
    return false;
  }

  private checkCanVent(): boolean {
    if (this.myRole !== 'SABOTEUR' || this.isModalOpen) return false;
    for (const v of VENTS) {
      const dist = Math.hypot(this.localX - v.x, this.localY - v.y);
      if (dist <= INTERACTION_DISTANCES.VENT) return true;
    }
    return false;
  }

  private handleActionUse(): void {
    if (this.isModalOpen || !this.latestSnapshot) return;
    const modalLayer = document.getElementById('modal-layer') || document.getElementById('ui-layer')!;

    // 1. Task consoles
    for (const t of this.myTasks) {
      if (!t.completed) {
        const dist = Math.hypot(this.localX - t.x, this.localY - t.y);
        if (dist <= INTERACTION_DISTANCES.TASK) {
          this.openTaskModal(modalLayer, t);
          return;
        }
      }
    }

    // 2. Emergency meeting table
    const tableDist = Math.hypot(this.localX - EMERGENCY_TABLE.x, this.localY - EMERGENCY_TABLE.y);
    const me = this.latestSnapshot.players[this.myPlayerId];
    if (
      tableDist <= INTERACTION_DISTANCES.EMERGENCY &&
      me &&
      me.emergencyMeetingsLeft > 0 &&
      this.latestSnapshot.sabotage.active === null
    ) {
      SoundSynthesizer.playAlarm();
      this.socket.emit(SOCKET_EVENTS.TRIGGER_EMERGENCY);
      return;
    }

    // 3. Sabotage fix
    if (this.latestSnapshot.sabotage.active === 'meltdown') {
      const d1 = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.meltdownReactor.x, this.localY - SABOTAGE_FIX_LOCATIONS.meltdownReactor.y);
      const d2 = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.x, this.localY - SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.y);
      if (d1 <= INTERACTION_DISTANCES.SABOTAGE_FIX) {
        this.isModalOpen = true;
        SabotageModal.openMeltdownFixModal(
          modalLayer,
          SABOTAGE_FIX_LOCATIONS.meltdownReactor.label,
          () => this.socket.emit(SOCKET_EVENTS.FIX_SABOTAGE_STEP, { fixType: 'meltdown_reactor' }),
          () => { this.isModalOpen = false; }
        );
        return;
      } else if (d2 <= INTERACTION_DISTANCES.SABOTAGE_FIX) {
        this.isModalOpen = true;
        SabotageModal.openMeltdownFixModal(
          modalLayer,
          SABOTAGE_FIX_LOCATIONS.meltdownLifeSupport.label,
          () => this.socket.emit(SOCKET_EVENTS.FIX_SABOTAGE_STEP, { fixType: 'meltdown_lifesupport' }),
          () => { this.isModalOpen = false; }
        );
        return;
      }
    } else if (this.latestSnapshot.sabotage.active === 'blackout') {
      const d = Math.hypot(this.localX - SABOTAGE_FIX_LOCATIONS.electricalBreakers.x, this.localY - SABOTAGE_FIX_LOCATIONS.electricalBreakers.y);
      if (d <= INTERACTION_DISTANCES.SABOTAGE_FIX) {
        this.isModalOpen = true;
        SabotageModal.openBlackoutFixModal(
          modalLayer,
          this.latestSnapshot.sabotage.blackoutSwitches,
          (idx) => this.socket.emit(SOCKET_EVENTS.FIX_SABOTAGE_STEP, { fixType: 'blackout_switch', switchIndex: idx }),
          () => { this.isModalOpen = false; }
        );
        return;
      }
    }
  }

  public openTaskModal(container: HTMLElement, task: PlayerTask): void {
    this.isModalOpen = true;
    const modalLayer = document.getElementById('modal-layer') || container;

    const onComplete = () => {
      this.isModalOpen = false;
      task.completed = true;
      this.socket.emit(SOCKET_EVENTS.COMPLETE_TASK, { taskId: task.id });
    };

    const onClose = () => {
      this.isModalOpen = false;
    };

    switch (task.type) {
      case 'wires':
        WiringTask.open(modalLayer, onComplete, onClose);
        break;
      case 'card_swipe':
        CardSwipeTask.open(modalLayer, onComplete, onClose);
        break;
      case 'download':
        DownloadTask.open(modalLayer, onComplete, onClose);
        break;
      case 'keypad':
        KeypadTask.open(modalLayer, onComplete, onClose);
        break;
      case 'levers':
        LeversTask.open(modalLayer, onComplete, onClose);
        break;
    }
  }

  private handleActionReport(): void {
    for (const b of this.latestSnapshot?.deadBodies || []) {
      const dist = Math.hypot(this.localX - b.x, this.localY - b.y);
      if (dist <= INTERACTION_DISTANCES.REPORT) {
        SoundSynthesizer.playAlarm();
        this.socket.emit(SOCKET_EVENTS.REPORT_BODY, { bodyId: b.id });
        return;
      }
    }
  }

  private handleActionKill(): void {
    if (this.myRole !== 'SABOTEUR' || this.localInVent) return;

    for (const target of Object.values(this.latestSnapshot?.players || {})) {
      if (
        target.id !== this.myPlayerId &&
        target.status === 'ALIVE' &&
        !this.fellowSaboteurs.includes(target.id) &&
        !target.inVent
      ) {
        const dist = Math.hypot(this.localX - target.x, this.localY - target.y);
        if (dist <= INTERACTION_DISTANCES.KILL) {
          SoundSynthesizer.playKill();
          this.socket.emit(SOCKET_EVENTS.KILL_PLAYER, { victimId: target.id });
          return;
        }
      }
    }
  }

  private handleActionVent(): void {
    if (this.myRole !== 'SABOTEUR') return;
    SoundSynthesizer.playVent();
    this.socket.emit(SOCKET_EVENTS.USE_VENT, {});
  }

  private handleActionSabotage(): void {
    if (this.myRole !== 'SABOTEUR' || this.isModalOpen) return;
    const modalLayer = document.getElementById('modal-layer') || document.getElementById('ui-layer')!;
    this.isModalOpen = true;

    SabotageModal.open(
      uiLayer,
      this.latestSnapshot?.sabotage.timeLeft || 0,
      this.latestSnapshot?.sabotage.active !== null,
      (type) => this.socket.emit(SOCKET_EVENTS.TRIGGER_SABOTAGE, { type }),
      () => { this.isModalOpen = false; }
    );
  }

  private getColorKeyFromHex(hex: string): string {
    const found = Object.values(this.latestSnapshot?.players || {}).find(p => p.colorHex === hex);
    return found ? found.colorKey : 'cyan';
  }
}
