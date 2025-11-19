import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS, TARGET_COLORS, POWDER_REWARDS, CIRCLE_SPACING } from '@/utils/constants';
import { createButton, createTextStyle } from '@/utils/helpers';

const JOYPAD_BASE_RADIUS = 82;
const JOYPAD_KNOB_RADIUS = 26;
const MISS_EDGE_PADDING = 50;

interface TargetData {
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

interface JoypadUI {
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

interface ProjectileData {
  sprite: Phaser.Physics.Arcade.Sprite;
  ring: Phaser.GameObjects.Arc;
  targetColor: number;
  fadingOut: boolean;
  hasCollided: boolean;
  shouldDestroy: boolean;
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class SlingshotScene extends Phaser.Scene {
  private currentRound: number = 1;
  private targetsInRound: number = 1;
  private targetsRemainingInRound: number = 0;
  private targetsSpawnedInRound: number = 0;
  private powder: number = GAME_SETTINGS.INITIAL_POWDER;
  private totalPowderEarned: number = 0;
  private bestHit: number = 0;

  private roundText!: Phaser.GameObjects.Text;
  private powderHudContainer!: Phaser.GameObjects.Container;
  private powderLabel!: Phaser.GameObjects.Text;
  private powderValue!: Phaser.GameObjects.Text;
  private transactionText!: Phaser.GameObjects.Text;
  private powderText!: Phaser.GameObjects.Text; // Keep for backward compatibility
  private instructionsText!: Phaser.GameObjects.Text;
  private sequenceProgressText!: Phaser.GameObjects.Text;
  private streakCounterText!: Phaser.GameObjects.Text;
  private streakMultiplierText!: Phaser.GameObjects.Text;

  private isDragging: boolean = false;
  private currentProjectile?: ProjectileData;
  private activeProjectiles: ProjectileData[] = [];
  private slingshotEnabled: boolean = true;

  private targets: TargetData[] = [];
  private ground!: Phaser.GameObjects.Rectangle;

  private joypad?: JoypadUI;
  private snappedVelocity?: { vx: number; vy: number };

  private roundComplete: boolean = false;
  private gameOver: boolean = false;
  private firstSequenceStarted: boolean = false;
  private sequenceActive: boolean = false;
  private countdownActive: boolean = false;
  private hitsInSequence: number = 0;
  private missesInSequence: number = 0;
  private sequenceTimer: Phaser.Time.TimerEvent | null = null;
  private activePointer?: Phaser.Input.Pointer;
  private pointerOffsetX: number = 0;
  private pointerOffsetY: number = 0;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private shotsInCurrentSequence: number = 0;

  // Advanced powder mechanics
  private consecutivePerfects: number = 0;
  private bonusStageActive: boolean = false;
  private consecutiveHits: number = 0;
  private streakMultiplier: number = 1;
  
  // Powder animation tracking
  private powderAnimationTween?: Phaser.Tweens.Tween;
  private transactionTween?: Phaser.Tweens.Tween;
  private transactionQueue: Array<{ amount: number; type: 'cost' | 'reward' }> = [];
  private transactionActive: boolean = false;
  
  // Bonus mode visual tracking
  private bonusModeAnimation?: Phaser.Time.TimerEvent;
  private bonusModeVisualActive: boolean = false;
  
  // Reward display tracking
  private rewardDisplays: Map<TargetData, Phaser.GameObjects.Text> = new Map();

  constructor() {
    super({ key: SCENES.SLINGSHOT });
    this.slingshotEnabled = true; // Initialize as enabled
  }

  init(): void {
    this.resetState();
  }

  private resetState(): void {
    if (this.sequenceTimer) {
      this.sequenceTimer.remove();
      this.sequenceTimer = null;
    }

    if (this.time) {
      this.time.removeAllEvents();
    }

    if (this.tweens) {
      this.tweens.killAll();
    }

    // Clean up transaction queue and tweens
    this.clearPowderTransactionFeedback();

    // Clean up bonus mode animations
    if (this.bonusModeAnimation) {
      this.bonusModeAnimation.remove();
      this.bonusModeAnimation = undefined;
    }
    this.bonusModeVisualActive = false;
    
    // Clean up reward displays
    this.rewardDisplays.forEach((rewardDisplay) => {
      try {
        rewardDisplay.destroy();
      } catch (_e) {
        // Ignore destruction errors
      }
    });
    this.rewardDisplays.clear();

    if (this.currentProjectile) {
      try {
        const body = this.currentProjectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          body.stop();
          body.setVelocity(0, 0);
          body.setAllowGravity(false);
          body.enable = false;
        }
      } catch (_error) {
        // Ignore cleanup errors during scene reset
      }
      this.currentProjectile.sprite.destroy();
      this.currentProjectile.ring.destroy();
      this.currentProjectile = undefined;
    }

    if (this.joypad) {
      this.destroyJoypad();
    }

    if (this.targets.length > 0) {
      const existingTargets = [...this.targets];
      existingTargets.forEach((target) => {
        // Clean up reward displays for all targets
        this.removeRewardDisplay(target);
        target.sprite.destroy();
        target.graphic.destroy();
        target.ring.destroy();
      });
      this.targets = [];
    }

    this.resetDragState();

    this.snappedVelocity = undefined;

    this.roundComplete = false;
    this.gameOver = false;
    this.firstSequenceStarted = false;
    this.sequenceActive = false;
    this.countdownActive = false;

    this.hitsInSequence = 0;
    this.missesInSequence = 0;
    this.shotsInCurrentSequence = 0;

    // Reset advanced powder mechanics
    this.consecutivePerfects = 0;
    this.bonusStageActive = false;
    this.consecutiveHits = 0;
    this.streakMultiplier = 1;
    
    // Refresh multiplier display to hide x1 on reset
    if (this.streakMultiplierText) {
      this.refreshMultiplierDisplay();
    }

    this.currentRound = 1;
    this.targetsInRound = 1;
    this.targetsRemainingInRound = 0;
    this.targetsSpawnedInRound = 0;
    this.powder = GAME_SETTINGS.INITIAL_POWDER;
    this.totalPowderEarned = 0;
    this.bestHit = 0;

    // Reset slingshot state to enabled
    this.slingshotEnabled = true;

    if (this.input) {
      this.input.removeAllListeners();
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // DIAGNOSTIC: Log ground configuration
    console.log(`[GROUND-DIAGNOSTIC] GAME_SETTINGS.GROUND_HEIGHT: ${GAME_SETTINGS.GROUND_HEIGHT}`);
    console.log(`[GROUND-DIAGNOSTIC] Screen height: ${height}`);
    console.log(`[GROUND-DIAGNOSTIC] Calculated ground level: ${height - GAME_SETTINGS.GROUND_HEIGHT}`);

    this.ground = this.add.rectangle(
      width / 2,
      height - GAME_SETTINGS.GROUND_HEIGHT / 2,
      width,
      GAME_SETTINGS.GROUND_HEIGHT,
      COLORS.GROUND
    );
    this.physics.add.existing(this.ground, true);

    this.createUI();
    this.setupInput();
    this.startCountdown();
  }

  update(_time: number, _delta: number): void {
    // Handle deferred projectile destruction (CRITICAL: outside collision handlers)
    if (this.currentProjectile && this.currentProjectile.shouldDestroy && !this.currentProjectile.fadingOut) {
      console.log('[UPDATE] Processing deferred projectile destruction');
      this.currentProjectile.shouldDestroy = false; // Reset flag
      // Defer cleanup to next frame to ensure we're fully outside collision handler
      this.time.delayedCall(1, () => {
        if (this.currentProjectile) {
          console.log('[UPDATE] Executing deferred cleanup');
          this.cleanupProjectileAfterHit();
        }
      });
    }

    // DIAGNOSTIC: Check ground collision for current projectile
    if (this.currentProjectile && this.currentProjectile.sprite) {
      const groundLevel = this.scale.height - GAME_SETTINGS.GROUND_HEIGHT
      const projectileY = this.currentProjectile.sprite.y
      const isAboveGround = projectileY < groundLevel
      
      console.log(`[GROUND-DIAGNOSTIC] currentProjectile exists`)
      console.log(`  - Y: ${projectileY.toFixed(0)}, Ground: ${groundLevel.toFixed(0)}, Above: ${isAboveGround}`)
      console.log(`  - isDragging: ${this.isDragging}`)
      console.log(`  - shouldDestroy: ${this.currentProjectile.shouldDestroy}`)
      console.log(`  - fadingOut: ${this.currentProjectile.fadingOut}`)
      console.log(`  - sprite destroyed: ${this.currentProjectile.sprite?.active === false}`)
      
      if (!isAboveGround && !this.isDragging && !this.currentProjectile.shouldDestroy) {
        console.log(`[GROUND-DIAGNOSTIC] CONDITIONS MET FOR DESTRUCTION!`)
        this.destroyProjectileOnGroundImpact()
      } else if (!isAboveGround) {
        console.log(`[GROUND-DIAGNOSTIC] NOT destroying because:`)
        if (this.isDragging) console.log(`    - isDragging: true`)
        if (this.currentProjectile.shouldDestroy) console.log(`    - shouldDestroy: true`)
      }
    } else {
      if (this.currentProjectile) {
        console.log(`[GROUND-DIAGNOSTIC] currentProjectile exists but no sprite!`)
      }
    }

    // CRITICAL FIX: Remove zombie projectiles stuck with shouldDestroy flag
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.activeProjectiles[i]

      if (!projectile) {
        this.activeProjectiles.splice(i, 1)
        continue
      }

      if (projectile.shouldDestroy) {
        console.log('[CLEANUP] Removing zombie projectile with shouldDestroy flag from array')
        try {
          this.cleanupActiveProjectile(projectile, i)
        } catch (error) {
          console.error('[CLEANUP] Error cleaning up zombie projectile:', error)
          const existingIndex = this.activeProjectiles.indexOf(projectile)
          if (existingIndex !== -1) {
            this.activeProjectiles.splice(existingIndex, 1)
          }
        }
        console.log(`[CLEANUP] Zombie projectile removed, ${this.activeProjectiles.length} remaining`)
        continue
      }
    }

    // DIAGNOSTIC: Check all active projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.activeProjectiles[i]
      if (projectile && projectile.sprite) {
        const groundLevel = this.scale.height - GAME_SETTINGS.GROUND_HEIGHT
        const projectileY = projectile.sprite.y
        const isAboveGround = projectileY < groundLevel
        
        console.log(`[GROUND-DIAGNOSTIC] activeProjectile[${i}]`)
        console.log(`  - Y: ${projectileY.toFixed(0)}, Ground: ${groundLevel.toFixed(0)}, Above: ${isAboveGround}`)
        console.log(`  - fadingOut: ${projectile.fadingOut}, shouldDestroy: ${projectile.shouldDestroy}`)
        
        if (!isAboveGround && !projectile.fadingOut && !projectile.shouldDestroy) {
          console.log(`[GROUND-DIAGNOSTIC] CONDITIONS MET FOR DESTRUCTION!`)
          this.destroyActiveProjectileOnGroundImpact(projectile, i)
        }
      }
    }

    // Update currentProjectile (being dragged/aimed) lifecycle
    if (this.currentProjectile && !this.isDragging) {
      const sprite = this.currentProjectile.sprite;
      const ring = this.currentProjectile.ring;
      const body = sprite.body as Phaser.Physics.Arcade.Body;

      // Only despawn on left/right edges, allow projectile to go off top and come back down
      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50;

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      const isOnGround = sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30;

      // Handle off-screen projectiles even after sequence completes
      if (isOffscreen && !this.currentProjectile.fadingOut && !this.currentProjectile.shouldDestroy) {
        console.log('[OFF-SCREEN] Projectile detected off-screen, cleaning up...');
        this.handleOffscreenProjectile();
      } else if (hasLowVelocity && isOnGround && !this.currentProjectile.fadingOut && !this.currentProjectile.shouldDestroy) {
        console.log('[GROUND-FADE] Projectile detected on ground, destroying immediately');
        this.destroyProjectileImmediately();
      }

      // Manual radius-based collision detection for improved hit detection
      if (this.currentProjectile && !this.currentProjectile.fadingOut && !this.currentProjectile.shouldDestroy) {
        this.checkManualCollisions();
      }

      // ALWAYS sync ring to sprite position (critical for visual hierarchy)
      if (ring && this.currentProjectile) {
        ring.setPosition(sprite.x, sprite.y);
      }

      // Keep particle emitter following projectile and rotate arrow to velocity direction
      if (this.currentProjectile) {
        const trailEmitter = this.currentProjectile.particles;
        if (trailEmitter && !this.currentProjectile.fadingOut) {
          trailEmitter.setPosition(sprite.x, sprite.y);
        }
      }

      // Rotate arrow to point in direction of travel during flight (ALWAYS update when moving)
      if (this.currentProjectile && !this.currentProjectile.fadingOut && (Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1)) {
        const angle = Math.atan2(body.velocity.y, body.velocity.x);
        sprite.setRotation(angle);
      }
    }

    // CRITICAL FIX: Update ALL active projectiles for concurrent shooting
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.activeProjectiles[i];
      
      if (!projectile || !projectile.sprite || !projectile.sprite.active) {
        this.activeProjectiles.splice(i, 1);
        continue;
      }

