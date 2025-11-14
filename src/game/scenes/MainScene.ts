import Phaser from 'phaser';
import { SCENES } from '@/config/constants';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MAIN });
  }

  preload(): void {
    // Load assets here
  }

  create(): void {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    const welcomeText = this.add.text(centerX, centerY, 'Phaser 3 + TypeScript', {
      fontSize: '32px',
      color: '#ffffff',
    });
    welcomeText.setOrigin(0.5);

    const instructionText = this.add.text(centerX, centerY + 50, 'Ready for development!', {
      fontSize: '16px',
      color: '#aaaaaa',
    });
    instructionText.setOrigin(0.5);
  }

  update(): void {
    // Game loop logic here
  }
}
