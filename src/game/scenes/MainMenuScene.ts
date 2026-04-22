import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS } from '@/utils/constants';
import { createButton, createTextStyle } from '@/utils/helpers';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MAIN_MENU });
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Version Text
    this.add.text(width - 10, height - 10, 'v1.0.0', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: "'Orbitron', sans-serif"
    }).setOrigin(1, 1).setDepth(100);

    // Background gradient effect using rectangles
    const gradientSteps = 20;
    for (let i = 0; i < gradientSteps; i++) {
      const alpha = 0.3 - (i / gradientSteps) * 0.3;
      this.add.rectangle(
        width / 2,
        (height / gradientSteps) * i,
        width,
        height / gradientSteps,
        COLORS.PRIMARY,
        alpha
      );
    }

    // Title
    const title = this.add.text(
      width / 2,
      height * 0.25,
      'SLINGSHOT',
      createTextStyle('72px', '#ffffff')
    );
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(
      width / 2,
      height * 0.35,
      'Physics Demo Game',
      createTextStyle('28px', '#ffffff')
    );
    subtitle.setOrigin(0.5);

    // Instructions
    const instructions = this.add.text(
      width / 2,
      height * 0.55,
      'Drag and release to launch projectiles\nHit all targets to win!',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    instructions.setOrigin(0.5);
    instructions.setLineSpacing(10);

    // Start button
    createButton(
      this,
      width / 2,
      height * 0.7,
      'START GAME',
      () => {
        this.scene.start(SCENES.SLINGSHOT);
      },
      250,
      70
    );

    // Add some decorative elements
    this.createDecorativeElements(width, height);

    // Add pulsing animation to title
    this.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.05 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createDecorativeElements(width: number, height: number): void {
    // Create some floating circles as decoration
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(50, width - 50);
      const y = Phaser.Math.Between(50, height - 50);
      const radius = Phaser.Math.Between(10, 30);
      const circle = this.add.circle(x, y, radius, COLORS.WHITE, 0.1);

      // Add floating animation
      this.tweens.add({
        targets: circle,
        y: y + Phaser.Math.Between(-20, 20),
        duration: Phaser.Math.Between(2000, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.tweens.add({
        targets: circle,
        alpha: { from: 0.1, to: 0.3 },
        duration: Phaser.Math.Between(1000, 2000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
