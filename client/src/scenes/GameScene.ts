import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import {
  CORRIDORS,
  EMERGENCY_TABLE,
  MAP_HEIGHT,
  MAP_WIDTH,
  POWER_UPS,
  ROOMS,
  SOCKET_EVENTS,
  SPEED,
  STATION_CONSOLES,
  VISION_RADIUS
} from '@shared/constants';
import { Facing, GameStateSnapshot, PlayerPublic } from '@shared/types';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';
import { HudOverlay } from '../ui/HudOverlay.js';

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  aura: Phaser.GameObjects.Image;
  ice: Phaser.GameObjects.Image;
  thawRing: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
}

// Distance at which a nearby hunter starts frosting the runner's screen
const DANGER_RADIUS = 260;

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private myPlayerId!: string;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private playerVisuals: Map<string, PlayerVisual> = new Map();
  private powerUpSprites: Map<string, Phaser.GameObjects.Image> = new Map();

  private localX: number = EMERGENCY_TABLE.x;
  private localY: number = EMERGENCY_TABLE.y;
  private localFacing: Facing = 'down';
  private localIsMoving: boolean = false;

  private latestSnapshot: GameStateSnapshot | null = null;
  private hudOverlay!: HudOverlay;
  private wasReleased: boolean = false;

  // Fog of war
  private fogMaskGraphics!: Phaser.GameObjects.Graphics;
  private darknessLayer!: Phaser.GameObjects.RenderTexture;

  // Frost creeps over the screen when frozen or when a hunter is close
  private frostVignette!: Phaser.GameObjects.Image;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { snapshot: GameStateSnapshot; myPlayerId: string }): void {
    this.latestSnapshot = data.snapshot;
    this.myPlayerId = data.myPlayerId;
    this.playerVisuals = new Map();
    this.powerUpSprites = new Map();
    this.wasReleased = false;
    const me = data.snapshot.players[data.myPlayerId];
    if (me) {
      this.localX = me.x;
      this.localY = me.y;
    }
  }

  create(): void {
    this.socket = this.registry.get('socket');
    const uiLayer = document.getElementById('ui-layer')!;
    uiLayer.innerHTML = '';

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    }) as typeof this.wasdKeys;

    this.renderStationMap();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.centerOn(this.localX, this.localY);

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

    // Drifting snow, pinned to the screen so it falls wherever the camera is
    const snow = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: this.scale.width },
      y: -10,
      lifespan: 9000,
      speedY: { min: 20, max: 55 },
      speedX: { min: -15, max: 15 },
      scale: { min: 0.4, max: 1.2 },
      alpha: { start: 0.7, end: 0 },
      frequency: 90
    });
    snow.setScrollFactor(0);
    snow.setDepth(45);

    this.frostVignette = this.add.image(0, 0, 'frost_vignette');
    this.frostVignette.setScrollFactor(0);
    this.frostVignette.setDisplaySize(this.scale.width, this.scale.height);
    this.frostVignette.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.frostVignette.setDepth(60);
    this.frostVignette.setAlpha(0);

    this.hudOverlay = new HudOverlay(uiLayer);

    this.setupSocketListeners();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.frostVignette.setDisplaySize(gameSize.width, gameSize.height);
      this.frostVignette.setPosition(gameSize.width / 2, gameSize.height / 2);
    });

    // Announce role
    const me = this.latestSnapshot?.players[this.myPlayerId];
    SoundSynthesizer.playAlarm();
    if (me?.role === 'HUNTER') {
      this.hudOverlay.showBanner('YOU ARE THE HUNTER', '#f87171', 2500);
    } else {
      this.hudOverlay.showBanner('RUN!', '#7dd3fc', 2000);
    }
  }

  private setupSocketListeners(): void {
    this.socket.off(SOCKET_EVENTS.GAME_STATE_UPDATE);
    this.socket.off(SOCKET_EVENTS.PLAYER_FROZEN);
    this.socket.off(SOCKET_EVENTS.PLAYER_THAWED);
    this.socket.off(SOCKET_EVENTS.POWER_UP_TAKEN);

    this.socket.on(SOCKET_EVENTS.GAME_STATE_UPDATE, (snapshot: GameStateSnapshot) => {
      this.latestSnapshot = snapshot;

      if (snapshot.phase === 'ENDED') {
        document.getElementById('ui-layer')!.innerHTML = '';
        this.scene.start('EndScene', { snapshot, myPlayerId: this.myPlayerId });
        return;
      }

      if (!this.wasReleased && snapshot.hunterReleaseIn <= 0) {
        this.wasReleased = true;
        SoundSynthesizer.playAlarm();
        this.hudOverlay.showBanner('HUNTERS RELEASED', '#f87171');
      }

      this.reconcileLocalPlayer(snapshot);
    });

    this.socket.on(SOCKET_EVENTS.PLAYER_FROZEN, ({ hunterId, runnerId }) => {
      SoundSynthesizer.playKill();
      if (runnerId === this.myPlayerId) {
        this.cameras.main.shake(300, 0.012);
        this.cameras.main.flash(250, 186, 230, 253);
        this.hudOverlay.showBanner('FROZEN!', '#7dd3fc');
      } else if (hunterId === this.myPlayerId) {
        this.hudOverlay.showBanner('TAGGED!', '#f87171', 900);
      }
      this.burstAt(runnerId, 0xbae6fd);
    });

    this.socket.on(SOCKET_EVENTS.PLAYER_THAWED, ({ runnerId, rescuerIds }) => {
      SoundSynthesizer.playTaskComplete();
      if (runnerId === this.myPlayerId) {
        this.hudOverlay.showBanner('THAWED!', '#4ade80');
      } else if ((rescuerIds as string[]).includes(this.myPlayerId)) {
        this.hudOverlay.showBanner('RESCUE!', '#4ade80', 900);
      }
      this.burstAt(runnerId, 0x4ade80);
    });

    this.socket.on(SOCKET_EVENTS.POWER_UP_TAKEN, ({ playerId, type }) => {
      this.burstAt(playerId, type === 'boost' ? 0xfb923c : 0xfacc15);
      if (playerId === this.myPlayerId) {
        SoundSynthesizer.playTaskComplete();
        if (type === 'boost') {
          this.hudOverlay.showBanner('HEAT BOOST!', '#fb923c', 900);
        } else {
          this.hudOverlay.showBanner('SHIELD UP!', '#facc15', 900);
        }
      }
    });
  }

  private syncPowerUps(): void {
    const powerUps = this.latestSnapshot?.powerUps ?? [];
    const liveIds = new Set(powerUps.map(p => p.id));
    for (const [id, sprite] of this.powerUpSprites.entries()) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.powerUpSprites.delete(id);
      }
    }
    for (const powerUp of powerUps) {
      if (this.powerUpSprites.has(powerUp.id)) continue;
      const sprite = this.add.image(powerUp.x, powerUp.y, `power_${powerUp.type}`);
      sprite.setDepth(15);
      this.tweens.add({
        targets: sprite,
        y: powerUp.y - 6,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.powerUpSprites.set(powerUp.id, sprite);
    }
  }

  private burstAt(playerId: string, tint: number): void {
    const p = this.latestSnapshot?.players[playerId];
    if (!p) return;
    const burst = this.add.particles(p.x, p.y, 'snowflake', {
      speed: { min: 80, max: 220 },
      lifespan: 600,
      scale: { start: 1.6, end: 0 },
      tint,
      quantity: 24,
      emitting: false
    });
    burst.setDepth(25);
    burst.explode(24);
    this.time.delayedCall(800, () => burst.destroy());
  }

  private renderStationMap(): void {
    for (const c of CORRIDORS) {
      for (let x = c.x; x < c.x + c.width; x += 64) {
        for (let y = c.y; y < c.y + c.height; y += 64) {
          this.add.image(x + 32, y + 32, 'tile_corridor').setDepth(1);
        }
      }
    }

    for (const r of ROOMS) {
      for (let x = r.x; x < r.x + r.width; x += 64) {
        for (let y = r.y; y < r.y + r.height; y += 64) {
          this.add.image(x + 32, y + 32, 'tile_floor').setDepth(2);
        }
      }

      // Ambient ceiling light pooled in the middle of each room
      const roomLight = this.add.image(r.x + r.width / 2, r.y + r.height / 2, 'soft_glow');
      roomLight.setDisplaySize(r.width * 0.9, r.height * 0.9);
      roomLight.setTint(0x7dd3fc);
      roomLight.setAlpha(0.18);
      roomLight.setBlendMode(Phaser.BlendModes.ADD);
      roomLight.setDepth(3);

      // Walls: wide faint stroke for the glow, then a crisp core line
      const wallG = this.add.graphics();
      wallG.setDepth(5);
      wallG.lineStyle(16, 0x38bdf8, 0.12);
      wallG.strokeRect(r.x, r.y, r.width, r.height);
      wallG.lineStyle(8, 0x0b1220, 1);
      wallG.strokeRect(r.x, r.y, r.width, r.height);
      wallG.lineStyle(3, 0x7dd3fc, 0.95);
      wallG.strokeRect(r.x, r.y, r.width, r.height);

      const label = this.add.text(r.x + 16, r.y + 14, r.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#38bdf8'
      });
      label.setDepth(6);
    }

    this.add.image(EMERGENCY_TABLE.x, EMERGENCY_TABLE.y, 'table_emergency').setDepth(10);

    // Decorative consoles with a gentle pulse
    for (const sc of STATION_CONSOLES) {
      const glow = this.add.image(sc.x, sc.y, 'soft_glow');
      glow.setDisplaySize(90, 90);
      glow.setTint(0x38bdf8);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(9);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.25, to: 0.7 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1400
      });
      this.add.image(sc.x, sc.y, 'console_task').setDepth(10);
    }
  }

  update(time: number, delta: number): void {
    if (!this.latestSnapshot) return;

    this.handlePlayerInput(delta);
    this.syncPowerUps();
    this.updatePlayerVisuals(delta);
    this.updateFogOfWar();
    this.updateFrostEffect(delta);
    this.hudOverlay.update(this.latestSnapshot, this.myPlayerId, { x: this.localX, y: this.localY });
    this.cameras.main.centerOn(this.localX, this.localY);
  }

  private canMove(me: PlayerPublic): boolean {
    if (this.latestSnapshot?.phase !== 'PLAYING' || me.status !== 'ALIVE') return false;
    return me.role === 'RUNNER' || this.latestSnapshot.hunterReleaseIn <= 0;
  }

  private handlePlayerInput(delta: number): void {
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (!me || !this.canMove(me)) {
      this.localIsMoving = false;
      return;
    }

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) dy += 1;

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const len = Math.hypot(dx, dy);
      const speed = SPEED[me.role] * (me.boostFor > 0 ? POWER_UPS.BOOST_MULTIPLIER : 1);
      const step = (speed * delta) / 1000;

      this.localX = Math.max(30, Math.min(MAP_WIDTH - 30, this.localX + (dx / len) * step));
      this.localY = Math.max(30, Math.min(MAP_HEIGHT - 30, this.localY + (dy / len) * step));

      if (Math.abs(dx) > Math.abs(dy)) {
        this.localFacing = dx < 0 ? 'left' : 'right';
      } else {
        this.localFacing = dy < 0 ? 'up' : 'down';
      }

      this.localIsMoving = true;
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
  }

  private reconcileLocalPlayer(snapshot: GameStateSnapshot): void {
    const me = snapshot.players[this.myPlayerId];
    if (!me) return;
    // Snap to server when frozen or when we drifted (e.g. walked into a wall)
    const drift = Math.hypot(this.localX - me.x, this.localY - me.y);
    if (me.status !== 'ALIVE' || drift > 65) {
      this.localX = me.x;
      this.localY = me.y;
    }
  }

  private createPlayerVisual(p: PlayerPublic): PlayerVisual {
    const container = this.add.container(p.x, p.y);
    container.setDepth(20);

    const aura = this.add.image(0, 0, 'soft_glow');
    aura.setDisplaySize(110, 110);
    aura.setTint(0xef4444);
    aura.setBlendMode(Phaser.BlendModes.ADD);

    const shadow = this.add.ellipse(0, 22, 30, 8, 0x000000, 0.4);
    const sprite = this.add.sprite(0, 0, `player_${p.colorKey}`);
    const ice = this.add.image(0, 2, 'ice_block');
    const thawRing = this.add.graphics();

    const nameText = this.add.text(0, -36, p.name, {
      fontFamily: '"Exo 2", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    nameText.setOrigin(0.5);

    container.add([aura, shadow, sprite, ice, thawRing, nameText]);
    return { container, sprite, aura, ice, thawRing, nameText, targetX: p.x, targetY: p.y };
  }

  private updatePlayerVisuals(delta: number): void {
    if (!this.latestSnapshot) return;

    const players = this.latestSnapshot.players;
    for (const [id, visual] of this.playerVisuals.entries()) {
      if (!players[id] || players[id].status === 'DISCONNECTED') {
        visual.container.destroy();
        this.playerVisuals.delete(id);
      }
    }

    for (const [id, p] of Object.entries(players)) {
      if (p.status === 'DISCONNECTED') continue;

      let visual = this.playerVisuals.get(id);
      if (!visual) {
        visual = this.createPlayerVisual(p);
        this.playerVisuals.set(id, visual);
      }

      visual.targetX = p.x;
      visual.targetY = p.y;

      const isHunter = p.role === 'HUNTER';
      const frozen = p.status === 'FROZEN';

      visual.aura.setVisible(isHunter);
      if (isHunter) visual.aura.setAlpha(0.45 + Math.sin(this.time.now * 0.006) * 0.15);
      visual.nameText.setColor(isHunter ? '#f87171' : '#ffffff');

      visual.ice.setVisible(frozen);
      visual.sprite.setTint(frozen ? 0x9bd8ff : 0xffffff);
      // Blink while immune right after being thawed
      visual.sprite.setAlpha(p.immuneFor > 0 ? 0.5 + Math.sin(this.time.now * 0.03) * 0.4 : 1);

      visual.thawRing.clear();
      if (frozen && p.thawProgress > 0) {
        visual.thawRing.lineStyle(4, 0x4ade80, 1);
        visual.thawRing.beginPath();
        visual.thawRing.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + p.thawProgress * Math.PI * 2);
        visual.thawRing.strokePath();
      }

      let moving = p.isMoving;
      if (id !== this.myPlayerId) {
        const lerpFactor = Math.min(1, (12 * delta) / 1000);
        visual.container.x += (visual.targetX - visual.container.x) * lerpFactor;
        visual.container.y += (visual.targetY - visual.container.y) * lerpFactor;
        if (p.facing === 'left') visual.sprite.setFlipX(true);
        else if (p.facing === 'right') visual.sprite.setFlipX(false);
      } else {
        visual.container.x = this.localX;
        visual.container.y = this.localY;
        visual.sprite.setFlipX(this.localFacing === 'left');
        moving = this.localIsMoving;
      }

      visual.sprite.y = moving && !frozen ? Math.sin(this.time.now * 0.015) * 3 : 0;
    }
  }

  private updateFogOfWar(): void {
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (!me) return;

    const frozen = me.status === 'FROZEN';
    const radius = frozen ? VISION_RADIUS.FROZEN : VISION_RADIUS[me.role];

    this.darknessLayer.clear();
    this.fogMaskGraphics.clear();
    this.darknessLayer.fill(0x030712, frozen ? 0.5 : 0.92);
    this.fogMaskGraphics.fillStyle(0xffffff, 1);
    this.fogMaskGraphics.fillCircle(this.localX, this.localY, radius);
    this.darknessLayer.erase(this.fogMaskGraphics, 0, 0);
  }

  private updateFrostEffect(delta: number): void {
    const me = this.latestSnapshot?.players[this.myPlayerId];
    if (!me) return;

    let target = 0;
    if (me.status === 'FROZEN') {
      target = 0.8;
    } else if (me.role === 'RUNNER') {
      // Screen frosts over as the nearest hunter closes in
      let nearest = Infinity;
      for (const p of Object.values(this.latestSnapshot!.players)) {
        if (p.role === 'HUNTER' && p.status === 'ALIVE') {
          nearest = Math.min(nearest, Math.hypot(p.x - this.localX, p.y - this.localY));
        }
      }
      if (nearest < DANGER_RADIUS) {
        const danger = 1 - nearest / DANGER_RADIUS;
        target = danger * 0.7 + Math.sin(this.time.now * 0.012) * 0.08 * danger;
      }
    }

    const current = this.frostVignette.alpha;
    const lerp = Math.min(1, (4 * delta) / 1000);
    this.frostVignette.setAlpha(current + (target - current) * lerp);
  }
}