      const sprite = projectile.sprite;
      const ring = projectile.ring;
      const body = sprite.body as Phaser.Physics.Arcade.Body;

      // Check if projectile should be destroyed
      if (projectile.shouldDestroy && !projectile.fadingOut) {
        console.log('[UPDATE] Active projectile marked for destruction, cleaning up');
        projectile.shouldDestroy = false;
        this.cleanupActiveProjectile(projectile, i);
        continue;
      }

      // Only despawn on left/right edges, allow projectile to go off top and come back down
      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50;

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      const isOnGround = sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30;

      // Handle off-screen projectiles
      if (isOffscreen && !projectile.fadingOut && !projectile.shouldDestroy) {
        console.log('[OFF-SCREEN] Active projectile detected off-screen, cleaning up...');
        this.handleOffscreenActiveProjectile(projectile, i);
        continue;
      }

      // Handle ground collision (immediate destruction) - backup check
      if (hasLowVelocity && isOnGround && !projectile.fadingOut && !projectile.shouldDestroy) {
        console.log('[GROUND-FADE] Active projectile on ground, destroying immediately');
        this.destroyActiveProjectileImmediately(projectile, i);
        continue;
      }

      // Manual radius-based collision detection
      if (!projectile.fadingOut && !projectile.hasCollided && !projectile.shouldDestroy) {
        this.checkManualCollisionsForProjectile(projectile);
      }

      // ALWAYS sync ring to sprite position
      if (ring && projectile) {
        ring.setPosition(sprite.x, sprite.y);
      }

      // Keep particle emitter following projectile
      const trailEmitter = projectile.particles;
      if (trailEmitter && !projectile.fadingOut) {
        trailEmitter.setPosition(sprite.x, sprite.y);
      }

      // Rotate arrow to point in direction of travel during flight
      if (!projectile.fadingOut && (Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1)) {
        const angle = Math.atan2(body.velocity.y, body.velocity.x);
        sprite.setRotation(angle);
      }
    }

    // Don't update game state when round is complete or game is over
    if (this.roundComplete || this.gameOver) {
      return;
    }

    this.updateTargets();

    if (this.targetsRemainingInRound === 0 && 
        this.targetsSpawnedInRound === this.targetsInRound && 
        !this.roundComplete && 
        !this.gameOver &&
        this.sequenceActive) {
      this.handleSequenceComplete();
    }
  }

  private checkManualCollisions(): void {
    if (!this.currentProjectile || this.currentProjectile.fadingOut || this.currentProjectile.hasCollided) {
      return;
    }

    const projectileX = this.currentProjectile.sprite.x;
    const projectileY = this.currentProjectile.sprite.y;
    const projectileRadius = 8; // Same as physics body

    // Check distance to each target
    for (const target of this.targets) {
      if (target.hit) continue;

      const targetX = target.fixedX;
      const targetY = target.fixedY;
      const targetRadius = target.graphic.radius;

      // Calculate distance between centers
      const dx = projectileX - targetX;
      const dy = projectileY - targetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if projectile is within target radius
      if (distance <= targetRadius + projectileRadius) {
        console.log('[HIT] Manual collision detected! Setting flags for deferred cleanup.');
        // Set flags but don't handle collision here - defer to next frame
        this.currentProjectile.hasCollided = true;
        this.currentProjectile.shouldDestroy = true;
        // Process the hit in the collision handler called via delayedCall
        this.time.delayedCall(1, () => {
          this.handleTargetHit(target);
        });
        return; // Exit after first hit
      }
    }
  }

  private startCountdown(): void {
    this.countdownActive = true;
    let countdown = 3;
    
    const width = this.scale.width;
    const height = this.scale.height;
    
    const countdownText = this.add.text(
      width / 2,
      height / 2,
      countdown.toString(),
      {
        fontSize: '120px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }
    );
    countdownText.setOrigin(0.5);
    countdownText.setDepth(300);
    countdownText.setAlpha(0);
    
    // Initial fade in
    this.tweens.add({
      targets: countdownText,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 300,
      ease: 'Cubic.easeOut',
    });
    
    this.time.addEvent({
      delay: 1000,
      repeat: 3,
      callback: () => {
        if (countdown > 0) {
          // Pulse and fade out current number
          this.tweens.add({
            targets: countdownText,
            scale: 1.2,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              countdown--;
              if (countdown > 0) {
                // Show next number
                countdownText.setText(countdown.toString());
                this.tweens.add({
                  targets: countdownText,
                  alpha: 1,
                  scale: { from: 0.5, to: 1 },
                  duration: 300,
                  ease: 'Cubic.easeOut',
                });
              } else {
                // Show "START!" and begin game
                countdownText.setText('START!');
                countdownText.setStyle({ color: '#00FF00' });
                this.tweens.add({
                  targets: countdownText,
                  alpha: 1,
                  scale: { from: 0.5, to: 1.2 },
                  duration: 400,
                  ease: 'Cubic.easeOut',
                  onComplete: () => {
                    this.tweens.add({
                      targets: countdownText,
                      alpha: 0,
                      scale: 1.5,
                      duration: 500,
                      ease: 'Cubic.easeIn',
                      onComplete: () => {
                        countdownText.destroy();
                        this.countdownActive = false;
                        this.startRound();
                      },
                    });
                  },
                });
              }
            },
          });
        }
      },
    });
  }

  private startRound(): void {
    this.targetsInRound = this.currentRound;
    this.targetsRemainingInRound = this.targetsInRound;
    this.targetsSpawnedInRound = 0;
    this.roundComplete = false;
    this.sequenceActive = true;
    this.hitsInSequence = 0;
    this.missesInSequence = 0;
    this.shotsInCurrentSequence = 0;
    
    // Clear any pending transaction feedback
    this.clearPowderTransactionFeedback();
    
    // BONUS MODE PERSISTENCE: Do NOT reset bonus counters at sequence start
    // Only reset sequence-specific counters, let bonus mode persist across sequences
    console.log('[SEQUENCE] New sequence started - bonus mode counters preserved');

    // NOTE: Do NOT reset streak here - it's already reset in resetStreakBeforeCountdown()
    // called before the countdown begins

    // Clear any existing targets
    this.targets.forEach(target => this.removeTarget(target));
    this.targets = [];

    // CRITICAL: Enable input after countdown completes
    // NOTE: clearJoypadState() sets slingshotEnabled = false
    // This MUST be re-enabled by startRound() countdown logic
    // Do NOT remove this re-enablement or input will be permanently blocked
    this.slingshotEnabled = true;
    console.log('[INPUT] New sequence started, slingshot enabled and ready for input');

    this.updateRoundText();
    this.updateSequenceProgressText();
    
    // Ensure multiplier display is hidden at sequence start
    this.refreshMultiplierDisplay();
    
    if (!this.firstSequenceStarted) {
      this.firstSequenceStarted = true;
    }
    
    // Start the continuous sequence
    this.startContinuousSequence();
  }

  private startContinuousSequence(): void {
    // Spawn first target immediately
    this.spawnNextTargetInSequence();
    
    // Set up automatic spawning for remaining targets
    if (this.sequenceTimer) {
      this.sequenceTimer.remove();
    }
    
    this.sequenceTimer = this.time.addEvent({
      delay: GAME_SETTINGS.TARGET_SPAWN_DELAY,
      repeat: this.targetsInRound - 1, // Already spawned first one
      callback: () => {
        this.spawnNextTargetInSequence();
      },
    });
  }

  private spawnNextTargetInSequence(): void {
    if (this.targetsSpawnedInRound >= this.targetsInRound) {
      return;
    }

    this.spawnTarget();
    this.targetsSpawnedInRound++;
    this.updateSequenceProgressText();
  }

  private findValidCirclePosition(screenWidth: number, screenHeight: number, radius: number): { x: number; y: number } {
    const minY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MIN;
    const maxY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MAX;

    // Random attempts
    for (let attempt = 0; attempt < CIRCLE_SPACING.MAX_POSITIONING_ATTEMPTS; attempt++) {
      const x = CIRCLE_SPACING.SCREEN_PADDING + Math.random() * (screenWidth - 2 * CIRCLE_SPACING.SCREEN_PADDING);
      const y = minY + Math.random() * (maxY - minY);
      
      if (this.isValidCirclePosition(x, y, radius, CIRCLE_SPACING.MIN_CIRCLE_DISTANCE)) {
        const nearestDistance = this.getDistanceToNearestNeighbor(x, y);
        console.log(`[CIRCLE] Valid position found on attempt ${attempt + 1}: (${x.toFixed(0)}, ${y.toFixed(0)}), nearest neighbor: ${nearestDistance.toFixed(0)}px`);
        return { x, y };
      }
    }

    // Fallback: use deterministic horizontal slot positioning with validation
    console.log(`[CIRCLE] Using fallback position after ${CIRCLE_SPACING.MAX_POSITIONING_ATTEMPTS} attempts`);
    const usableWidth = screenWidth - 2 * CIRCLE_SPACING.SCREEN_PADDING;
    const numSlots = this.targetsInRound;
    const slotWidth = usableWidth / numSlots;

    // Try each slot position with validation
    for (let slotIndex = 0; slotIndex < numSlots; slotIndex++) {
      const candidateX = CIRCLE_SPACING.SCREEN_PADDING + (slotIndex * slotWidth) + (slotWidth / 2);
      const candidateY = minY + (maxY - minY) / 2;
      
      if (this.isValidCirclePosition(candidateX, candidateY, radius, CIRCLE_SPACING.MIN_CIRCLE_DISTANCE)) {
        const clampedX = Phaser.Math.Clamp(candidateX, CIRCLE_SPACING.SCREEN_PADDING + radius, screenWidth - CIRCLE_SPACING.SCREEN_PADDING - radius);
        const clampedY = Phaser.Math.Clamp(candidateY, minY + radius, maxY - radius);
        const nearestDistance = this.getDistanceToNearestNeighbor(clampedX, clampedY);
        console.log(`[CIRCLE] Fallback slot ${slotIndex + 1}/${numSlots} valid, position: (${clampedX.toFixed(0)}, ${clampedY.toFixed(0)}), nearest neighbor: ${nearestDistance.toFixed(0)}px`);
        return { x: clampedX, y: clampedY };
      }
    }

    // Final safeguard: place at center if all positions fail
    console.log(`[CIRCLE] FALLBACK FAILED: No valid position found in ${numSlots} slots, placing at center`);
    const centerX = screenWidth / 2;
    const centerY = (minY + maxY) / 2;
    const clampedX = Phaser.Math.Clamp(centerX, CIRCLE_SPACING.SCREEN_PADDING + radius, screenWidth - CIRCLE_SPACING.SCREEN_PADDING - radius);
    const clampedY = Phaser.Math.Clamp(centerY, minY + radius, maxY - radius);
    const nearestDistance = this.getDistanceToNearestNeighbor(clampedX, clampedY);
    console.log(`[CIRCLE] Emergency center placement: (${clampedX.toFixed(0)}, ${clampedY.toFixed(0)}), nearest neighbor: ${nearestDistance.toFixed(0)}px`);
    return { x: clampedX, y: clampedY };
  }

