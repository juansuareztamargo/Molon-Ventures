import Phaser from 'phaser';
import { BootScene } from '@/game/scenes/BootScene';
import { MainMenuScene } from '@/game/scenes/MainMenuScene';
import { SlingshotScene } from '@/game/scenes/SlingshotScene';
import { MainScene } from '@/game/scenes/MainScene';

export const SCENES = {
  BOOT: 'BootScene',
  MAIN_MENU: 'MainMenuScene',
  SLINGSHOT: 'SlingshotScene',
  MAIN: 'MainScene',
} as const;

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
  backgroundColor: '#0a0a0a',
  scaling: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
} as const;

export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.canvas.width,
  height: GAME_CONFIG.canvas.height,
  parent: 'game-container',
  backgroundColor: GAME_CONFIG.backgroundColor,
  scene: [BootScene, MainMenuScene, SlingshotScene, MainScene],
  physics: GAME_CONFIG.physics,
  scale: GAME_CONFIG.scaling,
};