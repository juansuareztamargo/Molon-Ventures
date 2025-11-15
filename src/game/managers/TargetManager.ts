import { Scene } from 'phaser';
import { TARGET_CONFIG, TargetColor, DifficultyLevel, getDifficultySettings } from '@/config/targetConfig';
import { DifficultySettings } from '@/game/types';

export interface TargetEvents {
  'color-change': { color: TargetColor; timeRemaining: number };
  'size-threshold': { radius: number; percentage: number };
  'target-complete': { finalRadius: number };
  'target-respawn': { position: { x: number; y: number } };
  'difficulty-changed': { oldDifficulty: DifficultyLevel; newDifficulty: DifficultyLevel };
}

export class TargetManager {
  private scene: Scene;
  private target!: Phaser.GameObjects.Arc;
  private currentRadius: number;
  private startTime: number;
  private isShrinking: boolean = false;
  private respawnTimer?: Phaser.Time.TimerEvent;
  private uiText?: Phaser.GameObjects.Text;
  private currentDifficulty: DifficultyLevel = 'NORMAL';
  private difficultySettings: DifficultySettings;
  
  // Event emitters
  private eventEmitter: Phaser.Events.EventEmitter;

  constructor(scene: Scene, difficulty: DifficultyLevel = 'NORMAL') {
    this.scene = scene;
    this.eventEmitter = new Phaser.Events.EventEmitter();
    this.currentDifficulty = difficulty;
    this.difficultySettings = getDifficultySettings(difficulty);
    this.currentRadius = this.difficultySettings.startRadius;
    this.startTime = 0;
    
    this.createTarget();
    this.createUI();
  }

  private createTarget(): void {
    const position = this.getRandomSpawnPosition();
    
    this.target = this.scene.add.circle(
      position.x,
      position.y,
      this.difficultySettings.startRadius,
      0xe74c3c // Start with red color
    );
    
    this.target.setOrigin(0.5);
    this.target.setInteractive();
  }

  private createUI(): void {
    // Create UI text for timing phase indicator
    this.uiText = this.scene.add.text(
      10,
      10,
      'Phase: RED',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.uiText.setScrollFactor(0); // Fixed position
    this.uiText.setDepth(1000); // Render on top
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    const margin = TARGET_CONFIG.SPAWN_MARGIN + this.difficultySettings.startRadius;
    const x = Phaser.Math.Between(
      margin,
      this.scene.cameras.main.width - margin
    );
    const y = Phaser.Math.Between(
      margin,
      this.scene.cameras.main.height - margin
    );
    return { x, y };
  }

  public start(): void {
    if (this.isShrinking) return;
    
    this.isShrinking = true;
    this.startTime = Date.now();
    this.currentRadius = this.difficultySettings.startRadius;
    
    // Reset target to initial state
    this.target.setRadius(this.difficultySettings.startRadius);
    this.target.setFillStyle(0xe74c3c);
  }

  public stop(): void {
    this.isShrinking = false;
    if (this.respawnTimer) {
      this.respawnTimer.remove();
      this.respawnTimer = undefined;
    }
  }

  public reset(): void {
    this.stop();
    
    // Move to new position
    const position = this.getRandomSpawnPosition();
    this.target.setPosition(position.x, position.y);
    
    // Reset visual state
    this.target.setRadius(this.difficultySettings.startRadius);
    this.target.setFillStyle(0xe74c3c);
    this.currentRadius = this.difficultySettings.startRadius;
    
    // Emit respawn event
    this.eventEmitter.emit('target-respawn', { position });
  }

  public update(): void {
    if (!this.isShrinking) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.difficultySettings.shrinkDuration, 1);
    
    // Calculate current radius
    const radiusRange = this.difficultySettings.startRadius - this.difficultySettings.minRadius;
    this.currentRadius = this.difficultySettings.startRadius - (radiusRange * progress);
    this.target.setRadius(this.currentRadius);
    
    // Calculate time remaining percentage
    const timeRemaining = 1 - progress;
    
    // Update color based on time remaining
    this.updateColor(timeRemaining);
    
    // Update UI
    this.updateUI(timeRemaining);
    
    // Emit size threshold events
    this.emitSizeThresholds(progress);
    
    // Check if shrinking is complete
    if (progress >= 1) {
      this.onShrinkComplete();
    }
  }

