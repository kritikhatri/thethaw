import Phaser from 'phaser';
import { COLORS } from '@shared/constants';

export class ProceduralGraphics {
  public static generateAll(scene: Phaser.Scene): void {
    this.createStationTiles(scene);
    this.createCharacterSprites(scene);
    this.createConsoles(scene);
    this.createEmergencyTable(scene);
    this.createFrostOverlayTexture(scene);
    this.createAtmosphereTextures(scene);
  }

  /**
   * Snowflake particle and soft glow used for ambient effects
   */
  private static createAtmosphereTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('snowflake')) {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 8);
      scene.textures.addCanvas('snowflake', canvas);
    }

    if (!scene.textures.exists('soft_glow')) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      scene.textures.addCanvas('soft_glow', canvas);
    }
  }

  /**
   * Floor, wall, and corridor procedural tiles
   */
  private static createStationTiles(scene: Phaser.Scene): void {
    // 1. Metal Floor Tile (64x64)
    if (!scene.textures.exists('tile_floor')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      // Dark metallic base with soft diagonal sheen
      const floorGrad = ctx.createLinearGradient(0, 0, 64, 64);
      floorGrad.addColorStop(0, '#243247');
      floorGrad.addColorStop(1, '#1a2536');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 0, 64, 64);

      // Plate borders: light top-left edge, dark bottom-right edge for bevel
      ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 64);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
      ctx.fillRect(0, 63, 64, 1);
      ctx.fillRect(63, 0, 1, 64);

      // Center seam splitting the tile into four plates
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.fillRect(31, 0, 1, 64);
      ctx.fillRect(0, 31, 64, 1);

      // Rivets in corners
      ctx.fillStyle = '#475569';
      const rivets = [[6, 6], [58, 6], [6, 58], [58, 58]];
      rivets.forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtle frost speckles
      ctx.fillStyle = 'rgba(224, 242, 254, 0.15)';
      ctx.fillRect(14, 18, 6, 2);
      ctx.fillRect(40, 42, 4, 3);
      ctx.fillRect(28, 32, 3, 2);

      scene.textures.addCanvas('tile_floor', canvas);
    }

    // 2. Wall Bulkhead Tile (64x64)
    if (!scene.textures.exists('tile_wall')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      // Outer heavy metal
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 64, 64);

      // Reinforced bevel
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 4, 56, 56);

      // Icy structural rib
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(10, 8, 44, 48);

      // Ice crystal edge
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 64);
      ctx.lineTo(64, 64);
      ctx.stroke();

      scene.textures.addCanvas('tile_wall', canvas);
    }

    // 3. Corridor Tile (64x64)
    if (!scene.textures.exists('tile_corridor')) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#182030';
      ctx.fillRect(0, 0, 64, 64);

      // Grid line
      ctx.strokeStyle = '#27354a';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 64, 64);

      // Hazard striping along middle
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(24, 0, 16, 64);

      scene.textures.addCanvas('tile_corridor', canvas);
    }
  }

  /**
   * Procedural astronaut characters and the frozen ice block
   */
  private static createCharacterSprites(scene: Phaser.Scene): void {
    COLORS.forEach(c => {
      // 1. Alive Scientist Sprite (48x48)
      const key = `player_${c.key}`;
      if (!scene.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#020617';
        ctx.lineJoin = 'round';

        // Backpack (Oxygen/Thermal Tank) on left side
        ctx.fillStyle = c.darkHex;
        ctx.beginPath();
        ctx.roundRect(3, 16, 10, 19, 4);
        ctx.fill();
        ctx.stroke();

        // Boots (drawn before body so the body overlaps them)
        ctx.beginPath();
        ctx.roundRect(13, 34, 9, 11, 4);
        ctx.roundRect(26, 34, 9, 11, 4);
        ctx.fill();
        ctx.stroke();

        // Suit body with rounded-capsule shape and vertical shading
        const bodyGrad = ctx.createLinearGradient(10, 6, 38, 40);
        bodyGrad.addColorStop(0, c.hex);
        bodyGrad.addColorStop(1, c.darkHex);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(9, 6, 30, 34, [15, 15, 8, 8]);
        ctx.fill();
        ctx.stroke();

        // Rim highlight on the body
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(22, 20, 10, Math.PI * 1.1, Math.PI * 1.45);
        ctx.stroke();

        // Helmet visor (frosted glass)
        const visorGrad = ctx.createLinearGradient(22, 11, 40, 25);
        visorGrad.addColorStop(0, '#bae6fd');
        visorGrad.addColorStop(0.5, '#38bdf8');
        visorGrad.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = visorGrad;
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(21, 11, 19, 13, 6);
        ctx.fill();
        ctx.stroke();

        // Visor reflection streak
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(32, 14.5, 5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        scene.textures.addCanvas(key, canvas);
      }

    });

    // Translucent ice block that encases frozen players
    if (!scene.textures.exists('ice_block')) {
      const canvas = document.createElement('canvas');
      canvas.width = 56;
      canvas.height = 60;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createLinearGradient(0, 0, 56, 60);
      grad.addColorStop(0, 'rgba(224, 242, 254, 0.75)');
      grad.addColorStop(0.5, 'rgba(125, 211, 252, 0.45)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0.6)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(3, 3, 50, 54, 8);
      ctx.fill();
      ctx.stroke();

      // Glints and cracks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, 14);
      ctx.lineTo(20, 8);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(38, 10);
      ctx.lineTo(32, 26);
      ctx.lineTo(42, 34);
      ctx.moveTo(14, 44);
      ctx.lineTo(24, 38);
      ctx.stroke();

      scene.textures.addCanvas('ice_block', canvas);
    }
  }

  /**
   * Station consoles
   */
  private static createConsoles(scene: Phaser.Scene): void {
    // 1. Task Console (48x48)
    if (!scene.textures.exists('console_task')) {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d')!;

      // Screen glow halo
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;

      // Stand
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(8, 16, 32, 28, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Angled monitor
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(10, 8, 28, 20, 3);
      ctx.fill();

      // Glowing screen
      const screenGrad = ctx.createLinearGradient(12, 10, 12, 26);
      screenGrad.addColorStop(0, '#0ea5e9');
      screenGrad.addColorStop(1, '#075985');
      ctx.fillStyle = screenGrad;
      ctx.fillRect(12, 10, 24, 16);

      // Animated screen line
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(14, 14, 12, 2);
      ctx.fillRect(14, 19, 18, 2);

      // Yellow indicator LED
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(32, 34, 3, 0, Math.PI * 2);
      ctx.fill();

      scene.textures.addCanvas('console_task', canvas);
    }

  }

  /**
   * Emergency Meeting Table (130x130)
   */
  private static createEmergencyTable(scene: Phaser.Scene): void {
    if (!scene.textures.exists('table_emergency')) {
      const canvas = document.createElement('canvas');
      canvas.width = 130;
      canvas.height = 130;
      const ctx = canvas.getContext('2d')!;

      // Outer table border
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(65, 65, 62, 0, Math.PI * 2);
      ctx.fill();

      // Metallic rim
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Table inner surface
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(65, 65, 52, 0, Math.PI * 2);
      ctx.fill();

      // Hazard striped ring
      ctx.strokeStyle = '#ca8a04';
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(65, 65, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central Emergency Button base
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.arc(65, 65, 22, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Red Button
      const grad = ctx.createRadialGradient(65, 65, 2, 65, 65, 18);
      grad.addColorStop(0, '#f87171');
      grad.addColorStop(0.7, '#dc2626');
      grad.addColorStop(1, '#991b1b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(65, 65, 18, 0, Math.PI * 2);
      ctx.fill();

      scene.textures.addCanvas('table_emergency', canvas);
    }
  }

  /**
   * Screen frost vignette shown when frozen or a hunter is near
   */
  private static createFrostOverlayTexture(scene: Phaser.Scene): void {
    if (!scene.textures.exists('frost_vignette')) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createRadialGradient(256, 256, 120, 256, 256, 256);
      grad.addColorStop(0, 'rgba(186, 230, 253, 0)');
      grad.addColorStop(0.7, 'rgba(125, 211, 252, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.7)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Draw jagged ice spires along corners
      ctx.fillStyle = 'rgba(240, 249, 255, 0.8)';
      const drawSpike = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
      };

      // Top-left spikes
      drawSpike(0, 0, 60, 0, 0, 70);
      drawSpike(0, 40, 80, 10, 10, 80);
      // Top-right spikes
      drawSpike(512, 0, 452, 0, 512, 70);
      drawSpike(512, 40, 432, 10, 502, 80);
      // Bottom-left spikes
      drawSpike(0, 512, 60, 512, 0, 442);
      // Bottom-right spikes
      drawSpike(512, 512, 452, 512, 512, 442);

      scene.textures.addCanvas('frost_vignette', canvas);
    }
  }
}
