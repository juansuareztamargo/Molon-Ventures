import Phaser from 'phaser';

export const GAME_CONFIG = {
  canvas: {
    width: 1024,
    height: 768,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 300 },
      debug: false,
    },
  },
  backgroundColor: '#87CEEB',
  scaling: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
} as const;

export const SCENES = {
  BOOT: 'BootScene',
  MAIN_MENU: 'MainMenuScene',
  SLINGSHOT: 'SlingshotScene',
} as const;
