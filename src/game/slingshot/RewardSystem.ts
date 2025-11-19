import type Phaser from 'phaser';
import { PowderHud } from './PowderHud';

export class RewardSystem {
  private consecutivePerfects = 0;
  private bonusStageActive = false;
  private consecutiveHits = 0;
  private streakMultiplier = 1;

  private streakCounterText?: Phaser.GameObjects.Text;
  private streakMultiplierText?: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private powderHud: PowderHud) {}

  attachStreakTexts(counter: Phaser.GameObjects.Text, multiplier: Phaser.GameObjects.Text): void {
    this.streakCounterText = counter;
    this.streakMultiplierText = multiplier;
    this.updateStreakText();
    this.refreshMultiplierDisplay();
  }

  resetAll(): void {
    this.consecutivePerfects = 0;
    this.bonusStageActive = false;
    this.consecutiveHits = 0;
    this.streakMultiplier = 1;

    this.powderHud.stopBonusModeVisual();
    this.updateStreakText();
    this.refreshMultiplierDisplay();
  }

  resetStreakOnly(): void {
    this.consecutiveHits = 0;
    this.streakMultiplier = 1;
    this.updateStreakText();
    this.refreshMultiplierDisplay();
  }

  processReward(baseReward: number, isPerfect: boolean): number {
    let reward = baseReward;

    if (isPerfect) {
      this.consecutivePerfects++;

      if (this.consecutivePerfects === 3) {
        this.bonusStageActive = true;
        this.powderHud.startBonusModeVisual();
        this.showStatusIndicator('BONUS STAGE ACTIVATED!', '#00ff00', 'BONUS STAGE');
      }

      if (this.bonusStageActive && this.consecutivePerfects > 3) {
        const bonus = this.consecutivePerfects - 3;
        reward += bonus;
        this.showStatusIndicator(`+${bonus} BONUS`, '#00ff00', 'BONUS');
      }
    } else {
      if (this.bonusStageActive) {
        this.powderHud.stopBonusModeVisual();
        this.showStatusIndicator('BONUS STAGE LOST', '#ff0000', 'BONUS LOST');
      }
      this.bonusStageActive = false;
      this.consecutivePerfects = 0;
    }

    this.consecutiveHits++;
    this.updateStreakMultiplier();
    reward *= this.streakMultiplier;

    this.updateStreakText();
    this.applyStreakIncrementCue();

    return reward;
  }

  handleMiss(): void {
    if (this.streakMultiplier > 1) {
      this.showStatusIndicator('STREAK LOST', '#ff6600', 'MULTIPLIER RESET');
    }

    this.streakMultiplier = 1;
    this.consecutiveHits = 0;

    if (this.bonusStageActive) {
      this.powderHud.stopBonusModeVisual();
      this.showStatusIndicator('BONUS STAGE LOST', '#ff0000', 'BONUS LOST');
    }

    this.bonusStageActive = false;
    this.consecutivePerfects = 0;

    this.updateStreakText();
    this.refreshMultiplierDisplay();
    this.resetStreakDisplay();
  }

  refreshMultiplierDisplay(): void {
    if (!this.streakMultiplierText) {
      return;
    }

    if (this.streakMultiplier > 1) {
      this.streakMultiplierText.setVisible(true);
      this.streakMultiplierText.setText(`x${this.streakMultiplier}`);
      console.log(`[MULTIPLIER] Showing multiplier: x${this.streakMultiplier} (visible: true, text set)`);
    } else {
      this.streakMultiplierText.setVisible(false);
      this.streakMultiplierText.setText('');
      this.streakMultiplierText.setScale(1.0);
      this.streakMultiplierText.setColor('#ffaa00');
      console.log('[MULTIPLIER] Hiding base multiplier (visible: false, text cleared, scale/color reset)');
    }
  }

  private updateStreakText(): void {
    if (this.streakCounterText) {
      this.streakCounterText.setText(`Streak: ${this.consecutiveHits}`);
    }
  }

  private updateStreakMultiplier(): void {
    if (this.consecutiveHits === 5) {
      this.streakMultiplier = 2;
      this.showStatusIndicator('2x MULTIPLIER', '#ffff00', 'STREAK');
      this.applyMultiplierUpgradeCue();
    } else if (this.consecutiveHits === 10) {
      this.streakMultiplier = 3;
      this.showStatusIndicator('3x MULTIPLIER', '#ffff00', 'STREAK');
      this.applyMultiplierUpgradeCue();
    } else if (this.consecutiveHits === 25) {
      this.streakMultiplier = 4;
      this.showStatusIndicator('4x MULTIPLIER', '#ffff00', 'STREAK');
      this.applyMultiplierUpgradeCue();
    } else if (this.consecutiveHits === 50) {
      this.streakMultiplier = 5;
      this.showStatusIndicator('5x MULTIPLIER', '#ffff00', 'STREAK');
      this.applyMultiplierUpgradeCue();
    }

    this.refreshMultiplierDisplay();
  }

  private showStatusIndicator(mainText: string, color: string, subText: string): void {
    const container = this.scene.add.container(this.scene.cameras.main.centerX, 200);

    const main = this.scene.add.text(0, 0, mainText, {
      fontSize: '48px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const sub = this.scene.add.text(0, 50, subText, {
      fontSize: '24px',
      color,
    }).setOrigin(0.5);

    container.add([main, sub]);
    container.setDepth(260);

    this.scene.tweens.add({
      targets: container,
      scale: { from: 0.5, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: 2000,
      onComplete: () => container.destroy(),
    });
  }

  private applyStreakIncrementCue(): void {
    if (this.streakMultiplierText && this.streakMultiplierText.visible) {
      this.scene.tweens.add({
        targets: this.streakMultiplierText,
        scale: { from: 1.0, to: 1.15 },
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  private applyMultiplierUpgradeCue(): void {
    if (!this.streakMultiplierText || !this.streakMultiplierText.visible) {
      return;
    }

    this.scene.tweens.add({
      targets: this.streakMultiplierText,
      scale: { from: 1.0, to: 1.4 },
      duration: 500,
      ease: 'Elastic.easeOut',
      easeParams: [1.5, 0.5],
    });

    const originalColor = '#ffaa00';
    this.streakMultiplierText.setColor('#ffff00');

    this.scene.time.delayedCall(250, () => {
      this.streakMultiplierText?.setColor(originalColor);
    });
  }

  private resetStreakDisplay(): void {
    if (!this.streakMultiplierText || !this.streakMultiplierText.visible) {
      return;
    }

    const originalColor = '#ffaa00';
    this.streakMultiplierText.setColor('#ff0000');

    this.scene.time.delayedCall(300, () => {
      this.streakMultiplierText?.setColor(originalColor);
    });
  }
}