  private updateColor(timeRemaining: number): void {
    let newColor: TargetColor;
    let colorValue: number;
    
    if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.RED) {
      newColor = 'RED';
      colorValue = 0xe74c3c;
    } else if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.ORANGE) {
      newColor = 'ORANGE';
      colorValue = 0xf39c12;
    } else if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.GREEN) {
      newColor = 'GREEN';
      colorValue = 0x2ecc71;
    } else {
      newColor = 'PURPLE';
      colorValue = 0x9b59b6;
    }
    
    // Only update if color actually changed
    const currentColor = this.target.fillColor;
    if (currentColor !== colorValue) {
      this.target.setFillStyle(colorValue);
      
      // Emit color change event
      this.eventEmitter.emit('color-change', {
        color: newColor,
        timeRemaining: timeRemaining * TARGET_CONFIG.SHRINK_DURATION
      });
    }
  }

  private updateUI(timeRemaining: number): void {
    if (!this.uiText) return;
    
    let phase: string;
    if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.RED) {
      phase = 'RED';
    } else if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.ORANGE) {
      phase = 'ORANGE';
    } else if (timeRemaining >= TARGET_CONFIG.COLOR_THRESHOLDS.GREEN) {
      phase = 'GREEN';
    } else {
      phase = 'PURPLE';
    }
    
    const timeMs = Math.floor(timeRemaining * this.difficultySettings.shrinkDuration);
    this.uiText.setText(
      `Difficulty: ${this.currentDifficulty} | Phase: ${phase} | Time: ${(timeMs / 1000).toFixed(1)}s`
    );
  }

  private emitSizeThresholds(progress: number): void {
    // Emit events at specific size thresholds
    const thresholds = [0.25, 0.5, 0.75];
    
    for (const threshold of thresholds) {
      if (Math.abs(progress - threshold) < 0.01) { // Small window to emit once
        this.eventEmitter.emit('size-threshold', {
          radius: this.currentRadius,
          percentage: threshold * 100
        });
      }
    }
  }

  private onShrinkComplete(): void {
    this.isShrinking = false;
    
    // Emit completion event
    this.eventEmitter.emit('target-complete', {
      finalRadius: this.currentRadius
    });
    
    // Schedule respawn
    this.respawnTimer = this.scene.time.delayedCall(
      this.difficultySettings.respawnDelay,
      () => {
        this.reset();
        this.start(); // Auto-start after respawn
      }
    );
  }

  public getTarget(): Phaser.GameObjects.Arc {
    return this.target;
  }

  public getCurrentRadius(): number {
    return this.currentRadius;
  }

  public isCurrentlyShrinking(): boolean {
    return this.isShrinking;
  }

  public getElapsedTime(): number {
    if (!this.isShrinking) return 0;
    return Date.now() - this.startTime;
  }

  public on<T extends keyof TargetEvents>(
    event: T,
    callback: (data: TargetEvents[T]) => void
  ): void {
    this.eventEmitter.on(event, callback);
  }

  public off<T extends keyof TargetEvents>(
    event: T,
    callback: (data: TargetEvents[T]) => void
  ): void {
    this.eventEmitter.off(event, callback);
  }

  public setDifficulty(difficulty: DifficultyLevel): void {
    const oldDifficulty = this.currentDifficulty;
    this.currentDifficulty = difficulty;
    this.difficultySettings = getDifficultySettings(difficulty);
    
    // Stop current animation and reset with new settings
    const wasShrinking = this.isShrinking;
    this.stop();
    this.reset();
    
    // Emit difficulty change event
    this.eventEmitter.emit('difficulty-changed', {
      oldDifficulty,
      newDifficulty: difficulty
    });
    
    // Restart if it was running
    if (wasShrinking) {
      this.start();
    }
  }

  public getCurrentDifficulty(): DifficultyLevel {
    return this.currentDifficulty;
  }

  public getDifficultySettings(): DifficultySettings {
    return { ...this.difficultySettings };
  }

  public destroy(): void {
    this.stop();
    this.target.destroy();
    if (this.uiText) {
      this.uiText.destroy();
    }
    this.eventEmitter.removeAllListeners();
  }
}