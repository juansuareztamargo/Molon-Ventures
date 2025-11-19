import type Phaser from 'phaser';
import { COLORS, CIRCLE_SPACING, POWDER_REWARDS, TARGET_COLORS } from '@/utils/constants';
import type { ProjectileData, TargetData } from './types';

type TargetMissCallback = (target: TargetData) => void;

interface UpdateTargetsConfig {
  currentProjectile?: ProjectileData;
  onTargetMiss: TargetMissCallback;
}

export class TargetManager {
  private targets: TargetData[] = [];
  private rewardDisplays: Map<TargetData, Phaser.GameObjects.Text> = new Map();

  constructor(private scene: Phaser.Scene) {}

  getTargets(): TargetData[] {
    return this.targets;
  }

  resetTargets(): void {
    const existingTargets = [...this.targets];
    existingTargets.forEach((target) => {
      this.removeRewardDisplay(target);
      target.sprite.destroy();
      target.graphic.destroy();
      target.ring.destroy();
    });
    this.targets = [];
    this.rewardDisplays.clear();
  }

  spawnTarget(): TargetData {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const initialRadius = 60;
    const lifetime = 5000;

    const validPosition = this.findValidCirclePosition(width, height, initialRadius);
    const fixedX = validPosition.x;
    const fixedY = validPosition.y;

    const sprite = this.scene.physics.add.sprite(fixedX, fixedY, '');
    sprite.setDisplaySize(0, 0);
    sprite.setVisible(false);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(initialRadius);
    body.setAllowGravity(false);
    body.setImmovable(true);

    const graphic = this.scene.add.circle(fixedX, fixedY, initialRadius, TARGET_COLORS.RED);
    graphic.setStrokeStyle(3, COLORS.WHITE, 0.8);
    graphic.setDepth(10);

    const ring = this.scene.add.circle(fixedX, fixedY, initialRadius + 8, 0x00000000);
    ring.setStrokeStyle(3, TARGET_COLORS.RED, 0.7);
    ring.setDepth(9);

    const targetData: TargetData = {
      sprite,
      graphic,
      ring,
      startTime: this.scene.time.now,
      lifetime,
      initialRadius,
      hit: false,
      missTriggered: false,
      fixedX,
      fixedY,
      baseReward: POWDER_REWARDS.RED,
    };

    this.targets.push(targetData);
    this.spawnRewardDisplay(targetData);

    return targetData;
  }

  updateTargets(config: UpdateTargetsConfig): void {
    const { currentProjectile, onTargetMiss } = config;
    const now = this.scene.time.now;

    this.targets.forEach((targetData) => {
      if (targetData.hit) {
        return;
      }

      const elapsed = now - targetData.startTime;
      const progress = Math.min(elapsed / targetData.lifetime, 1);
      const timeRemaining = 1 - progress;

      const currentRadius = Math.max(targetData.initialRadius * timeRemaining, 10);
      targetData.graphic.setRadius(currentRadius);
      targetData.ring.setRadius(currentRadius + 8);

      const body = targetData.sprite.body as Phaser.Physics.Arcade.Body;
      body.setCircle(currentRadius);

      targetData.graphic.setPosition(targetData.fixedX, targetData.fixedY);
      targetData.ring.setPosition(targetData.fixedX, targetData.fixedY);
      targetData.sprite.setPosition(targetData.fixedX, targetData.fixedY);

      let color: number;
      const colorPhase = timeRemaining;

      if (colorPhase >= 0.75) {
        color = TARGET_COLORS.RED;
      } else if (colorPhase >= 0.5) {
        color = TARGET_COLORS.ORANGE;
      } else if (colorPhase >= 0.25) {
        color = TARGET_COLORS.GREEN;
      } else {
        color = TARGET_COLORS.PURPLE;
      }

      targetData.graphic.setFillStyle(color, 1);
      targetData.ring.setStrokeStyle(3, color, 0.7);

      if (currentProjectile && !currentProjectile.fadingOut) {
        currentProjectile.targetColor = color;
        currentProjectile.ring.setStrokeStyle(3, color, 0.7);
      }

      const alpha = Phaser.Math.Clamp(timeRemaining * 1.5, 0, 1);
      targetData.graphic.setAlpha(alpha);
      targetData.ring.setAlpha(alpha * 0.8);

      if (progress >= 1 && !targetData.missTriggered) {
        targetData.missTriggered = true;
        onTargetMiss(targetData);
      }
    });

    this.targets = this.targets.filter((target) => target.graphic.active);
    this.updateRewardDisplay();
  }

  removeTarget(targetData: TargetData): void {
    this.removeRewardDisplay(targetData);
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    targetData.ring.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }

