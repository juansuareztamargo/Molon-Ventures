import type Phaser from 'phaser';

const RAINBOW_COLORS = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'];

interface TransactionRequest {
  amount: number;
  type: 'cost' | 'reward';
}

export class PowderHud {
  private container?: Phaser.GameObjects.Container;
  private label?: Phaser.GameObjects.Text;
  private value?: Phaser.GameObjects.Text;
  private transactionText?: Phaser.GameObjects.Text;
  private legacyText?: Phaser.GameObjects.Text;

  private powderAnimationTween?: Phaser.Tweens.Tween;
  private transactionTween?: Phaser.Tweens.Tween;
  private transactionQueue: TransactionRequest[] = [];
  private transactionActive = false;
  private bonusModeAnimation?: Phaser.Time.TimerEvent;
  private bonusModeVisualActive = false;

  constructor(private scene: Phaser.Scene) {}

  create(initialPowder: number): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const paddingX = Math.max(20, width * 0.02);
    const paddingY = Math.max(24, height * 0.03);

    this.container = this.scene.add.container(paddingX, paddingY);
    this.container.setDepth(100);

    this.label = this.scene.add.text(0, 0, 'POWDER', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);

    this.value = this.scene.add.text(0, 0, initialPowder.toString(), {
      fontSize: '28px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);

    this.transactionText = this.scene.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.transactionText.setVisible(false);
    this.transactionText.setAlpha(0);

    this.container.add([this.label, this.value, this.transactionText]);

    this.legacyText = this.scene.add.text(
      paddingX,
      paddingY - 14,
      `POWDER: ${initialPowder}`,
      {
        fontSize: '28px',
        color: '#FFD700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    this.legacyText.setOrigin(0, 0);
    this.legacyText.setDepth(90);
    this.legacyText.setVisible(false);

    this.layout();
  }

  updateValue(value: number): void {
    if (!this.value || !this.legacyText) {
      return;
    }

    this.value.setText(value.toString());
    this.legacyText.setText(`POWDER: ${value}`);
    this.layout();
  }

  animatePowderCounter(oldValue: number, newValue: number, isReward: boolean): void {
    if (!this.value || !this.legacyText) {
      return;
    }

    if (this.powderAnimationTween) {
      this.powderAnimationTween.destroy();
    }

    const animationObj: { value: number } = { value: oldValue };

    this.powderAnimationTween = this.scene.tweens.add({
      targets: animationObj,
      value: newValue,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const displayValue = Math.round(animationObj.value);
        this.value?.setText(displayValue.toString());
        this.legacyText?.setText(`POWDER: ${displayValue}`);
        this.layout();
      },
    });

    if (isReward) {
      this.applyRewardCue();
    } else {
      this.applyConsumptionCue();
    }
  }

  displayTransaction(amount: number, isReward: boolean): void {
    const type: TransactionRequest['type'] = isReward ? 'reward' : 'cost';
    console.log(`[POWDER] ${isReward ? 'Reward' : 'Shot cost'} ${isReward ? '+' : '-'}${Math.abs(amount)}`);

    if (this.transactionActive) {
      this.transactionQueue.push({ amount, type });
      return;
    }

    this.showTransactionText(amount, type);
  }

  clearFeedback(): void {
    this.transactionQueue = [];
    this.transactionActive = false;

    if (this.transactionTween) {
      this.transactionTween.stop();
      this.transactionTween.destroy();
      this.transactionTween = undefined;
    }

    if (this.transactionText) {
      this.transactionText.setVisible(false);
      this.transactionText.setAlpha(0);
      this.transactionText.setText('');
    }

    if (this.powderAnimationTween) {
      this.powderAnimationTween.stop();
      this.powderAnimationTween.destroy();
      this.powderAnimationTween = undefined;
    }
  }

  startBonusModeVisual(): void {
    if (!this.label || this.bonusModeVisualActive) {
      return;
    }

    this.bonusModeVisualActive = true;

    if (this.bonusModeAnimation) {
      this.bonusModeAnimation.remove();
      this.bonusModeAnimation = undefined;
    }

    let colorIndex = 0;
    this.bonusModeAnimation = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.label && this.bonusModeVisualActive) {
          this.label.setColor(RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length]);
          colorIndex++;
        }
      },
    });

    this.scene.tweens.add({
      targets: this.label,
      scale: { from: 1.0, to: 1.15 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  stopBonusModeVisual(): void {
    if (!this.bonusModeVisualActive) {
      return;
    }

    this.bonusModeVisualActive = false;

    if (this.bonusModeAnimation) {
      this.bonusModeAnimation.remove();
      this.bonusModeAnimation = undefined;
    }

    if (this.label) {
      this.scene.tweens.killTweensOf(this.label);
      this.label.setColor('#ffffff');
      this.label.setScale(1.0);
    }
  }

  private layout(): void {
    if (!this.label || !this.value || !this.transactionText) {
      return;
    }

    const labelWidth = this.label.width;
    const valueWidth = this.value.width;
    const labelValueSpacing = 8;
    const valueTransactionSpacing = 12;

    this.label.setPosition(0, 0);
    this.value.setPosition(labelWidth + labelValueSpacing, 0);
    this.transactionText.setPosition(labelWidth + labelValueSpacing + valueWidth + valueTransactionSpacing, 0);
  }

  private applyConsumptionCue(): void {
    if (!this.value) {
      return;
    }

    const powderDisplay = this.value;
    const originalColor = '#FFD700';

    powderDisplay.setColor('#ff0000');
    powderDisplay.setScale(0.7);

    this.scene.tweens.add({
      targets: powderDisplay,
      scale: { from: 0.7, to: 1.0 },
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        powderDisplay.setColor(originalColor);
      },
    });
  }

  private applyRewardCue(): void {
    if (!this.value) {
      return;
    }

    const powderDisplay = this.value;
    const originalColor = '#FFD700';

    powderDisplay.setColor('#00ff00');
    powderDisplay.setScale(1.3);

    this.scene.tweens.add({
      targets: powderDisplay,
      scale: { from: 1.3, to: 1.0 },
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        powderDisplay.setColor(originalColor);
      },
    });
  }

  private showTransactionText(amount: number, type: TransactionRequest['type']): void {
    if (!this.transactionText) {
      return;
    }

    this.transactionActive = true;
    const isReward = type === 'reward';
    const prefix = isReward ? '+' : '-';
    const color = isReward ? '#00ff00' : '#ff0000';
    this.transactionText.setText(`${prefix}${Math.abs(amount)}`);
    this.transactionText.setColor(color);
    this.transactionText.setVisible(true);
    this.transactionText.setAlpha(1);

    if (this.transactionTween) {
      this.transactionTween.stop();
      this.transactionTween.destroy();
    }

    this.transactionTween = this.scene.tweens.add({
      targets: this.transactionText,
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Quad.easeOut',
      delay: 400,
      onComplete: () => {
        this.transactionActive = false;
        this.transactionText?.setVisible(false);
        this.transactionText?.setText('');
        this.processNextTransaction();
      },
    });
  }

  private processNextTransaction(): void {
    if (this.transactionActive || this.transactionQueue.length === 0) {
      return;
    }

    const next = this.transactionQueue.shift();
    if (!next) {
      return;
    }

    this.showTransactionText(next.amount, next.type);
  }
}
