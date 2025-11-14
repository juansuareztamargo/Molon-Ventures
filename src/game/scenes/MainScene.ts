import { Scene } from 'phaser';

export class MainScene extends Scene {
  private text?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // Load assets here
    console.log('MainScene: Preloading assets');
  }

  create(): void {
    // Create game objects here
    this.text = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'Phaser 3 + TypeScript + Vite',
      {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 20, y: 10 },
      }
    );

    this.text.setOrigin(0.5);
    this.text.setInteractive();

    this.text.on('pointerdown', () => {
      this.text!.setText('Clicked! Phaser is working!');
      this.text!.setColor('#00ff00');
    });

    // Add some visual feedback
    this.add
      .rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 100,
        200,
        50,
        0x3498db
      )
      .setOrigin(0.5);

    console.log('MainScene: Created');
  }

  update(_time: number, _delta: number): void {
    // Update game logic here
  }
}