  private getDistanceToNearestNeighbor(x: number, y: number): number {
    let minDistance = Infinity;
    for (const target of this.targets) {
      const dx = x - target.fixedX;
      const dy = y - target.fixedY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);
    }
    return minDistance === Infinity ? 0 : minDistance;
  }

  private isValidCirclePosition(x: number, y: number, radius: number, minDistance: number): boolean {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    // Check horizontal bounds with padding
    if (x - radius < CIRCLE_SPACING.SCREEN_PADDING || x + radius > screenWidth - CIRCLE_SPACING.SCREEN_PADDING) {
      return false;
    }

    // Check vertical bounds - must be in spawn height band
    const minY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MIN;
    const maxY = screenHeight * CIRCLE_SPACING.SPAWN_HEIGHT_MAX;
    if (y - radius < minY || y + radius > maxY) {
      return false;
    }

    // Check distance from other circles (center-to-center minus radii)
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

  private spawnTarget(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const initialRadius = 60;
    const lifetime = 5000;

    // Find valid circle position with proper spacing
    const validPosition = this.findValidCirclePosition(width, height, initialRadius);
    const fixedX = validPosition.x;
    const fixedY = validPosition.y;

    const sprite = this.physics.add.sprite(fixedX, fixedY, '');
    sprite.setDisplaySize(0, 0);
    sprite.setVisible(false);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(initialRadius);
    body.setAllowGravity(false);
    body.setImmovable(true);

    const graphic = this.add.circle(fixedX, fixedY, initialRadius, TARGET_COLORS.RED);
    graphic.setStrokeStyle(3, COLORS.WHITE, 0.8);
    graphic.setDepth(10);

    const ring = this.add.circle(fixedX, fixedY, initialRadius + 8, 0x00000000);
    ring.setStrokeStyle(3, TARGET_COLORS.RED, 0.7);
    ring.setDepth(9);

    const targetData: TargetData = {
      sprite,
      graphic,
      ring,
      startTime: this.time.now,
      lifetime,
      initialRadius,
      hit: false,
      missTriggered: false,
      fixedX,
      fixedY,
      baseReward: POWDER_REWARDS.RED, // Starts as red with +1 reward
    };

    this.targets.push(targetData);

    // Create reward display inside the circle
    this.spawnRewardDisplay(targetData);

    // DO NOT set up overlap here - it will be handled in launchProjectile()
    // This prevents duplicate collision handlers which cause freezes
  }

  private spawnRewardDisplay(circle: TargetData): void {
    const baseReward = circle.baseReward;

    const rewardDisplay = this.add.text(
      circle.fixedX,
      circle.fixedY,
      `+${baseReward}`,
      {
        fontSize: '32px',
        color: '#ffff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center'
      }
    ).setOrigin(0.5, 0.5);

    rewardDisplay.setDepth(15);

    this.rewardDisplays.set(circle, rewardDisplay);

    console.log(`[CIRCLE] Spawned at (${circle.fixedX.toFixed(0)}, ${circle.fixedY.toFixed(0)}) with base reward: +${baseReward} radius: ${circle.initialRadius}`);
  }

  private updateRewardDisplay(): void {
    this.rewardDisplays.forEach((rewardDisplay, circle) => {
      if (!rewardDisplay.active || !circle.graphic.active) {
        // Clean up orphaned displays
        this.rewardDisplays.delete(circle);
        try {
          rewardDisplay.destroy();
        } catch (_e) {
          // Ignore destruction errors
        }
        return;
      }

      // Determine current base reward based on circle color
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
      
      // Update circle's base reward
      circle.baseReward = baseReward;
      
      // Update display text to show current base reward
      rewardDisplay.setText(`+${baseReward}`);

      // Position at circle center
      rewardDisplay.setPosition(circle.fixedX, circle.fixedY);

      // Keep constant size and alpha - don't scale or fade
    });
  }

  private removeRewardDisplay(circle: TargetData): void {
    const rewardDisplay = this.rewardDisplays.get(circle);
    if (rewardDisplay) {
      try {
        rewardDisplay.destroy();
      } catch (_e) {
        // Ignore destruction errors
      }
      this.rewardDisplays.delete(circle);
    }
  }

  private createRewardDisplay(circle: TargetData, rewardAmount: number): void {
    // Remove base reward display if it exists
    this.removeRewardDisplay(circle);
    
    // Create actual reward display showing multiplied amount
    const rewardDisplay = this.add.text(
      circle.fixedX,
      circle.fixedY,
      `+${rewardAmount}`,
      {
        fontSize: '32px',
        color: '#FFD700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center'
      }
    ).setOrigin(0.5, 0.5);
    
    rewardDisplay.setDepth(20); // Above hit text
    
    // Animate growing and fading
    this.tweens.add({
      targets: rewardDisplay,
      scale: {from: 0.5, to: 1.5},
      alpha: {from: 1, to: 0},
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        try {
          rewardDisplay.destroy();
        } catch (_e) {
          // Ignore destruction errors
        }
      }
    });
    
    console.log(`[REWARD] Displaying actual reward +${rewardAmount} (base: +${circle.baseReward}) at circle center (${circle.fixedX}, ${circle.fixedY})`);
  }

  private updateTargets(): void {
    const now = this.time.now;

    this.targets.forEach((targetData) => {
      if (targetData.hit) return;

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

      if (this.currentProjectile && !this.currentProjectile.fadingOut) {
        this.currentProjectile.targetColor = color;
        this.currentProjectile.ring.setStrokeStyle(3, color, 0.7);
      }

      const alpha = Phaser.Math.Clamp(timeRemaining * 1.5, 0, 1);
      targetData.graphic.setAlpha(alpha);
      targetData.ring.setAlpha(alpha * 0.8);

      if (progress >= 1) {
        if (!targetData.missTriggered) {
          targetData.missTriggered = true;
          this.handleTargetMiss(targetData);
        }
      }
    });

    this.targets = this.targets.filter((target) => target.graphic.active);

    // Update reward displays
    this.updateRewardDisplay();
  }

  private handleTargetMiss(targetData: TargetData): void {
    const x = targetData.fixedX;
    const y = targetData.fixedY;

    // Handle miss mechanics (reset streaks/bonus)
    this.onMiss();

    // Fade out reward display when circle is missed
    const rewardDisplay = this.rewardDisplays.get(targetData);
    if (rewardDisplay) {
      this.tweens.add({
        targets: rewardDisplay,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.removeRewardDisplay(targetData);
        }
      });
    }

    const missText = this.add.text(x, y, 'MISS', {
      fontSize: '32px',
      color: '#e74c3c',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    });
    missText.setOrigin(0.5);
    missText.setDepth(100);

    this.tweens.add({
      targets: missText,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => missText.destroy(),
    });

    this.removeTarget(targetData);
    this.targetsRemainingInRound--;
    this.missesInSequence++;
  }

  private createProjectile(x: number, y: number): void {
    if (this.powder <= 0) {
      return;
    }

    console.log(`[SHOOT-DEBUG] Creating projectile at (${x}, ${y})`);

    if (!this.textures.exists('projectile-arrow')) {
      const graphics = this.add.graphics();
      
      // Create arrow as line with prominent arrowhead
      // Arrow body (shaft)
      graphics.fillStyle(COLORS.PROJECTILE, 1);
      graphics.fillRect(0, 14, 30, 4); // Horizontal shaft
      
      // Arrowhead (triangle)
      graphics.beginPath();
      graphics.moveTo(30, 8);  // Top of arrowhead
      graphics.lineTo(42, 16); // Tip of arrow (pointing right)
      graphics.lineTo(30, 24); // Bottom of arrowhead
      graphics.lineTo(30, 8);  // Back to top
      graphics.closePath();
      graphics.fillPath();
      
      // Add white outline for visibility
      graphics.lineStyle(2, COLORS.WHITE, 0.8);
      graphics.strokeRect(0, 14, 30, 4);
      graphics.beginPath();
      graphics.moveTo(30, 8);
      graphics.lineTo(42, 16);
      graphics.lineTo(30, 24);
      graphics.lineTo(30, 8);
      graphics.strokePath();
      
      graphics.generateTexture('projectile-arrow', 44, 32);
      graphics.destroy();
    }

    this.ensureTrailTexture();

    const sprite = this.physics.add.sprite(x, y, 'projectile-arrow');
    console.log(`[SHOOT-DEBUG] Sprite created at (${sprite.x.toFixed(2)}, ${sprite.y.toFixed(2)})`);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setBounce(0.2);
    body.setCircle(8);
    body.setMass(0.5);
    body.setAllowGravity(false);
    console.log('[PHYSICS] Projectile initialized with gravity disabled for aiming phase');

    sprite.setDepth(60);

    const ring = this.add.circle(x, y, 25, 0x00000000);
    ring.setStrokeStyle(3, TARGET_COLORS.RED, 0.7);
    ring.setDepth(59);

    this.currentProjectile = {
      sprite,
      ring,
      targetColor: TARGET_COLORS.RED,
      fadingOut: false,
      hasCollided: false,
      shouldDestroy: false,
    };

    this.createTrailEmitter(this.currentProjectile);
    console.log('[SHOOT-DEBUG] Projectile ready for aiming');
  }

  private ensureTrailTexture(): void {
    if (!this.textures.exists('trail-particle')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x888888, 1);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture('trail-particle', 4, 4);
      graphics.destroy();
    }
  }

  private createTrailEmitter(projectile: ProjectileData): void {
    if (!projectile) {
      return;
    }

    this.ensureTrailTexture();

    const emitter = this.add.particles(projectile.sprite.x, projectile.sprite.y, 'trail-particle', {
      speed: 0,
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 300,
      frequency: 50,
      blendMode: 'NORMAL',
    });

    emitter.setDepth(58);
    emitter.stop();
    projectile.particles = emitter;
    console.log('[PARTICLES] Grey trail particle emitter created (subtle, 300ms lifespan)');
  }

  private startTrailEmitter(projectile: ProjectileData): void {
    if (!projectile) {
      return;
    }

    if (!projectile.particles) {
      this.createTrailEmitter(projectile);
    }

    const emitter = projectile.particles;
    if (!emitter) {
      return;
    }

    emitter.setPosition(projectile.sprite.x, projectile.sprite.y);
    emitter.emitParticleAt(projectile.sprite.x, projectile.sprite.y);
    emitter.start();
    console.log('[PARTICLES] Trail started');
  }

  private stopTrailEmitter(projectile: ProjectileData, reason: string = 'cleanup'): void {
    if (!projectile.particles) {
      return;
    }

    const emitter = projectile.particles;
    projectile.particles = undefined;

    try {
      emitter.stop();
    } catch (error) {
      console.log('[PARTICLES] Error stopping trail emitter:', error);
    }

    try {
      emitter.destroy();
      console.log(`[PARTICLES] Trail stopped (${reason})`);
    } catch (error) {
      console.log('[PARTICLES] Error destroying trail emitter:', error);
    }
  }

  private setupInput(): void {
    this.input.removeAllListeners();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    
    this.slingshotEnabled = true;
    console.log('[INPUT] Input handlers registered, slingshot enabled');
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    console.log('[INPUT] Pointer down event fired at', pointer.x, pointer.y);
    
    // Basic checks only - don't block input unnecessarily
    if (!this.slingshotEnabled) {
      console.log('[INPUT] BLOCKED: slingshotEnabled is false');
      return;
    }

    if (this.gameOver || this.roundComplete) {
      console.log('[INPUT] BLOCKED: gameOver or roundComplete');
      return;
    }

    if (this.isDragging) {
      console.log('[INPUT] BLOCKED: Already dragging');
      return;
    }

    console.log('[JOYPAD-DEBUG] Creating joypad, NOT launching (pointer down only)');
    const baseRadius = JOYPAD_BASE_RADIUS;
    const screenWidth = this.scale.width;
    
    // X from click, Y locked to ground
    const joypadX = Phaser.Math.Clamp(pointer.x, baseRadius, screenWidth - baseRadius);
    const joypadY = this.cameras.main.height - 120; // FIXED ground level
    
    console.log(`[JOYPAD] Positioning at (${joypadX}, ${joypadY})`);
    
    this.dragStartX = pointer.x;
    this.dragStartY = joypadY; // Store ground level Y, not click Y
    
    console.log(`[JOYPAD] Creating joypad at (${joypadX}, ${joypadY})`);
    console.log(`[DRAG-START] Stored at (${this.dragStartX}, ${this.dragStartY})`);

    this.isDragging = true;
    this.activePointer = pointer;
    this.snappedVelocity = undefined;

    this.createJoypad(joypadX, joypadY);
    this.createProjectile(joypadX, joypadY);
    
    console.log('[JOYPAD-DEBUG] Joypad and projectile created for aiming, awaiting drag/release');

    if (this.joypad) {
      const pointerWithSetter = pointer as Phaser.Input.Pointer & {
        setPosition?: (x: number, y: number) => void;
      };
      pointerWithSetter.setPosition?.(this.joypad.centerX, this.joypad.centerY);
      pointer.prevPosition.set(this.joypad.centerX, this.joypad.centerY);

      this.pointerOffsetX = this.joypad.centerX - pointer.x;
      this.pointerOffsetY = this.joypad.centerY - pointer.y;

      this.updateJoypad(this.joypad.centerX, this.joypad.centerY);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.joypad || !this.currentProjectile) {
      return;
    }

    if (this.activePointer && pointer.id !== this.activePointer.id) {
      return;
    }

    console.log('[JOYPAD-DEBUG] Drag detected, updating trajectory preview');

    const adjustedX = pointer.x + this.pointerOffsetX;
    const adjustedY = pointer.y + this.pointerOffsetY;

    this.updateJoypad(adjustedX, adjustedY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) {
      return;
    }

    if (this.activePointer && pointer.id !== this.activePointer.id) {
      return;
    }

    console.log('[JOYPAD-DEBUG] Release detected, attempting to launch projectile');

    const waitingForSequence = this.countdownActive && !this.sequenceActive;

    if (!this.joypad || !this.currentProjectile || waitingForSequence) {
      console.log('[JOYPAD-DEBUG] Launch cancelled (missing joypad/projectile or waiting for sequence)');
      this.destroyJoypad();
      this.prepareNextShot();
      this.resetDragState();
      return;
    }

    const joypadX = this.joypad.centerX;
    const joypadY = this.joypad.centerY;
    console.log(`[JOYPAD-POSITION] Joypad at (${joypadX.toFixed(2)}, ${joypadY.toFixed(2)})`);
    console.log(
      `[DRAG-VECTOR] Drag distance: (${this.joypad.offsetX.toFixed(2)}, ${this.joypad.offsetY.toFixed(2)})`
    );

    const launched = this.launchProjectile();
    
    if (launched) {
      console.log('[JOYPAD-DEBUG] Projectile launched successfully');
    } else {
      console.log('[JOYPAD-DEBUG] Launch failed');
    }
    
    // Clear joypad UI immediately after shot
    this.destroyJoypad();

    if (!launched) {
      this.prepareNextShot();
    }

    this.resetDragState();
  }

  private clearDragPointerData(): void {
    this.activePointer = undefined;
    this.pointerOffsetX = 0;
    this.pointerOffsetY = 0;
  }

  private clearJoypadState(): void {
    // Check if already cleared
    if (!this.joypad && !this.isDragging) {
      console.log('[INPUT] Joypad already cleared, skipping');
      return;
    }

    console.log('[INPUT] Clearing joypad state');
    
    try {
      // Destroy joypad container
      if (this.joypad) {
        this.destroyJoypad();
        console.log('[INPUT] Joypad container destroyed');
      }
      
      // Call prepareNextShot to clean any pre-launch projectile
      this.prepareNextShot();
      
      // Reset drag tracking
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.isDragging = false;
      
      // Clear snapped velocity
      this.snappedVelocity = undefined;
      
      // Disable slingshot until countdown re-enables it
      this.slingshotEnabled = false;
      console.log('[INPUT] Slingshot disabled until next countdown');
      
      console.log('[INPUT] Joypad state cleared successfully');
    } catch (error) {
      console.error('[INPUT] Error clearing joypad state:', error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      // Ensure safe state even if error occurs
      this.joypad = undefined;
      this.isDragging = false;
      this.slingshotEnabled = false;
      this.snappedVelocity = undefined;
    }
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.clearDragPointerData();
    this.dragStartX = 0;
    this.dragStartY = 0;
  }

  private enableSlingshot(): void {
    this.slingshotEnabled = true;
    console.log('[INPUT] Slingshot ENABLED');
  }

  private createJoypad(x: number, centerY: number): void {
    const container = this.add.container(0, 0);

    const base = this.add.circle(x, centerY, JOYPAD_BASE_RADIUS, COLORS.WHITE, 0.22);
    base.setStrokeStyle(3, COLORS.WHITE, 0.55);

    const knob = this.add.circle(x, centerY, JOYPAD_KNOB_RADIUS, COLORS.PRIMARY, 0.72);
    knob.setStrokeStyle(3, COLORS.WHITE, 0.9);

    const powerLine = this.add.graphics();
    const trajectoryLine = this.add.graphics();

    container.add([base, powerLine, trajectoryLine, knob]);
    container.setDepth(55);

    this.joypad = {
      container,
      base,
      knob,
      powerLine,
      trajectoryLine,
      centerX: x,
      centerY,
      offsetX: 0,
      offsetY: 0,
    };

    if (this.currentProjectile) {
      this.currentProjectile.sprite.setPosition(x, centerY);
      this.currentProjectile.ring.setPosition(x, centerY);
    }
  }

  private updateJoypad(pointerX: number, pointerY: number): void {
    if (!this.joypad || !this.currentProjectile) return;

    const dx = pointerX - this.joypad.centerX;
    const dy = pointerY - this.joypad.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 120;

    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);

    const offsetX = Math.cos(angle) * clampedDistance;
    const offsetY = Math.sin(angle) * clampedDistance;

    this.joypad.knob.setPosition(this.joypad.centerX + offsetX, this.joypad.centerY + offsetY);
    this.joypad.offsetX = offsetX;
    this.joypad.offsetY = offsetY;

    if (this.currentProjectile) {
      this.currentProjectile.sprite.setPosition(this.joypad.centerX, this.joypad.centerY);
      this.currentProjectile.ring.setPosition(this.joypad.centerX, this.joypad.centerY);

      // Rotate arrow to point in drag direction (opposite of offset)
      const aimAngle = Math.atan2(-offsetY, -offsetX);
      this.currentProjectile.sprite.setRotation(aimAngle);
    }

    // Calculate power ratio for variable thickness
    const dragDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const minDrag = INPUT_THRESHOLDS.DRAG_MIN_DISTANCE;
    const maxDrag = maxDistance;
    const powerRatio = Math.max(0, Math.min(1, (dragDistance - minDrag) / (maxDrag - minDrag)));
    
    // Interpolate power line thickness from 2px to 6px
    const basePowerLineWidth = 2 + powerRatio * 4;

    this.joypad.powerLine.clear();
    this.joypad.powerLine.lineStyle(basePowerLineWidth, COLORS.PRIMARY, 0.6);
    this.joypad.powerLine.beginPath();
    this.joypad.powerLine.moveTo(this.joypad.centerX, this.joypad.centerY);
    this.joypad.powerLine.lineTo(this.joypad.knob.x, this.joypad.knob.y);
    this.joypad.powerLine.strokePath();

    this.drawTrajectoryPreview();
  }

  private drawTrajectoryPreview(): void {
    if (!this.joypad || !this.currentProjectile) return;

    this.joypad.trajectoryLine.clear();

    const dragDistance = Math.sqrt(
      this.joypad.offsetX * this.joypad.offsetX +
        this.joypad.offsetY * this.joypad.offsetY
    );

    if (dragDistance <= INPUT_THRESHOLDS.DRAG_MIN_DISTANCE) {
      return;
    }

    // Calculate power ratio for variable thickness
    const minDrag = INPUT_THRESHOLDS.DRAG_MIN_DISTANCE;
    const maxDrag = 120; // Joystick max distance
    const powerRatio = Math.max(0, Math.min(1, (dragDistance - minDrag) / (maxDrag - minDrag)));

    const velocityMultiplier = 6.5;
    let vx = -this.joypad.offsetX * velocityMultiplier;
    let vy = -this.joypad.offsetY * velocityMultiplier;

    const gravity = this.physics.world.gravity.y;
    const timeStep = 0.05;
    const maxSteps = 60;

    // Calculate trajectory points for snap detection
    const trajectoryPoints: { x: number; y: number }[] = [];
    let px = this.joypad.centerX;
    let py = this.joypad.centerY;
    let testVy = vy;

    for (let i = 0; i < maxSteps; i++) {
      px += vx * timeStep;
      py += testVy * timeStep;
      testVy += gravity * timeStep;
      trajectoryPoints.push({ x: px, y: py });

      if (px < 0 || px > this.scale.width || py > this.scale.height) {
        break;
      }
    }

    // Find nearest target to trajectory
    let nearestTarget: TargetData | undefined = undefined;
    let minDistance = Number.MAX_VALUE;
    const snapThreshold = 100; // Distance threshold for snapping

    this.targets.forEach(target => {
      if (target.hit) return;

      // Check distance from trajectory points to target center
      for (const point of trajectoryPoints) {
        const dist = Math.sqrt(
          Math.pow(point.x - target.fixedX, 2) +
          Math.pow(point.y - target.fixedY, 2)
        );

        if (dist < minDistance) {
          minDistance = dist;
          nearestTarget = target;
        }
      }
    });

    // Apply trajectory snapping if near a target
    let isSnapped = false;
    let snappedTargetData: TargetData | null = null;
    
    if (nearestTarget && minDistance < snapThreshold) {
      const target: TargetData = nearestTarget;
      isSnapped = true;
      snappedTargetData = target;
      
      // Calculate velocity needed to reach the target
      const targetX = target.fixedX;
      const targetY = target.fixedY;
      const startX = this.joypad.centerX;
      const startY = this.joypad.centerY;

      // Calculate adjusted trajectory to hit target
      const dx = targetX - startX;
      const dy = targetY - startY;
      
      // Simple trajectory adjustment - aim toward target center
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeToTarget = distance / (velocityMultiplier * dragDistance * 0.05);
      
      const adjustedVx = dx / (timeToTarget * timeStep);
      const adjustedVy = (dy - 0.5 * gravity * timeToTarget * timeToTarget * timeStep * timeStep) / (timeToTarget * timeStep);
      
      // Blend original trajectory with adjusted trajectory for smooth snapping
      const snapStrength = 0.4;
      vx = vx * (1 - snapStrength) + adjustedVx * snapStrength;
      vy = vy * (1 - snapStrength) + adjustedVy * snapStrength;
      
      // Store snapped velocity for launch
      this.snappedVelocity = { vx, vy };
    } else {
      // Clear snapped velocity if not snapping
      this.snappedVelocity = undefined;
    }

    // Draw trajectory with visual feedback for snapping
    px = this.joypad.centerX;
    py = this.joypad.centerY;
    let drawVy = vy;

    const lineColor = isSnapped ? 0x00ff00 : COLORS.WARNING;
    const lineAlpha = isSnapped ? 0.7 : 0.45;
    
    // Interpolate base trajectory thickness from 2px to 6px based on power
    const baseLineWidth = 2 + powerRatio * 4;
    // Add +1px when snapped for visual distinction
    const lineWidth = isSnapped ? baseLineWidth + 1 : baseLineWidth;
    
    console.log(`[JOYPAD-DEBUG] Trajectory width: ${lineWidth.toFixed(2)}px (power: ${(powerRatio * 100).toFixed(0)}%, snapped: ${isSnapped})`);

    this.joypad.trajectoryLine.lineStyle(lineWidth, lineColor, lineAlpha);
    this.joypad.trajectoryLine.beginPath();
    this.joypad.trajectoryLine.moveTo(px, py);

    // Draw trajectory but stop at circle boundary if aiming at a target
    let trajectoryLength = maxSteps;
    if (isSnapped && snappedTargetData) {
      // Find where trajectory intersects circle boundary
      let testPx = this.joypad.centerX;
      let testPy = this.joypad.centerY;
      let testVy = vy;
      
      for (let i = 0; i < maxSteps; i++) {
        testPx += vx * timeStep;
        testPy += testVy * timeStep;
        testVy += gravity * timeStep;
        
        const distToCenter = Math.sqrt(
          Math.pow(testPx - snappedTargetData.fixedX, 2) +
          Math.pow(testPy - snappedTargetData.fixedY, 2)
        );
        
        if (distToCenter <= snappedTargetData.graphic.radius) {
          trajectoryLength = i;
          break;
        }
      }
    }

    for (let i = 0; i < trajectoryLength; i++) {
      px += vx * timeStep;
      py += drawVy * timeStep;
      drawVy += gravity * timeStep;

      this.joypad.trajectoryLine.lineTo(px, py);

      if (px < 0 || px > this.scale.width || py > this.scale.height) {
        break;
      }
    }

    this.joypad.trajectoryLine.strokePath();

    // Draw snap indicator if snapped to target
    if (isSnapped && snappedTargetData) {
      this.joypad.trajectoryLine.lineStyle(2, 0x00ff00, 0.5);
      this.joypad.trajectoryLine.strokeCircle(snappedTargetData.fixedX, snappedTargetData.fixedY, snappedTargetData.graphic.radius + 15);
    }
  }

  private destroyJoypad(): void {
    if (!this.joypad) return;

    const { container, powerLine, trajectoryLine } = this.joypad;

    if (powerLine.scene) {
      powerLine.clear();
    }

    if (trajectoryLine.scene) {
      trajectoryLine.clear();
    }

    try {
      if (container.scene) {
        container.destroy(true);
      } else {
        container.destroy();
      }
    } catch (_error) {
      // Ignore cleanup errors when tearing down joypad
    }

    this.joypad = undefined;
    this.clearDragPointerData();
  }

  private launchProjectile(): boolean {
    if (!this.currentProjectile || !this.joypad) {
      return false;
    }

    const dragDistance = Math.sqrt(
      this.joypad.offsetX * this.joypad.offsetX +
        this.joypad.offsetY * this.joypad.offsetY
    );

    if (dragDistance < INPUT_THRESHOLDS.DRAG_MIN_DISTANCE) {
      return false;
    }

    // Cost per shot scales with position in sequence (1st shot = 1 powder, 2nd = 2 powder, etc.)
    const nextShotCost = this.shotsInCurrentSequence + 1;
    
    // Check if player has enough powder for next shot
    if (this.powder < nextShotCost) {
      console.log('[INPUT] Insufficient powder for shot. Have:', this.powder, 'Need:', nextShotCost);
      this.triggerGameOver();
      return false;
    }

    const spawnX = this.joypad.centerX;
    const spawnY = this.joypad.centerY;

    this.currentProjectile.sprite.setPosition(spawnX, spawnY);
    this.currentProjectile.ring.setPosition(spawnX, spawnY);

    console.log(`[SHOOT-DEBUG] Launching projectile from (${spawnX.toFixed(2)}, ${spawnY.toFixed(2)})`);

    let velocityX: number;
    let velocityY: number;
    let velocitySource = 'drag';

    // Use snapped velocity if available, otherwise use manual aim
    if (this.snappedVelocity) {
      velocityX = this.snappedVelocity.vx;
      velocityY = this.snappedVelocity.vy;
      velocitySource = 'snapped';
      console.log(
        `[VELOCITY] Using snapped velocity override: (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`
      );
      this.snappedVelocity = undefined;
    } else {
      const velocityMultiplier = 6.5;
      velocityX = -this.joypad.offsetX * velocityMultiplier;
      velocityY = -this.joypad.offsetY * velocityMultiplier;
      console.log(`[VELOCITY] Drag vector scaled with multiplier ${velocityMultiplier.toFixed(2)}`);
    }

    console.log(
      `[VELOCITY] Launch velocity (${velocitySource}): (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`
    );

    if (!this.currentProjectile) {
      return false;
    }

    const body = this.currentProjectile.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    console.log('[PHYSICS] Gravity enabled for projectile');

    body.setVelocity(velocityX, velocityY);
    console.log(
      `[PHYSICS-CHECK] Body velocity: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)})`
    );
    console.log(
      `[PHYSICS-CHECK] Body position: (${body.x.toFixed(2)}, ${body.y.toFixed(2)})`
    );
    console.log(
      `[PHYSICS-CHECK] Acceleration: (${body.acceleration.x.toFixed(2)}, ${body.acceleration.y.toFixed(2)})`
    );

    // Rotate arrow to point in direction of travel
    const angle = Math.atan2(velocityY, velocityX);
    this.currentProjectile.sprite.setRotation(angle);

    this.startTrailEmitter(this.currentProjectile);

    if (!this.currentProjectile) {
      return false;
    }

    // CRITICAL: Capture projectile reference for collision callbacks (will be moved to activeProjectiles)
    const launchedProjectile = this.currentProjectile;

    // Set up ground collision with callback to trigger fade immediately
    this.physics.add.collider(launchedProjectile.sprite, this.ground, () => {
      // Ground collision - mark for destruction
      if (!launchedProjectile.fadingOut && !launchedProjectile.shouldDestroy) {
        console.log('[GROUND-FADE] Ground collision detected for active projectile');
        launchedProjectile.fadingOut = true;
        launchedProjectile.shouldDestroy = true;
      }
    });

    // Set up overlap detection for all current targets
    this.targets.forEach((targetData) => {
      this.physics.add.overlap(launchedProjectile.sprite, targetData.sprite, () => {
        console.log('[COLLISION] Overlap detected with target');
        // CRITICAL: Only set flags here, don't destroy or modify physics
        if (launchedProjectile && !launchedProjectile.hasCollided && !targetData.hit) {
          console.log('[COLLISION] Setting hasCollided and shouldDestroy flags');
          launchedProjectile.hasCollided = true;
          launchedProjectile.shouldDestroy = true;
          // Queue hit handling for next frame (outside collision handler)
          this.time.delayedCall(1, () => {
            console.log('[COLLISION] Processing queued hit');
            this.handleTargetHit(targetData);
          });
        }
      });
    });

    // Increment shot counter for this sequence
    this.shotsInCurrentSequence++;
    
    // Cost per shot scales with position in sequence (1st shot = 1 powder, 2nd = 2 powder, 3rd = 3 powder, etc.)
    const shotCost = this.shotsInCurrentSequence;
    const oldPowder = this.powder;
    
    // Deduct powder and animate
    this.powder -= shotCost;
    this.displayPowderTransactionFeedback(shotCost, false);
    this.animatePowderCounter(oldPowder, this.powder, false);

    // CRITICAL FIX: Add projectile to active array and clear currentProjectile for concurrent shooting
    if (this.currentProjectile) {
      this.activeProjectiles.push(this.currentProjectile);
      console.log('[LAUNCH] Projectile added to active array. Total active:', this.activeProjectiles.length);
      
      // Clear currentProjectile immediately so next shot can be prepared
      this.currentProjectile = undefined;
    }

    return true;
  }

  private handleOffscreenProjectile(): void {
    console.log('[OFF-SCREEN] handleOffscreenProjectile called');
    
    if (!this.currentProjectile) {
      console.log('[OFF-SCREEN] No projectile to clean up');
      return;
    }

    const projectile = this.currentProjectile;

    if (projectile.fadingOut) {
      console.log('[OFF-SCREEN] Projectile already fading out, skipping');
      return;
    }

    if (projectile.shouldDestroy) {
      console.log('[OFF-SCREEN] Projectile already marked for destruction, skipping');
      return;
    }

    console.log('[OFF-SCREEN] Starting cleanup sequence - projectile position:', 
      projectile.sprite.x, projectile.sprite.y);

    try {
      // Mark as fading out IMMEDIATELY to prevent re-entry
      projectile.fadingOut = true;

      const sprite = projectile.sprite;

      let missX = this.scale.width / 2;
      let missY = this.scale.height / 2;

      if (sprite.x < 0) {
        missX = MISS_EDGE_PADDING;
      } else if (sprite.x > this.scale.width) {
        missX = this.scale.width - MISS_EDGE_PADDING;
      } else {
        missX = sprite.x;
      }

      if (sprite.y < 0) {
        missY = MISS_EDGE_PADDING;
      } else if (sprite.y > this.scale.height) {
        missY = this.scale.height - MISS_EDGE_PADDING;
      } else {
        missY = sprite.y;
      }

      const missText = this.add.text(missX, missY, 'MISS', {
        fontSize: '32px',
        color: '#e74c3c',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      });
      missText.setOrigin(0.5);
      missText.setDepth(100);

      this.tweens.add({
        targets: missText,
        y: missY - 60,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          try {
            missText.destroy();
          } catch (_e) {
            // Ignore destruction errors
          }
        },
      });

      this.missesInSequence++;

      // Handle miss mechanics (reset streaks/bonus)
      this.onMiss();

      // Stop physics IMMEDIATELY
      try {
        const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          console.log('[OFF-SCREEN] Stopping physics body');
          body.stop();
          body.setVelocity(0, 0);
          body.setAllowGravity(false);
          body.enable = false;
          body.world.remove(body);
        }
      } catch (error) {
        console.log('[OFF-SCREEN] Error stopping physics:', error);
      }

      this.stopTrailEmitter(projectile, 'offscreen-current');

      // Destroy sprite IMMEDIATELY (don't just hide it)
      console.log('[OFF-SCREEN] Destroying projectile and ring');
      try {
        sprite.destroy();
        projectile.ring.destroy();
      } catch (error) {
        console.log('[OFF-SCREEN] Error destroying objects:', error);
      }

      // Clear projectile reference IMMEDIATELY
      this.currentProjectile = undefined;
      console.log('[OFF-SCREEN] Projectile reference cleared');

      // Clear joypad and reset state
      this.destroyJoypad();
      this.resetDragState();
      
      // Re-enable slingshot for next shot
      this.enableSlingshot();
      
      console.log('[OFF-SCREEN] Cleanup complete, input re-enabled');
    } catch (error) {
      console.log('[OFF-SCREEN] Fatal error during cleanup:', error);
      // Failsafe: force cleanup if any error occurs
      try {
        this.currentProjectile = undefined;
        this.destroyJoypad();
        this.resetDragState();
        this.enableSlingshot();
      } catch (_e2) {
        // Last resort: just clear the reference
        this.currentProjectile = undefined;
      }
    }
  }

  private destroyProjectileOnGroundImpact(): void {
    console.log(`[GROUND-DIAGNOSTIC] destroyProjectileOnGroundImpact() CALLED`);
    
    if (!this.currentProjectile) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: currentProjectile is null`);
      return;
    }
    
    const projectile = this.currentProjectile;
    
    if (projectile.fadingOut) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: projectile already fading out`);
      return;
    }
    
    try {
      console.log(`[GROUND-DIAGNOSTIC] Setting fadingOut = true`);
      projectile.fadingOut = true;
      
      if (projectile.sprite) {
        console.log(`[GROUND-DIAGNOSTIC] Starting fade at (${projectile.sprite.x.toFixed(0)}, ${projectile.sprite.y.toFixed(0)})`);
      }
      
      // Register as miss immediately
      this.missesInSequence++;
      this.onMiss();
      
      // Create particle burst at impact location
      if (projectile.sprite) {
        const impactX = projectile.sprite.x;
        const impactY = projectile.sprite.y;
        this.createGroundImpactParticles(impactX, impactY);
      }
      
      // Stop physics immediately
      if (projectile.sprite) {
        try {
          const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
          if (body) {
            console.log(`[GROUND-DIAGNOSTIC] Stopping physics body`);
            body.stop();
            body.setVelocity(0, 0);
            body.setAllowGravity(false);
            body.enable = false;
            try {
              body.world.remove(body);
            } catch (_e) {
              // Ignore if already removed
            }
          }
        } catch (error) {
          console.log(`[GROUND-DIAGNOSTIC] Error stopping physics:`, error);
        }
      }
      
      console.log(`[GROUND-DIAGNOSTIC] Stopping particles`);
      this.stopTrailEmitter(projectile, 'ground-impact-current');
      
      // Fade out sprite and ring over 400ms
      if (projectile.sprite) {
        console.log(`[GROUND-DIAGNOSTIC] Starting 400ms fade animation`);
        this.tweens.add({
          targets: projectile.sprite,
          alpha: { from: 1, to: 0 },
          duration: 400,
          ease: 'Linear',
          onComplete: () => {
            console.log(`[GROUND-DIAGNOSTIC] Fade animation complete, calling completeProjectileDestruction()`);
            this.completeProjectileDestruction();
          }
        });
      }
      
      // Also fade ring
      if (projectile.ring) {
        this.tweens.add({
          targets: projectile.ring,
          alpha: { from: 1, to: 0 },
          duration: 400,
          ease: 'Linear'
        });
      }
      
      console.log(`[GROUND-DIAGNOSTIC] destroyProjectileOnGroundImpact() setup complete`);
      
    } catch (error) {
      console.error('[GROUND-DIAGNOSTIC] ERROR in destroyProjectileOnGroundImpact:', error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      // Failsafe cleanup
      try {
        if (projectile.sprite) projectile.sprite.destroy();
        if (projectile.ring) projectile.ring.destroy();
        this.stopTrailEmitter(projectile, 'ground-impact-current-failsafe');
        this.currentProjectile = undefined;
        this.slingshotEnabled = true;
      } catch (_e2) {
        // Last resort
      }
    }
  }

  private destroyActiveProjectileOnGroundImpact(projectile: ProjectileData, index: number): void {
    console.log(`[GROUND-DIAGNOSTIC] destroyActiveProjectileOnGroundImpact() CALLED for index ${index}`);
    
    if (!projectile) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: projectile is null`);
      return;
    }
    
    if (projectile.fadingOut) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: active projectile already fading out`);
      return;
    }
    
    try {
      console.log(`[GROUND-DIAGNOSTIC] Setting active projectile fadingOut = true`);
      projectile.fadingOut = true;
      
      if (projectile.sprite) {
        console.log(`[GROUND-DIAGNOSTIC] Starting fade for active projectile at (${projectile.sprite.x.toFixed(0)}, ${projectile.sprite.y.toFixed(0)})`);
      }
      
      // Register as miss immediately
      this.missesInSequence++;
      this.onMiss();
      
      // Create particle burst at impact location
      if (projectile.sprite) {
        const impactX = projectile.sprite.x;
        const impactY = projectile.sprite.y;
        this.createGroundImpactParticles(impactX, impactY);
      }
      
      // Stop physics immediately
      if (projectile.sprite) {
        try {
          const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
          if (body) {
            console.log(`[GROUND-DIAGNOSTIC] Stopping active projectile physics body`);
            body.stop();
            body.setVelocity(0, 0);
            body.setAllowGravity(false);
            body.enable = false;
            try {
              body.world.remove(body);
            } catch (_e) {
              // Ignore if already removed
            }
          }
        } catch (error) {
          console.log(`[GROUND-DIAGNOSTIC] Error stopping active projectile physics:`, error);
        }
      }
      
      console.log(`[GROUND-DIAGNOSTIC] Stopping active projectile particles`);
      this.stopTrailEmitter(projectile, 'ground-impact-active');
      
      // Fade out sprite and ring over 400ms
      if (projectile.sprite) {
        console.log(`[GROUND-DIAGNOSTIC] Starting 400ms fade animation for active projectile`);
        this.tweens.add({
          targets: projectile.sprite,
          alpha: { from: 1, to: 0 },
          duration: 400,
          ease: 'Linear',
          onComplete: () => {
            console.log(`[GROUND-DIAGNOSTIC] Active projectile fade animation complete, calling completeActiveProjectileDestruction()`);
            this.completeActiveProjectileDestruction(projectile, index);
          }
        });
      }
      
      // Also fade ring
      if (projectile.ring) {
        this.tweens.add({
          targets: projectile.ring,
          alpha: { from: 1, to: 0 },
          duration: 400,
          ease: 'Linear'
        });
      }
      
      console.log(`[GROUND-DIAGNOSTIC] destroyActiveProjectileOnGroundImpact() setup complete`);
      
    } catch (error) {
      console.error('[GROUND-DIAGNOSTIC] ERROR in destroyActiveProjectileOnGroundImpact:', error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
      // Failsafe cleanup
      try {
        if (projectile.sprite) projectile.sprite.destroy();
        if (projectile.ring) projectile.ring.destroy();
        this.stopTrailEmitter(projectile, 'ground-impact-active-failsafe');
        this.activeProjectiles.splice(index, 1);
        this.enableSlingshot();
      } catch (_e2) {
        // Last resort
      }
    }
  }

  private destroyProjectileImmediately(): void {
    if (!this.currentProjectile) {
      console.log('[GROUND-FADE] No projectile to destroy');
      return;
    }

    console.log('[GROUND-FADE] Destroying projectile immediately');
    
    const projectile = this.currentProjectile;
    
    // Register as miss
    this.missesInSequence++;

    // Handle miss mechanics (reset streaks/bonus)
    this.onMiss();

    try {
      // Stop physics immediately
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.stop();
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        body.enable = false;
        try {
          body.world.remove(body);
        } catch (_e) {
          // Ignore if already removed
        }
      }
    } catch (error) {
      console.log('[GROUND-FADE] Error stopping physics:', error);
    }

    this.stopTrailEmitter(projectile, 'ground-immediate-current');

    // Destroy sprite and ring immediately
    try {
      projectile.sprite.destroy();
      projectile.ring.destroy();
    } catch (error) {
      console.log('[GROUND-FADE] Error destroying objects:', error);
    }

    // Clear projectile reference immediately
    this.currentProjectile = undefined;
    
    // Clear joypad and reset state
    this.destroyJoypad();
    this.resetDragState();
    
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log('[GROUND-FADE] Immediate destruction complete, input re-enabled');
  }

  private completeProjectileDestruction(): void {
    console.log(`[GROUND-DIAGNOSTIC] completeProjectileDestruction() CALLED`);
    
    if (!this.currentProjectile) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: currentProjectile is null`);
      return;
    }

    const projectile = this.currentProjectile;

    console.log(`[GROUND-DIAGNOSTIC] Destroying particles`);
    this.stopTrailEmitter(projectile, 'ground-complete-current');

    try {
      console.log(`[GROUND-DIAGNOSTIC] Destroying sprite and ring`);
      if (projectile.sprite) {
        projectile.sprite.destroy();
      }
      if (projectile.ring) {
        projectile.ring.destroy();
      }
    } catch (error) {
      console.log(`[GROUND-DIAGNOSTIC] Error destroying objects:`, error);
    }

    console.log(`[GROUND-DIAGNOSTIC] Clearing currentProjectile reference`);
    this.currentProjectile = undefined;
    
    this.destroyJoypad();
    this.resetDragState();
    
    console.log(`[GROUND-DIAGNOSTIC] Enabling slingshot`);
    this.enableSlingshot();
    
    console.log(`[GROUND-DIAGNOSTIC] completeProjectileDestruction() COMPLETE`);
  }

  private completeActiveProjectileDestruction(projectile: ProjectileData, index: number): void {
    console.log(`[GROUND-DIAGNOSTIC] completeActiveProjectileDestruction() CALLED for index ${index}`);
    
    if (!projectile || !projectile.sprite || !projectile.sprite.active) {
      console.log(`[GROUND-DIAGNOSTIC] ABORT: active projectile already destroyed or invalid`);
      return;
    }

    console.log(`[GROUND-DIAGNOSTIC] Destroying active projectile particles`);
    this.stopTrailEmitter(projectile, 'ground-complete-active');

    try {
      console.log(`[GROUND-DIAGNOSTIC] Destroying active projectile sprite and ring`);
      if (projectile.sprite) {
        projectile.sprite.destroy();
      }
      if (projectile.ring) {
        projectile.ring.destroy();
      }
    } catch (error) {
      console.log(`[GROUND-DIAGNOSTIC] Error destroying active projectile objects:`, error);
    }

    console.log(`[GROUND-DIAGNOSTIC] Removing from activeProjectiles array at index ${index}`);
    this.activeProjectiles.splice(index, 1);
    
    console.log(`[GROUND-DIAGNOSTIC] Enabling slingshot`);
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log(`[GROUND-DIAGNOSTIC] completeActiveProjectileDestruction() COMPLETE. Remaining active: ${this.activeProjectiles.length}`);
  }

  private createGroundImpactParticles(x: number, y: number): void {
    console.log('[PARTICLES] Creating ground impact particle burst at', x, y);
    
    // Create temporary particle texture for dust effect
    const dustKey = 'dust_particle';
    if (!this.textures.exists(dustKey)) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x8B7355, 1);
      graphics.fillCircle(3, 3, 3);
      graphics.generateTexture(dustKey, 6, 6);
      graphics.destroy();
    }
    
    const particles = this.add.particles(0, 0, dustKey, {
      speed: { min: -100, max: 100 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      gravityY: 200,
      frequency: -1,
      quantity: 8
    });
    
    particles.emitParticleAt(x, y, 8);
    
    this.time.delayedCall(400, () => {
      try {
        particles.destroy();
      } catch (_e) {
        // Ignore
      }
    });
  }

  private handleTargetHit(targetData: TargetData): void {
    if (targetData.hit) {
      console.log('[HIT] Target already hit, skipping');
      return;
    }
    targetData.hit = true;

    console.log('[HIT] Processing target hit');

    this.targetsRemainingInRound--;
    this.hitsInSequence++;
    this.updateSequenceProgressText();

    const x = targetData.fixedX;
    const y = targetData.fixedY;
    const currentColor = targetData.graphic.fillColor;

    let powderReward: number = POWDER_REWARDS.RED;
    let hitQuality = 'RED';

    if (currentColor === TARGET_COLORS.PURPLE) {
      powderReward = POWDER_REWARDS.PURPLE;
      hitQuality = 'PERFECT';
    } else if (currentColor === TARGET_COLORS.GREEN) {
      powderReward = POWDER_REWARDS.GREEN;
      hitQuality = 'GOOD';
    } else if (currentColor === TARGET_COLORS.ORANGE) {
      powderReward = POWDER_REWARDS.ORANGE;
      hitQuality = 'OKAY';
    } else {
      powderReward = POWDER_REWARDS.RED;
      hitQuality = 'HIT';
    }

    // Apply advanced powder mechanics
    const finalReward = this.processPowderReward(powderReward, currentColor === TARGET_COLORS.PURPLE);
    const oldPowder = this.powder;

    this.powder += finalReward;
    this.totalPowderEarned += finalReward;
    if (finalReward > this.bestHit) {
      this.bestHit = finalReward;
    }

    // Display reward feedback
    this.displayPowderTransactionFeedback(finalReward, true);
    this.animatePowderCounter(oldPowder, this.powder, true);
    
    // Create reward display at circle center
    this.createRewardDisplay(targetData, finalReward);

    // Create particle explosion effect at circle center
    this.createHitParticleExplosion(x, y, currentColor, powderReward);

    const hitText = this.add.text(x, y - 20, hitQuality, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    hitText.setOrigin(0.5);
    hitText.setDepth(101);

    const powderPopup = this.add.text(x, y + 10, `+${finalReward} POWDER`, {
      fontSize: '28px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    });
    powderPopup.setOrigin(0.5);
    powderPopup.setDepth(100);

    this.tweens.add({
      targets: [hitText, powderPopup],
      y: `-=${70}`,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        try {
          hitText.destroy();
          powderPopup.destroy();
        } catch (_e) {
          // Ignore if already destroyed
        }
      },
    });

    // Remove target immediately (both circle and sprite disappear)
    this.removeTarget(targetData);
    this.updatePowderText();
    
    console.log('[HIT] Target processing complete, projectile cleanup will be handled by update loop');
  }

  private removeTarget(targetData: TargetData): void {
    // Remove reward display if it exists
    this.removeRewardDisplay(targetData);
    
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    targetData.ring.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }

  private createHitParticleExplosion(x: number, y: number, color: number, quality: number): void {
    console.log(`[PARTICLES] Creating explosion at (${x}, ${y}) with color ${color.toString(16)} quality ${quality}`);
    
    // Create a temporary texture for particles if it doesn't exist
    const particleKey = `particle_${color}`;
    if (!this.textures.exists(particleKey)) {
      const graphics = this.add.graphics();
      graphics.fillStyle(color, 1);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture(particleKey, 8, 8);
      graphics.destroy();
    }

    // Configure particle emitter based on hit quality
    // RED (quality 1): subtle, ORANGE (2): medium, GREEN (3): large, PURPLE (4): spectacular
    const particleCount: number = quality * 15; // 15, 30, 45, 60 particles
    const particleSpeed: number = quality * 100; // 100, 200, 300, 400 speed
    const particleLifespan: number = 500 + quality * 200; // 700ms, 900ms, 1100ms, 1300ms
    const particleScale: number = 0.8 + quality * 0.3; // 1.1, 1.4, 1.7, 2.0 scale

    // CRITICAL FIX: Create emitter at (0, 0) so explode coordinates are absolute
    const particles = this.add.particles(0, 0, particleKey, {
      speed: { min: particleSpeed * 0.5, max: particleSpeed },
      angle: { min: 0, max: 360 },
      scale: { start: particleScale, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: particleLifespan,
      blendMode: 'ADD',
      frequency: -1,
      quantity: particleCount,
    });

    particles.setDepth(150);

    // Emit particles at EXACT absolute position
    particles.emitParticleAt(x, y, particleCount);

    console.log(`[PARTICLES] Emitted ${particleCount} particles at EXACT position (${x}, ${y})`);

    // Clean up the emitter after particles finish
    this.time.delayedCall(particleLifespan + 100, () => {
      particles.destroy();
    });
  }

  private processPowderReward(baseReward: number, isPerfect: boolean): number {
    let reward = baseReward;
    
    // Handle perfect hit tracking and bonus stage
    if (isPerfect) {
      this.consecutivePerfects++;
      
      // Activate bonus after 3 perfects
      if (this.consecutivePerfects === 3) {
        this.bonusStageActive = true;
        this.activateBonusModeVisual();
        this.showStatusIndicator('BONUS STAGE ACTIVATED!', '#00ff00', 'BONUS STAGE');
      }
      
      // Apply bonus multiplier
      if (this.bonusStageActive && this.consecutivePerfects > 3) {
        const bonus = this.consecutivePerfects - 3; // 1, 2, 3, 4...
        reward += bonus;
        this.showStatusIndicator(`+${bonus} BONUS`, '#00ff00', 'BONUS');
      }
    } else {
      // Non-perfect hit - exit bonus
      if (this.bonusStageActive) {
        this.deactivateBonusModeVisual();
        this.showStatusIndicator('BONUS STAGE LOST', '#ff0000', 'BONUS LOST');
      }
      this.bonusStageActive = false;
      this.consecutivePerfects = 0;
    }
    
    // Track consecutive hits
    this.consecutiveHits++;
    this.updateStreakMultiplier();
    
    // Apply streak multiplier
    reward *= this.streakMultiplier;
    
    // Update streak display
    this.streakCounterText.setText(`Streak: ${this.consecutiveHits}`);
    
    // Apply streak increment cue
    this.applyStreakIncrementCue();
    
    return reward;
  }

  private onMiss(): void {
    // Reset streak
    if (this.streakMultiplier > 1) {
      this.showStatusIndicator('STREAK LOST', '#ff6600', 'MULTIPLIER RESET');
    }
    this.streakMultiplier = 1;
    this.consecutiveHits = 0;
    
    // Exit bonus stage
    if (this.bonusStageActive) {
      this.deactivateBonusModeVisual();
      this.showStatusIndicator('BONUS STAGE LOST', '#ff0000', 'BONUS LOST');
    }
    this.bonusStageActive = false;
    this.consecutivePerfects = 0;
    
    // Update streak displays
    this.streakCounterText.setText('Streak: 0');
    this.refreshMultiplierDisplay();
    
    // Flash red briefly to indicate streak broken
    this.resetStreakDisplay();
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
    
    // Always refresh display after multiplier changes
    this.refreshMultiplierDisplay();
  }

  private showStatusIndicator(mainText: string, color: string, subText: string): void {
    const container = this.add.container(this.cameras.main.centerX, 200);
    
    const main = this.add.text(0, 0, mainText, {
      fontSize: '48px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    const sub = this.add.text(0, 50, subText, {
      fontSize: '24px',
      color: color
    }).setOrigin(0.5);
    
    container.add([main, sub]);
    container.setDepth(260);
    
    // Animate and remove
    this.tweens.add({
      targets: container,
      scale: {from: 0.5, to: 1},
      alpha: {from: 1, to: 0},
      duration: 2000,
      onComplete: () => container.destroy()
    });
  }

  private cleanupProjectileAfterHit(): void {
    console.log('[CLEANUP] cleanupProjectileAfterHit called - safe cleanup outside collision handler');
    
    if (!this.currentProjectile) {
      console.log('[CLEANUP] No projectile to clean up');
      return;
    }

    const projectile = this.currentProjectile;

    try {
      // Disable physics body safely
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        console.log('[CLEANUP] Disabling physics body');
        body.stop();
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        body.enable = false;
        try {
          body.world.remove(body);
        } catch (_e) {
          // Ignore if already removed
        }
      }
    } catch (error) {
      console.log('[CLEANUP] Error disabling physics:', error);
    }

    this.stopTrailEmitter(projectile, 'hit-current');

    // Destroy sprite and ring
    try {
      projectile.sprite.destroy();
      projectile.ring.destroy();
    } catch (error) {
      console.log('[CLEANUP] Error destroying objects:', error);
    }

    // Clear projectile reference
    this.currentProjectile = undefined;
    
    // Reset state to allow next shot
    this.snappedVelocity = undefined;
    this.destroyJoypad();
    this.resetDragState();
    
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log('[CLEANUP] Cleanup complete, input re-enabled for next shot');
  }

  private prepareNextShot(): void {
    console.log('[CLEANUP] prepareNextShot called');
    
    if (this.currentProjectile) {
      const projectile = this.currentProjectile;
      console.log('[CLEANUP] Destroying projectile');
      
      try {
        const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          body.stop();
          body.setVelocity(0, 0);
          body.setAllowGravity(false);
          body.enable = false;
          // Remove from physics world to ensure no further interactions
          try {
            body.world.remove(body);
          } catch (_e) {
            // Ignore if already removed
          }
        }
      } catch (_error) {
        // Ignore cleanup errors during projectile teardown
      }

      try {
        projectile.sprite.destroy();
      } catch (_e) {
        // Ignore if already destroyed
      }

      try {
        projectile.ring.destroy();
      } catch (_e) {
        // Ignore if already destroyed
      }
      
      this.stopTrailEmitter(projectile, 'prepare-next-shot-current');
      
      this.currentProjectile = undefined;
      console.log('[CLEANUP] Projectile destroyed and reference cleared');
    } else {
      console.log('[CLEANUP] No projectile to clean up');
    }

    this.snappedVelocity = undefined;
    this.resetDragState();
    
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log('[CLEANUP] prepareNextShot complete - ready for next shot');
  }

  private checkManualCollisionsForProjectile(projectile: ProjectileData): void {
    if (!projectile || projectile.fadingOut || projectile.hasCollided) {
      return;
    }

    const projectileX = projectile.sprite.x;
    const projectileY = projectile.sprite.y;
    const projectileRadius = 8; // Same as physics body

    // Check distance to each target
    for (const target of this.targets) {
      if (target.hit) continue;

      const targetX = target.fixedX;
      const targetY = target.fixedY;
      const targetRadius = target.graphic.radius;

      // Calculate distance between centers
      const dx = projectileX - targetX;
      const dy = projectileY - targetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if projectile is within target radius
      if (distance <= targetRadius + projectileRadius) {
        console.log('[HIT] Manual collision detected for active projectile! Setting flags for deferred cleanup.');
        // Set flags but don't handle collision here - defer to next frame
        projectile.hasCollided = true;
        projectile.shouldDestroy = true;
        // Process the hit in the collision handler called via delayedCall
        this.time.delayedCall(1, () => {
          this.handleTargetHit(target);
        });
        return; // Exit after first hit
      }
    }
  }

  private cleanupActiveProjectile(projectile: ProjectileData, index: number): void {
    console.log('[CLEANUP] cleanupActiveProjectile called - safe cleanup outside collision handler');
    
    try {
      // Disable physics body safely
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        console.log('[CLEANUP] Disabling physics body');
        body.stop();
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        body.enable = false;
        try {
          body.world.remove(body);
        } catch (_e) {
          // Ignore if already removed
        }
      }
    } catch (error) {
      console.log('[CLEANUP] Error disabling physics:', error);
    }

    this.stopTrailEmitter(projectile, 'hit-active');

    // Destroy sprite and ring
    try {
      projectile.sprite.destroy();
      projectile.ring.destroy();
    } catch (error) {
      console.log('[CLEANUP] Error destroying objects:', error);
    }

    // Remove from active array
    this.activeProjectiles.splice(index, 1);
    
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log('[CLEANUP] Active projectile cleanup complete. Remaining active:', this.activeProjectiles.length);
  }

  private handleOffscreenActiveProjectile(projectile: ProjectileData, index: number): void {
    console.log('[OFF-SCREEN] handleOffscreenActiveProjectile called');
    
    if (projectile.fadingOut || projectile.shouldDestroy) {
      console.log('[OFF-SCREEN] Projectile already being cleaned up, skipping');
      return;
    }

    console.log('[OFF-SCREEN] Starting cleanup sequence - projectile position:', 
      projectile.sprite.x, projectile.sprite.y);

    try {
      // Mark as fading out IMMEDIATELY to prevent re-entry
      projectile.fadingOut = true;

      const sprite = projectile.sprite;

      let missX = this.scale.width / 2;
      let missY = this.scale.height / 2;

      if (sprite.x < 0) {
        missX = MISS_EDGE_PADDING;
      } else if (sprite.x > this.scale.width) {
        missX = this.scale.width - MISS_EDGE_PADDING;
      } else {
        missX = sprite.x;
      }

      if (sprite.y < 0) {
        missY = MISS_EDGE_PADDING;
      } else if (sprite.y > this.scale.height) {
        missY = this.scale.height - MISS_EDGE_PADDING;
      } else {
        missY = sprite.y;
      }

      const missText = this.add.text(missX, missY, 'MISS', {
        fontSize: '32px',
        color: '#e74c3c',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
      });
      missText.setOrigin(0.5);
      missText.setDepth(100);

      this.tweens.add({
        targets: missText,
        y: missY - 60,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          try {
            missText.destroy();
          } catch (_e) {
            // Ignore destruction errors
          }
        },
      });

      this.missesInSequence++;

      // Handle miss mechanics (reset streaks/bonus)
      this.onMiss();

      // Stop physics IMMEDIATELY
      try {
        const body = sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          console.log('[OFF-SCREEN] Stopping physics body');
          body.stop();
          body.setVelocity(0, 0);
          body.setAllowGravity(false);
          body.enable = false;
          body.world.remove(body);
        }
      } catch (error) {
        console.log('[OFF-SCREEN] Error stopping physics:', error);
      }

      this.stopTrailEmitter(projectile, 'offscreen-active');

      // Destroy sprite IMMEDIATELY
      console.log('[OFF-SCREEN] Destroying projectile and ring');
      try {
        sprite.destroy();
        projectile.ring.destroy();
      } catch (error) {
        console.log('[OFF-SCREEN] Error destroying objects:', error);
      }

      // Remove from active array
      this.activeProjectiles.splice(index, 1);
      
      // Re-enable slingshot for next shot
      this.enableSlingshot();
      
      console.log('[OFF-SCREEN] Cleanup complete. Remaining active:', this.activeProjectiles.length);
    } catch (error) {
      console.log('[OFF-SCREEN] Fatal error during cleanup:', error);
      // Failsafe: force cleanup if any error occurs
      try {
        this.activeProjectiles.splice(index, 1);
        // Still try to re-enable slingshot even in error case
        this.enableSlingshot();
      } catch (_e2) {
        // Last resort
      }
    }
  }

  private destroyActiveProjectileImmediately(projectile: ProjectileData, index: number): void {
    if (!projectile) {
      console.log('[GROUND-FADE] No projectile to destroy');
      return;
    }

    console.log('[GROUND-FADE] Destroying active projectile immediately');
    
    // Register as miss
    this.missesInSequence++;

    // Handle miss mechanics (reset streaks/bonus)
    this.onMiss();

    try {
      // Stop physics immediately
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.stop();
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        body.enable = false;
        try {
          body.world.remove(body);
        } catch (_e) {
          // Ignore if already removed
        }
      }
    } catch (error) {
      console.log('[GROUND-FADE] Error stopping physics:', error);
    }

    this.stopTrailEmitter(projectile, 'ground-immediate-active');

    // Destroy sprite and ring immediately
    try {
      projectile.sprite.destroy();
      projectile.ring.destroy();
    } catch (error) {
      console.log('[GROUND-FADE] Error destroying objects:', error);
    }

    // Remove from active array
    this.activeProjectiles.splice(index, 1);
    
    // Re-enable slingshot for next shot
    this.enableSlingshot();
    
    console.log('[GROUND-FADE] Immediate destruction complete. Remaining active:', this.activeProjectiles.length);
  }

  private createUI(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.roundText = this.add.text(
      width / 2,
      20,
      `Round ${this.currentRound}`,
      createTextStyle('32px', '#ffffff')
    );
    this.roundText.setOrigin(0.5, 0);
    this.roundText.setDepth(100);

    // Structured powder HUD container (label, value, transaction)
    const powderHudPaddingX = Math.max(20, width * 0.02);
    const powderHudPaddingY = Math.max(24, height * 0.03);

    this.powderHudContainer = this.add.container(powderHudPaddingX, powderHudPaddingY);
    this.powderHudContainer.setDepth(100);

    this.powderLabel = this.add.text(0, 0, 'POWDER', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);

    this.powderValue = this.add.text(0, 0, this.powder.toString(), {
      fontSize: '28px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);

    this.transactionText = this.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);
    this.transactionText.setVisible(false);
    this.transactionText.setAlpha(0);

    this.powderHudContainer.add([this.powderLabel, this.powderValue, this.transactionText]);

    // Keep original powderText for backward compatibility with existing animation methods
    this.powderText = this.add.text(
      powderHudPaddingX,
      powderHudPaddingY - 14,
      `POWDER: ${this.powder}`,
      createTextStyle('28px', '#FFD700')
    );
    this.powderText.setOrigin(0, 0);
    this.powderText.setDepth(90); // Behind the new elements
    this.powderText.setVisible(false); // Hide the original

    this.layoutPowderHud();

    this.sequenceProgressText = this.add.text(
      width - 20,
      20,
      `Targets: 0/${this.targetsInRound}`,
      createTextStyle('24px', '#ffffff')
    );
    this.sequenceProgressText.setOrigin(1, 0);
    this.sequenceProgressText.setDepth(100);

    this.streakCounterText = this.add.text(
      width / 2,
      80,
      'Streak: 0',
      createTextStyle('24px', '#ffff00')
    );
    this.streakCounterText.setOrigin(0.5, 0);
    this.streakCounterText.setDepth(100);
    this.streakCounterText.setStroke('#000000', 2);

    this.streakMultiplierText = this.add.text(
      width / 2,
      130,
      'x1',
      createTextStyle('28px', '#ffaa00')
    );
    this.streakMultiplierText.setOrigin(0.5, 0);
    this.streakMultiplierText.setDepth(100);
    this.streakMultiplierText.setStroke('#000000', 2);
    
    // Initialize multiplier display as hidden (base x1 should not show)
    this.refreshMultiplierDisplay();

    this.instructionsText = this.add.text(
      width / 2,
      height - 30,
      'Tap to shoot • Hit targets while colored for powder rewards!',
      createTextStyle('18px', '#ffffff')
    );
    this.instructionsText.setOrigin(0.5, 1);
    this.instructionsText.setDepth(100);
  }

  private updatePowderText(): void {
    // Update the new separated value element
    this.powderValue.setText(this.powder.toString());
    
    // Also update the hidden original for backward compatibility
    this.powderText.setText(`POWDER: ${this.powder}`);

    this.layoutPowderHud();
  }

  private layoutPowderHud(): void {
    if (!this.powderLabel || !this.powderValue || !this.transactionText) {
      return;
    }

    const labelWidth = this.powderLabel.width;
    const valueWidth = this.powderValue.width;
    const labelValueSpacing = 8;
    const valueTransactionSpacing = 12;

    this.powderLabel.setPosition(0, 0);
    this.powderValue.setPosition(labelWidth + labelValueSpacing, 0);
    this.transactionText.setPosition(labelWidth + labelValueSpacing + valueWidth + valueTransactionSpacing, 0);
  }

  private animatePowderCounter(oldValue: number, newValue: number, isReward: boolean): void {
    // Kill any existing tween to prevent conflicts
    if (this.powderAnimationTween) {
      this.powderAnimationTween.destroy();
    }

    const animationObj: { value: number } = { value: oldValue };
    
    this.powderAnimationTween = this.tweens.add({
      targets: animationObj,
      value: newValue,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: (_tween) => {
        const displayValue = Math.round(animationObj.value);
        this.powderValue.setText(displayValue.toString());
        // Also update hidden original for compatibility
        this.powderText.setText(`POWDER: ${displayValue}`);
        this.layoutPowderHud();
      }
    });

    // Apply cue effect to powder counter
    if (isReward) {
      this.applyPowderRewardCue();
    } else {
      this.applyPowderConsumptionCue();
    }
  }

  private applyPowderConsumptionCue(): void {
    const powderDisplay = this.powderValue;
    const originalColor = '#FFD700'; // Yellow - original powder color

    powderDisplay.setColor('#ff0000');
    powderDisplay.setScale(0.7);

    this.tweens.add({
      targets: powderDisplay,
      scale: { from: 0.7, to: 1.0 },
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        powderDisplay.setColor(originalColor);
      }
    });
  }

  private applyPowderRewardCue(): void {
    const powderDisplay = this.powderValue;
    const originalColor = '#FFD700'; // Yellow - original powder color

    powderDisplay.setColor('#00ff00');
    powderDisplay.setScale(1.3);

    this.tweens.add({
      targets: powderDisplay,
      scale: { from: 1.3, to: 1.0 },
      duration: 600,
      ease: 'Back.easeOut',
      onComplete: () => {
        powderDisplay.setColor(originalColor);
      }
    });
  }

  private displayPowderTransactionFeedback(amount: number, isReward: boolean): void {
    const type = isReward ? 'reward' : 'cost';
    console.log(`[POWDER] ${isReward ? 'Reward' : 'Shot cost'} ${isReward ? '+' : '-'}${Math.abs(amount)}`);

    if (this.transactionActive) {
      this.transactionQueue.push({ amount, type });
      return;
    }

    this.showTransactionText(amount, type);
  }

  private showTransactionText(amount: number, type: 'cost' | 'reward'): void {
    if (!this.transactionText) {
      return;
    }

    this.transactionActive = true;
    const isReward = type === 'reward';
    const color = isReward ? '#00ff00' : '#ff0000';
    const sign = isReward ? '+' : '-';
    const displayText = `${sign}${Math.abs(amount)}`;

    this.transactionText.setText(displayText);
    this.transactionText.setColor(color);
    this.transactionText.setVisible(true);
    this.transactionText.setAlpha(1);
    this.layoutPowderHud();

    if (this.transactionTween) {
      this.transactionTween.destroy();
    }

    this.transactionTween = this.tweens.add({
      targets: this.transactionText,
      alpha: { from: 1, to: 0 },
      duration: 600,
      delay: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.transactionText) {
          this.transactionText.setVisible(false);
          this.transactionText.setText('');
        }
        this.transactionActive = false;
        this.processNextTransaction();
      }
    });
  }

  private processNextTransaction(): void {
    if (this.transactionQueue.length > 0) {
      const next = this.transactionQueue.shift();
      if (next) {
        this.showTransactionText(next.amount, next.type);
      }
    }
  }

  private clearPowderTransactionFeedback(): void {
    this.transactionQueue = [];
    this.transactionActive = false;
    if (this.transactionTween) {
      this.transactionTween.stop();
      this.transactionTween = undefined;
    }

    if (this.transactionText) {
      this.transactionText.setVisible(false);
      this.transactionText.setAlpha(0);
      this.transactionText.setText('');
    }
  }

  private activateBonusModeVisual(): void {
    if (this.bonusModeVisualActive) {
      console.log('[BONUS] Bonus mode visual already active, skipping');
      return;
    }

    console.log('[BONUS] Activating bonus mode visual effects');
    this.bonusModeVisualActive = true;

    // Define rainbow color palette
    const RAINBOW_COLORS = [
      '#ff0000', // Red
      '#ff7f00', // Orange
      '#ffff00', // Yellow
      '#00ff00', // Green
      '#0000ff', // Blue
      '#4b0082', // Indigo
      '#9400d3'  // Violet
    ];

    // Stop any previous animation
    if (this.bonusModeAnimation) {
      this.bonusModeAnimation.remove();
      this.bonusModeAnimation = undefined;
    }

    // Rainbow color cycling
    let colorIndex = 0;
    this.bonusModeAnimation = this.time.addEvent({
      delay: 150, // ms between color changes
      loop: true,
      callback: () => {
        if (this.powderLabel && this.bonusModeVisualActive) {
          this.powderLabel.setColor(RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length]);
          colorIndex++;
        }
      }
    });

    // Size blinking effect (continuous pulse)
    this.tweens.add({
      targets: this.powderLabel,
      scale: { from: 1.0, to: 1.15 },
      duration: 400,
      yoyo: true,
      repeat: -1, // Infinite loop while bonus active
      ease: 'Sine.easeInOut'
    });
  }

  private deactivateBonusModeVisual(): void {
    if (!this.bonusModeVisualActive) {
      console.log('[BONUS] Bonus mode visual not active, skipping deactivation');
      return;
    }

    console.log('[BONUS] Deactivating bonus mode visual effects');
    this.bonusModeVisualActive = false;

    // Stop color cycling
    if (this.bonusModeAnimation) {
      this.bonusModeAnimation.remove();
      this.bonusModeAnimation = undefined;
    }

    // Stop size blinking animation
    this.tweens.killTweensOf(this.powderLabel);

    // Restore original appearance
    this.powderLabel.setColor('#ffffff'); // Original white color
    this.powderLabel.setScale(1.0); // Back to normal size
  }

  private applyStreakIncrementCue(): void {
    // Only animate if multiplier display is visible (multiplier > 1)
    if (this.streakMultiplierText.visible) {
      this.tweens.add({
        targets: this.streakMultiplierText,
        scale: { from: 1.0, to: 1.15 },
        duration: 300,
        ease: 'Back.easeOut'
      });
    }
  }

  private applyMultiplierUpgradeCue(): void {
    // Only animate if multiplier display is visible (multiplier > 1)
    if (this.streakMultiplierText.visible) {
      this.tweens.add({
        targets: this.streakMultiplierText,
        scale: { from: 1.0, to: 1.4 },
        duration: 500,
        ease: 'Elastic.easeOut',
        easeParams: [1.5, 0.5]
      });

      // Flash to bright color
      const originalColor = '#ffaa00'; // Orange - original multiplier color
      this.streakMultiplierText.setColor('#ffff00');

      this.time.delayedCall(250, () => {
        this.streakMultiplierText.setColor(originalColor);
      });
    }
  }

  private refreshMultiplierDisplay(): void {
    if (this.streakMultiplier > 1) {
      // Show multiplier text with correct value
      this.streakMultiplierText.setVisible(true);
      this.streakMultiplierText.setText(`x${this.streakMultiplier}`);
      console.log(`[MULTIPLIER] Showing multiplier: x${this.streakMultiplier} (visible: true, text set)`);
    } else {
      // Hide multiplier text when at x1 base
      this.streakMultiplierText.setVisible(false);
      this.streakMultiplierText.setText('');
      // Reset scale and color to prevent lingering animations
      this.streakMultiplierText.setScale(1.0);
      this.streakMultiplierText.setColor('#ffaa00'); // Original orange color
      console.log('[MULTIPLIER] Hiding base multiplier (visible: false, text cleared, scale/color reset)');
    }
  }

  private resetStreakDisplay(): void {
    // Only animate if multiplier display is visible (multiplier > 1)
    if (this.streakMultiplierText.visible) {
      const originalColor = '#ffaa00'; // Orange - original multiplier color
      this.streakMultiplierText.setColor('#ff0000');

      this.time.delayedCall(300, () => {
        this.streakMultiplierText.setColor(originalColor);
      });
    }
  }

  private updateRoundText(): void {
    this.roundText.setText(`Round ${this.currentRound}`);
  }

  private updateSequenceProgressText(): void {
    const completed = this.targetsInRound - this.targetsRemainingInRound;
    this.sequenceProgressText.setText(`Targets: ${completed}/${this.targetsInRound}`);
  }

  private handleSequenceComplete(): void {
    // Clear joypad BEFORE showing any overlays
    this.clearJoypadState();
    
    this.roundComplete = true;
    this.sequenceActive = false;
    
    // Clean up sequence timer
    if (this.sequenceTimer) {
      this.sequenceTimer.remove();
      this.sequenceTimer = null;
    }

    const totalTargets = this.hitsInSequence + this.missesInSequence;
    const successRate = totalTargets > 0 ? (this.hitsInSequence / totalTargets) : 0;

    // Check if sequence meets 50% success rate requirement
    if (successRate >= 0.5) {
      // Success - show quick summary and auto-continue
      this.showQuickSummary(successRate);
      
      // Schedule next sequence after 2 seconds
      this.time.delayedCall(2000, () => {
        if (this.roundComplete) {
          this.nextRound();
        }
      });
      return;
    }

    // Sequence failed (less than 50% success) - show summary screen with options
    const width = this.scale.width;
    const height = this.scale.height;

    const accuracy = totalTargets > 0 ? (this.hitsInSequence / totalTargets) * 100 : 0;
    
    let scoreTier: string;
    let scoreColor: string;
    
    if (accuracy <= 25) {
      scoreTier = 'BAD';
      scoreColor = '#e74c3c';
    } else if (accuracy <= 50) {
      scoreTier = 'NICE';
      scoreColor = '#f39c12';
    } else if (accuracy <= 75) {
      scoreTier = 'GOOD';
      scoreColor = '#2ecc71';
    } else if (accuracy <= 90) {
      scoreTier = 'PERFECT';
      scoreColor = '#3498db';
    } else {
      scoreTier = 'OUTSTANDING';
      scoreColor = '#9b59b6';
    }

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.BLACK, 0.7);
    overlay.setDepth(200);

    const sequenceCompleteText = this.add.text(
      width / 2,
      height / 2 - 120,
      `SEQUENCE ${this.currentRound} COMPLETE!`,
      {
        fontSize: '48px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      }
    );
    sequenceCompleteText.setOrigin(0.5);
    sequenceCompleteText.setDepth(201);

    const scoreText = this.add.text(
      width / 2,
      height / 2 - 50,
      scoreTier,
      {
        fontSize: '72px',
        color: scoreColor,
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }
    );
    scoreText.setOrigin(0.5);
    scoreText.setDepth(201);

    const statsText = this.add.text(
      width / 2,
      height / 2 + 20,
      `Accuracy: ${accuracy.toFixed(0)}%\nHits: ${this.hitsInSequence}/${totalTargets}\nPowder: ${this.powder}`,
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    statsText.setOrigin(0.5);
    statsText.setDepth(201);
    statsText.setLineSpacing(8);

    const destroyUI = () => {
      try {
        overlay.destroy();
        sequenceCompleteText.destroy();
        scoreText.destroy();
        statsText.destroy();
        tryAgainButton.destroy();
        restartButton.destroy();
        menuButton.destroy();
      } catch (_e) {
        // Ignore destruction errors
      }
    };

    const tryAgainButton = createButton(
      this,
      width / 2 - 160,
      height / 2 + 130,
      'TRY AGAIN',
      () => {
        destroyUI();
        
        // Restart same sequence with countdown
        this.roundComplete = false;
        this.sequenceActive = false;
        this.hitsInSequence = 0;
        this.missesInSequence = 0;
        this.shotsInCurrentSequence = 0;
        
        // Clear pending transaction feedback
        this.clearPowderTransactionFeedback();
        
        // Clear joypad BEFORE showing any overlays
        this.clearJoypadState();
        
        // Clean up any remaining targets
        this.targets.forEach(target => this.removeTarget(target));
        this.targets = [];
        
        // Reset streak BEFORE countdown
        this.resetStreakBeforeCountdown();
        
        this.startCountdown();
      },
      140,
      60
    );
    tryAgainButton.setDepth(201);

    const restartButton = createButton(
      this,
      width / 2,
      height / 2 + 130,
      'RESTART',
      () => {
        destroyUI();
        
        // Restart game from beginning
        this.scene.stop();
        this.scene.start(SCENES.SLINGSHOT);
      },
      140,
      60
    );
    restartButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2 + 160,
      height / 2 + 130,
      'MENU',
      () => {
        destroyUI();
        
        // Return to main menu
        this.scene.stop();
        this.scene.start(SCENES.MAIN_MENU);
      },
      140,
      60
    );
    menuButton.setDepth(201);

    this.tweens.add({
      targets: scoreText,
      scale: { from: 1, to: 1.1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private showQuickSummary(successRate: number): void {
    const summaryText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      `Sequence Success: ${(successRate * 100).toFixed(0)}%\nNext sequence starting...`,
      {
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
        backgroundColor: '#000000',
        padding: {x: 20, y: 10}
      }
    ).setOrigin(0.5);
    summaryText.setDepth(220);
    
    // Auto-fade and remove after 2 seconds
    this.tweens.add({
      targets: summaryText,
      alpha: {from: 1, to: 0},
      duration: 1500,
      delay: 500,
      onComplete: () => {
        summaryText.destroy();
      }
    });
  }

  private resetStreakBeforeCountdown(): void {
    console.log('[SEQUENCE] Resetting streak before countdown');

    // Reset streak counters
    this.consecutiveHits = 0;
    this.streakMultiplier = 1;

    // Update UI displays if they exist
    if (this.streakCounterText) {
      this.streakCounterText.setText('Streak: 0');
    }
    
    // Use centralized method to hide multiplier text (no x1 should show)
    this.refreshMultiplierDisplay();

    console.log('[SEQUENCE] Streak reset complete - consecutiveHits: 0, multiplier: 1x');

    // NOTE: Do NOT reset bonusStageActive or consecutivePerfects
    // Bonus mode persists across sequences
  }

  private nextRound(): void {
    // Clear joypad BEFORE showing any overlays
    this.clearJoypadState();
    
    this.currentRound++;
    this.roundComplete = false;

    this.targets.forEach((target) => this.removeTarget(target));
    this.targets = [];

    // Reset streak BEFORE countdown
    this.resetStreakBeforeCountdown();

    // Start next sequence with countdown for consistency
    this.startCountdown();
  }

  private triggerGameOver(): void {
    if (this.gameOver) return;
    
    // Clear joypad BEFORE showing game over overlay
    this.clearJoypadState();
    
    this.clearPowderTransactionFeedback();
    
    // Hide multiplier display on game over
    this.refreshMultiplierDisplay();
    
    // Stop all active projectiles
    this.activeProjectiles.forEach((projectile) => {
      try {
        const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          body.stop();
          body.setVelocity(0, 0);
          body.setAllowGravity(false);
          body.enable = false;
        }
        projectile.sprite.destroy();
        projectile.ring.destroy();
        this.stopTrailEmitter(projectile, 'game-over-active');
      } catch (_e) {
        // Ignore cleanup errors
      }
    });
    this.activeProjectiles = [];
    
    // Clean up targets
    this.targets.forEach(target => this.removeTarget(target));
    this.targets = [];
    
    // Show game over screen
    this.handleGameOver();
  }

  private handleGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    // Don't pause the scene - the gameOver flag prevents further updates

    const width = this.scale.width;
    const height = this.scale.height;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.BLACK, 0.75);
    overlay.setDepth(200);

    const gameOverText = this.add.text(width / 2, height / 2 - 120, 'GAME OVER', {
      fontSize: '72px',
      color: '#e74c3c',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setDepth(201);

    const statsText = this.add.text(
      width / 2,
      height / 2 - 20,
      `Rounds Completed: ${this.currentRound - 1}\nTotal Powder Earned: ${this.totalPowderEarned}\nBest Hit: +${this.bestHit} Powder`,
      {
        fontSize: '26px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    statsText.setOrigin(0.5);
    statsText.setDepth(201);
    statsText.setLineSpacing(12);

    const restartButton = createButton(
      this,
      width / 2 - 130,
      height / 2 + 120,
      'RESTART',
      () => {
        this.scene.stop();
        this.scene.start(SCENES.SLINGSHOT);
      },
      200,
      60
    );
    restartButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2 + 130,
      height / 2 + 120,
      'MENU',
      () => {
        this.scene.stop();
        this.scene.start(SCENES.MAIN_MENU);
      },
      200,
      60
    );
    menuButton.setDepth(201);

    this.tweens.add({
      targets: gameOverText,
      scale: { from: 1, to: 1.05 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
