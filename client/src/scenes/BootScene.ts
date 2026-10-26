import Phaser from 'phaser';
import { ProceduralGraphics } from '../assets/ProceduralGraphics.js';
import { SoundSynthesizer } from '../assets/SoundSynthesizer.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Generate all procedural canvas textures
    ProceduralGraphics.generateAll(this);

    // Initialize Web Audio on first user interaction
    const unlockAudio = () => {
      SoundSynthesizer.init();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    this.scene.start('LobbyScene');
  }
}
