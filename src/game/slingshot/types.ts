import type Phaser from 'phaser';

export interface TargetData {
  sprite: Phaser.Physics.Arcade.Sprite;
  graphic: Phaser.GameObjects.Arc;
  startTime: number;
  lifetime: number;
  initialRadius: number;
  hit: boolean;
  missTriggered: boolean;
  ring: Phaser.GameObjects.Arc;
  fixedX: number;
  fixedY: number;
  baseReward: number;
}

export interface JoypadUI {
  container: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  powerLine: Phaser.GameObjects.Graphics;
  trajectoryLine: Phaser.GameObjects.Graphics;
  centerX: number;
  centerY: number;
  offsetX: number;
  offsetY: number;
}

export interface ProjectileData {
  sprite: Phaser.Physics.Arcade.Sprite;
  ring: Phaser.GameObjects.Arc;
  targetColor: number;
  fadingOut: boolean;
  hasCollided: boolean;
  shouldDestroy: boolean;
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
}