  createRewardDisplay(circle: TargetData, rewardAmount: number): void {
    this.removeRewardDisplay(circle);

    const rewardDisplay = this.scene.add.text(
      circle.fixedX,
      circle.fixedY,
      `+${rewardAmount}`,
      {
        fontSize: '32px',
        color: '#FFD700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
      }
    ).setOrigin(0.5, 0.5);

    rewardDisplay.setDepth(20);

    this.scene.tweens.add({
      targets: rewardDisplay,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        rewardDisplay.destroy();
      },
    });
  }

  fadeRewardDisplayOnMiss(targetData: TargetData): void {
    const rewardDisplay = this.rewardDisplays.get(targetData);
    if (!rewardDisplay) {
      return;
    }

    this.scene.tweens.add({
      targets: rewardDisplay,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.removeRewardDisplay(targetData);
      },
    });
  }

  private spawnRewardDisplay(circle: TargetData): void {
    const baseReward = circle.baseReward;

    const rewardDisplay = this.scene.add.text(
      circle.fixedX,
      circle.fixedY,
      `+${baseReward}`,
      {
        fontSize: '32px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
      }
    ).setOrigin(0.5, 0.5);

    rewardDisplay.setDepth(15);
    this.rewardDisplays.set(circle, rewardDisplay);

    console.log(`[CIRCLE] Spawned at (${circle.fixedX.toFixed(0)}, ${circle.fixedY.toFixed(0)}) with base reward: +${baseReward} radius: ${circle.initialRadius}`);
  }

  private updateRewardDisplay(): void {
    this.rewardDisplays.forEach((rewardDisplay, circle) => {
      if (!rewardDisplay.active || !circle.graphic.active) {
        this.rewardDisplays.delete(circle);
        rewardDisplay.destroy();
        return;
      }

      const currentColor = circle.graphic.fillColor;
      let baseReward: number;

      if (currentColor === TARGET_COLORS.RED) {
        baseReward = POWDER_REWARDS.RED;
      } else if (currentColor === TARGET_COLORS.ORANGE) {
        baseReward = POWDER_REWARDS.ORANGE;
      } else if (currentColor === TARGET_COLORS.GREEN) {
        baseReward = POWDER_REWARDS.GREEN;
      } else if (currentColor === TARGET_COLORS.PURPLE) {
        baseReward = POWDER_REWARDS.PURPLE;
      } else {
        baseReward = POWDER_REWARDS.RED;
      }

      circle.baseReward = baseReward;
      rewardDisplay.setText(`+${baseReward}`);
      rewardDisplay.setPosition(circle.fixedX, circle.fixedY);
    });
  }

  private removeRewardDisplay(circle: TargetData): void {
    const rewardDisplay = this.rewardDisplays.get(circle);
    if (rewardDisplay) {
      rewardDisplay.destroy();
      this.rewardDisplays.delete(circle);
    }
  }

  private findValidCirclePosition(screenWidth: number, screenHeight: number, radius: number): { x: number; y: number } {
    for (let attempt = 0; attempt < CIRCLE_SPACING.MAX_POSITIONING_ATTEMPTS; attempt++) {
      const x = Phaser.Math.Between(CIRCLE_SPACING.SCREEN_PADDING, screenWidth - CIRCLE_SPACING.SCREEN_PADDING);
      const minY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MIN;
      const maxY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MAX;
      const y = Phaser.Math.Between(minY, maxY);

      if (this.isValidCirclePosition(x, y, radius, CIRCLE_SPACING.MIN_CIRCLE_DISTANCE)) {
        console.log(`[CIRCLE] Valid position found on attempt ${attempt + 1}: (${x}, ${y})`);
        return { x, y };
      }
    }

    const numSlots = this.targets.length + 1;
    const usableWidth = screenWidth - CIRCLE_SPACING.SCREEN_PADDING * 2;
    const slotWidth = usableWidth / numSlots;

    for (let slotIndex = 0; slotIndex < numSlots; slotIndex++) {
      const candidateX = CIRCLE_SPACING.SCREEN_PADDING + slotIndex * slotWidth + slotWidth / 2;
      const candidateY = screenHeight * 0.3;

      if (this.isValidCirclePosition(candidateX, candidateY, radius, CIRCLE_SPACING.MIN_CIRCLE_DISTANCE)) {
        console.log(`[CIRCLE] Fallback slot ${slotIndex + 1}/${numSlots} valid, position: (${candidateX}, ${candidateY})`);
        return { x: candidateX, y: candidateY };
      }
    }

    const centerX = Phaser.Math.Clamp(screenWidth / 2, CIRCLE_SPACING.SCREEN_PADDING, screenWidth - CIRCLE_SPACING.SCREEN_PADDING);
    const centerY = Phaser.Math.Clamp(screenHeight * 0.3, screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MIN, screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MAX);

    console.log('[CIRCLE] FALLBACK FAILED: No valid position found, placing at center');
    return { x: centerX, y: centerY };
  }

  private isValidCirclePosition(x: number, y: number, radius: number, minDistance: number): boolean {
    const screenHeight = this.scene.scale.height;
    const minY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MIN;
    const maxY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MAX;

    if (y - radius < minY || y + radius > maxY) {
      return false;
    }

    for (const target of this.targets) {
      const dx = x - target.fixedX;
      const dy = y - target.fixedY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const requiredDistance = minDistance + radius + target.initialRadius;

      if (distance < requiredDistance) {
        return false;
      }
    }

    return true;
  }
}
