import Phaser from 'phaser';

export function createTextStyle(
  fontSize: string,
  color: string = '#ffffff',
  fontFamily: string = "'Orbitron', sans-serif"
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontSize,
    color,
    fontFamily,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  };
}

export function centerText(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text
): void {
  text.setOrigin(0.5);
  text.setPosition(scene.scale.width / 2, scene.scale.height / 2);
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  callback: () => void,
  width: number = 200,
  height: number = 60
): Phaser.GameObjects.Container {
  const button = scene.add.rectangle(x, y, width, height, 0x4a90e2);
  button.setStrokeStyle(3, 0xffffff);
  button.setInteractive({ useHandCursor: true });

  const buttonText = scene.add.text(x, y, text, {
    fontSize: '24px',
    color: '#ffffff',
    fontFamily: "'Orbitron', sans-serif",
    fontStyle: 'bold',
  });
  buttonText.setOrigin(0.5);

  button.on('pointerover', () => {
    button.setFillStyle(0x6aa8f0);
  });

  button.on('pointerout', () => {
    button.setFillStyle(0x4a90e2);
  });

  button.on('pointerdown', () => {
    button.setFillStyle(0x3a7ec2);
  });

  button.on('pointerup', () => {
    button.setFillStyle(0x6aa8f0);
    callback();
  });

  const container = scene.add.container(0, 0, [button, buttonText]);
  return container;
}

export function distanceBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
