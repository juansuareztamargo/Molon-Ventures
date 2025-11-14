import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    loadingText.setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2, 320, 40);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4a90e2, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 10, 300 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Placeholder: In a real game, you would load assets here
    // For now, we'll just simulate a brief loading period
    // this.load.image('logo', 'assets/logo.png');
    // this.load.audio('bgMusic', 'assets/music.mp3');
  }

  create(): void {
    // Once loading is complete, transition to the main menu
    this.scene.start(SCENES.MAIN_MENU);
  }
}
