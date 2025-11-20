import { Scene } from 'phaser';
import {
  HitResult,
  HitTier,
  SCORING_CONFIG,
  getHitResult,
} from '@/config/scoringConfig';
import { DifficultyLevel } from '@/config/targetConfig';
import { TargetManager } from '@/game/managers/TargetManager';
import { Projectile } from '@/game/components/Projectile';

interface SimpleParticle {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface CollisionEvents {
  hit: { tier: HitTier; score: number; position: { x: number; y: number } };
  miss: { position: { x: number; y: number } };
  'score-updated': { totalScore: number };
}

export class CollisionFeedbackManager {
  private scene: Scene;
  private targetManager: TargetManager;
  private totalScore: number = 0;
  private lastHitResult?: HitResult;
  private eventEmitter: Phaser.Events.EventEmitter;
  private feedbackText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private simpleParticles: SimpleParticle[] = [];

  constructor(scene: Scene, targetManager: TargetManager) {
    this.scene = scene;
    this.targetManager = targetManager;
    this.eventEmitter = new Phaser.Events.EventEmitter();

    this.createUI();
  }

  private createUI(): void {
    // Create score display
    this.scoreText = this.scene.add.text(
      this.scene.cameras.main.width - 10,
      10,
      'Score: 0',
      {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 },
      }
    );
    this.scoreText.setOrigin(1, 0);
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(1001);
  }

  public detectHit(
    projectile: Projectile,
    difficulty: DifficultyLevel
  ): { hit: boolean; result?: HitResult; colorPhaseProgress: number } {
    const target = this.targetManager.getTarget();
    const projectileBody = projectile.getBody();

    // Simple circle overlap detection
    const distance = Phaser.Math.Distance.Between(
      target.x,
      target.y,
      projectileBody.x,
      projectileBody.y
    );

    const hitDistance = this.targetManager.getCurrentRadius() + 8; // 8 = projectile radius

    if (distance <= hitDistance) {
      // Calculate hit tier based on target state
      const colorPhaseProgress = this.calculateColorPhaseProgress();
      const tier = this.calculateHitTier();
      const result = getHitResult(tier, difficulty, colorPhaseProgress);

      this.lastHitResult = result;
      this.totalScore += result.score;

      // Update UI
      if (this.scoreText) {
        this.scoreText.setText(`Score: ${this.totalScore}`);
      }

      // Emit events
      this.eventEmitter.emit('hit', {
        tier: result.tier,
        score: result.score,
        position: { x: target.x, y: target.y },
      });

      this.eventEmitter.emit('score-updated', {
        totalScore: this.totalScore,
      });

      return { hit: true, result, colorPhaseProgress };
    }

    return {
      hit: false,
      colorPhaseProgress: this.calculateColorPhaseProgress(),
    };
  }

  private calculateColorPhaseProgress(): number {
    // Return a value 0-1 representing how far through the shrink we are
    // This can be used as a bonus multiplier
    const elapsed = this.targetManager.getElapsedTime();
    const settings = this.targetManager.getDifficultySettings();
    return Math.min(elapsed / settings.shrinkDuration, 1);
  }

  private calculateHitTier(): HitTier {
    const radiusPercentage =
      this.targetManager.getCurrentRadius() /
      this.targetManager.getDifficultySettings().startRadius;

    if (radiusPercentage <= SCORING_CONFIG.HIT_TIERS.PERFECT.radiusThreshold) {
      return 'PERFECT';
    } else if (
      radiusPercentage <= SCORING_CONFIG.HIT_TIERS.GOOD.radiusThreshold
    ) {
      return 'GOOD';
    }
    return 'BASIC';
  }

  public displayHitFeedback(
    result: HitResult,
    position: { x: number; y: number }
  ): void {
    // Display text feedback
    this.displayFeedbackText(result.feedback, position, result.color);

    // Create particle effect
    if (result.tier === 'PERFECT') {
      this.createPerfectBurst(position);
    } else if (result.tier === 'GOOD') {
      this.createExplosion(position);
    } else {
      this.createBasicHit(position);
    }

    // Flash the target
    this.flashTarget();
  }

  public displayMissFeedback(projectile: Projectile): void {
    const position = { x: projectile.getBody().x, y: projectile.getBody().y };

    this.eventEmitter.emit('miss', { position });

    // Display miss text
    this.displayFeedbackText('MISS', position, 0x95a5a6);
  }

