import { Scene } from 'phaser';
import { Projectile, ProjectileConfig } from '@/game/components/Projectile';
import { TargetManager } from '@/game/managers/TargetManager';
import { CollisionFeedbackManager } from '@/game/managers/CollisionFeedbackManager';
import { DifficultyLevel } from '@/config/targetConfig';
import { SCORING_CONFIG } from '@/config/scoringConfig';

export interface ProjectileManagerEvents {
  'projectile-fired': { projectile: Projectile };
  'projectile-hit': { projectile: Projectile; tier: string };
  'projectile-missed': { projectile: Projectile };
}

export class ProjectileManager {
  private scene: Scene;
  private targetManager: TargetManager;
  private collisionFeedback: CollisionFeedbackManager;
  private projectiles: Projectile[] = [];
  private activeProjectile?: Projectile;
  private eventEmitter: Phaser.Events.EventEmitter;
  private currentDifficulty: DifficultyLevel = 'NORMAL';
  private canFireProjectile: boolean = true;
  private resetTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Scene,
    targetManager: TargetManager,
    collisionFeedback: CollisionFeedbackManager
  ) {
    this.scene = scene;
    this.targetManager = targetManager;
    this.collisionFeedback = collisionFeedback;
    this.eventEmitter = new Phaser.Events.EventEmitter();
  }

  public fireProjectile(config: ProjectileConfig, difficulty: DifficultyLevel): void {
    if (!this.canFireProjectile) return;

    // Create projectile
    const projectile = new Projectile(this.scene, config);
    this.projectiles.push(projectile);
    this.activeProjectile = projectile;
    this.currentDifficulty = difficulty;

    this.canFireProjectile = false;

    this.eventEmitter.emit('projectile-fired', { projectile });
  }

  public update(currentTime: number): void {
    // Update particle effects
    this.collisionFeedback.updateParticles();

    // Update all projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.update(currentTime);

      // Check if projectile is still active
      if (!projectile.isCurrentlyActive()) {
        // If it was the active projectile and wasn't a hit, show miss
        if (projectile === this.activeProjectile) {
          this.collisionFeedback.displayMissFeedback(projectile);
          this.eventEmitter.emit('projectile-missed', { projectile });
          this.scheduleReset();
        }

        // Remove from tracking
        this.projectiles.splice(i, 1);
        projectile.destroy();
        continue;
      }

      // Check for collision with target
      const collisionResult = this.collisionFeedback.detectHit(projectile, this.currentDifficulty);

      if (collisionResult.hit && collisionResult.result) {
        // Display feedback
        this.collisionFeedback.displayHitFeedback(
          collisionResult.result,
          {
            x: this.targetManager.getTarget().x,
            y: this.targetManager.getTarget().y,
          }
        );

        this.eventEmitter.emit('projectile-hit', {
          projectile,
          tier: collisionResult.result.tier,
        });

        // Deactivate projectile
        projectile.deactivate();

        // Schedule reset after hit
        this.scheduleReset();

        // Mark as no longer active
        this.activeProjectile = undefined;
      }
    }
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      this.resetTimer.remove();
    }

    this.resetTimer = this.scene.time.delayedCall(
      SCORING_CONFIG.RESET_DELAY,
      () => {
        this.reset();
      }
    );
  }

  public reset(): void {
    // Reset state for next projectile
    this.activeProjectile = undefined;
    this.canFireProjectile = true;

    // Clear reset timer
    if (this.resetTimer) {
      this.resetTimer.remove();
      this.resetTimer = undefined;
    }

    // Prepare target for next shot
    this.targetManager.reset();
    this.targetManager.start();
  }

  public isReady(): boolean {
    return this.canFireProjectile && !this.activeProjectile;
  }

  public getActiveProjectile(): Projectile | undefined {
    return this.activeProjectile;
  }

  public getProjectileCount(): number {
    return this.projectiles.length;
  }

  public on<T extends keyof ProjectileManagerEvents>(
    event: T,
    callback: (data: ProjectileManagerEvents[T]) => void
  ): void {
    this.eventEmitter.on(event, callback);
  }

  public off<T extends keyof ProjectileManagerEvents>(
    event: T,
    callback: (data: ProjectileManagerEvents[T]) => void
  ): void {
    this.eventEmitter.off(event, callback);
  }

  public destroy(): void {
    if (this.resetTimer) {
      this.resetTimer.remove();
    }

    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles = [];
    this.eventEmitter.removeAllListeners();
  }
}