  private displayFeedbackText(
    text: string,
    position: { x: number; y: number },
    color: number
  ): void {
    const feedback = this.scene.add.text(position.x, position.y - 50, text, {
      fontSize: '24px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
    });

    feedback.setOrigin(0.5);
    feedback.setDepth(1000);

    // Animate upwards and fade out
    this.scene.tweens.add({
      targets: feedback,
      y: position.y - 150,
      alpha: 0,
      duration: SCORING_CONFIG.FEEDBACK_DISPLAY_DURATION,
      ease: 'Power2',
      onComplete: () => {
        feedback.destroy();
      },
    });
  }

  private createExplosion(position: { x: number; y: number }): void {
    const count = SCORING_CONFIG.PARTICLES.EXPLOSION.emitCount;
    const speed = SCORING_CONFIG.PARTICLES.EXPLOSION.speed;
    const lifespan = SCORING_CONFIG.PARTICLES.EXPLOSION.lifespan;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const velocity = Phaser.Math.Between(speed.min, speed.max);
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      const graphics = this.scene.make.graphics({
        x: position.x,
        y: position.y,
      } as Phaser.Types.GameObjects.Graphics.Options);
      graphics.fillStyle(0xffff00, 1);
      graphics.fillCircle(0, 0, 4);
      this.scene.add.existing(graphics);

      this.simpleParticles.push({
        graphics,
        x: position.x,
        y: position.y,
        vx,
        vy,
        life: lifespan,
        maxLife: lifespan,
      });
    }
  }

  private createPerfectBurst(position: { x: number; y: number }): void {
    const count = SCORING_CONFIG.PARTICLES.PERFECT_BURST.emitCount;
    const speed = SCORING_CONFIG.PARTICLES.PERFECT_BURST.speed;
    const lifespan = SCORING_CONFIG.PARTICLES.PERFECT_BURST.lifespan;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const velocity = Phaser.Math.Between(speed.min, speed.max);
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      const graphics = this.scene.make.graphics({
        x: position.x,
        y: position.y,
      } as Phaser.Types.GameObjects.Graphics.Options);
      graphics.fillStyle(0x9b59b6, 1);
      graphics.fillCircle(0, 0, 6);
      this.scene.add.existing(graphics);

      this.simpleParticles.push({
        graphics,
        x: position.x,
        y: position.y,
        vx,
        vy,
        life: lifespan,
        maxLife: lifespan,
      });
    }
  }

  private createBasicHit(position: { x: number; y: number }): void {
    const count = 8;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Phaser.Math.Between(30, 80);
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      const graphics = this.scene.make.graphics({
        x: position.x,
        y: position.y,
      } as Phaser.Types.GameObjects.Graphics.Options);
      graphics.fillStyle(0xf39c12, 1);
      graphics.fillCircle(0, 0, 3);
      this.scene.add.existing(graphics);

      this.simpleParticles.push({
        graphics,
        x: position.x,
        y: position.y,
        vx,
        vy,
        life: 300,
        maxLife: 300,
      });
    }
  }

  public updateParticles(): void {
    for (let i = this.simpleParticles.length - 1; i >= 0; i--) {
      const particle = this.simpleParticles[i];

      particle.life -= 16; // Approximate delta time
      particle.x += particle.vx;
      particle.y += particle.vy + 9.8; // Simple gravity

      const alpha = Math.max(0, particle.life / particle.maxLife);
      particle.graphics.setAlpha(alpha);
      particle.graphics.setPosition(particle.x, particle.y);

      if (particle.life <= 0) {
        particle.graphics.destroy();
        this.simpleParticles.splice(i, 1);
      }
    }
  }

  private flashTarget(): void {
    const target = this.targetManager.getTarget();
    const originalAlpha = target.alpha;

    this.scene.tweens.add({
      targets: target,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        target.setAlpha(originalAlpha);
      },
    });
  }

  public resetScore(): void {
    this.totalScore = 0;
    if (this.scoreText) {
      this.scoreText.setText('Score: 0');
    }
  }

  public getTotalScore(): number {
    return this.totalScore;
  }

  public getLastHitResult(): HitResult | undefined {
    return this.lastHitResult;
  }

  public on<T extends keyof CollisionEvents>(
    event: T,
    callback: (data: CollisionEvents[T]) => void
  ): void {
    this.eventEmitter.on(event, callback);
  }

  public off<T extends keyof CollisionEvents>(
    event: T,
    callback: (data: CollisionEvents[T]) => void
  ): void {
    this.eventEmitter.off(event, callback);
  }

  public destroy(): void {
    if (this.scoreText) {
      this.scoreText.destroy();
    }
    if (this.feedbackText) {
      this.feedbackText.destroy();
    }
    this.simpleParticles.forEach((p) => {
      if (p.graphics) {
        p.graphics.destroy();
      }
    });
    this.simpleParticles = [];
    this.eventEmitter.removeAllListeners();
  }
}
