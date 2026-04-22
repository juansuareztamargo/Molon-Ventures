
import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { TARGET_CONFIG } from '@/config/targetConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS, TARGET_COLORS, POWDER_REWARDS, CIRCLE_SPACING } from '@/utils/constants';
import { createButton, createTextStyle } from '@/utils/helpers';

const JOYPAD_BASE_RADIUS = 82;
import { ParticleManager } from '@/game/managers/ParticleManager';
const JOYPAD_KNOB_RADIUS = 26;
const MISS_EDGE_PADDING = 50;
const TOP_ESCAPE_PADDING = 50;
const STATUS_INDICATOR_SPACING = 70;
const STATUS_INDICATOR_MAX = 3;
const STATUS_INDICATOR_ENTRY_DURATION = 260;
const STATUS_INDICATOR_HOLD_DURATION = 1400;
const STATUS_INDICATOR_FADE_DURATION = 450;
const STATUS_INDICATOR_STAGGER_STEP = 80;
const STATUS_INDICATOR_BURST_THRESHOLD = 32;
const STATUS_INDICATOR_DEPTH = 260;
const STATUS_INDICATOR_SUBTEXT_OFFSET = 44;

// Hit feedback timing constants for improved readability
const JOYPAD_COST_HOLD_MS = 2100;  // 2x original (was 1050)
const JOYPAD_COST_FADE_MS = 1800;  // 2x original (was 900)


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
  costText?: Phaser.GameObjects.Text;
  costTween?: Phaser.Tweens.Tween;
}

interface ProjectileData {
  sprite: Phaser.Physics.Arcade.Sprite;
  ring: Phaser.GameObjects.Arc;
  targetColor: number;
  fadingOut: boolean;
  hasCollided: boolean;
  shouldDestroy: boolean;
  trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface StatusIndicatorRequest {
  mainText: string;
  subText?: string;
  color: string;
  requestedAt: number;
}

interface ActiveStatusIndicator {
  container: Phaser.GameObjects.Container;
  timer?: Phaser.Time.TimerEvent;
  introTween?: Phaser.Tweens.Tween;
  fadeTween?: Phaser.Tweens.Tween;
}

interface RewardBreakdown {
  baseAmount: number;
  bonusAmount: number;
  multiplier: number;
  intermediateAfterBonus: number;
  finalTotal: number;
}

interface RewardStageConfig {
  key: string;
  text: string;
  color: string;
  fontSize: number;
  logMessage: string;
  impactDuration: number;
  holdDuration: number;
  fadeDuration: number;
  impactScale?: number;
  holdScale?: number;
  fadeScale?: number;
}

export class SlingshotScene extends Phaser.Scene {
  private currentRound: number = 1;
  private targetsInRound: number = 1;
  private targetsRemainingInRound: number = 0;
  private targetsSpawnedInRound: number = 0;
  private powder: number = GAME_SETTINGS.INITIAL_POWDER;
  private totalPowderEarned: number = 0;
  private bestHit: number = 0;
  private roundStartPowder: number = GAME_SETTINGS.INITIAL_POWDER; // Store powder at start of round/sequence for retry

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

  // Powder HUD positioning for status indicators
  private powderHudPaddingX: number = 0;
  private powderHudPaddingY: number = 0;

  private isDragging: boolean = false;
  private lastDragPos: { x: number, y: number } | null = null;
  private currentProjectile?: ProjectileData;
  private activeProjectiles: ProjectileData[] = [];
  private slingshotEnabled: boolean = true;

  private targets: TargetData[] = [];
  private ground!: Phaser.GameObjects.Rectangle;

  private joypad?: JoypadUI;
  private snappedVelocity?: { vx: number; vy: number };

  private hitsText?: Phaser.GameObjects.Text;

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
  
  private shotBlockedDueToPowder: boolean = false;

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
  
  // Status indicator tracking
  private statusIndicators: ActiveStatusIndicator[] = [];
  private statusIndicatorQueue: StatusIndicatorRequest[] = [];
  private statusIndicatorLastRequestTime: number | null = null;
  private statusIndicatorBurstCount: number = 0;
  
  // Particle Manager
  private particleManager!: ParticleManager;
  
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
    this.clearStatusIndicators();

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
      this.fadeOutJoypadCost('resetState', true);
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

    // Clean up any remaining active projectiles
    this.activeProjectiles.forEach((projectile) => {
      try {
        if (projectile.sprite) projectile.sprite.destroy();
        if (projectile.ring) projectile.ring.destroy();
      } catch (_error) {
        // Ignore cleanup errors during scene reset
      }
    });
    this.activeProjectiles = [];

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
    this.roundStartPowder = GAME_SETTINGS.INITIAL_POWDER;
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

    // Improved Ground with Gradient
    const groundY = height - GAME_SETTINGS.GROUND_HEIGHT;
    const groundGraphics = this.add.graphics();
    
    // Top gradient (Horizon)
    groundGraphics.fillGradientStyle(0x2d3436, 0x2d3436, 0x000000, 0x000000, 1);
    groundGraphics.fillRect(0, groundY, width, GAME_SETTINGS.GROUND_HEIGHT);
    
    // Add a top border line for definition
    groundGraphics.lineStyle(2, 0x555555, 1);
    groundGraphics.beginPath();
    groundGraphics.moveTo(0, groundY);
    groundGraphics.lineTo(width, groundY);
    groundGraphics.strokePath();

    // Create an invisible physics body for the ground
    this.ground = this.add.rectangle(
      width / 2,
      height - GAME_SETTINGS.GROUND_HEIGHT / 2,
      width,
      GAME_SETTINGS.GROUND_HEIGHT,
      0x000000,
      0 // Invisible
    );
    this.physics.add.existing(this.ground, true);

    this.createUI();
    this.particleManager = new ParticleManager(this);
    this.setupInput();
    this.startCountdown();
  }

  update(_time: number, _delta: number): void {
    // Handle deferred projectile destruction (CRITICAL: outside collision handlers)
    if (this.currentProjectile && this.currentProjectile.shouldDestroy && !this.currentProjectile.fadingOut) {
      console.log('[UPDATE] Processing deferred projectile destruction');
      this.currentProjectile.shouldDestroy = false; // Reset flag
      // Defer cleanup to next frame to ensure we're fully outside collision handler
      console.log('[UPDATE] Executing deferred projectile destruction');
      this.cleanupProjectileAfterHit();
    }
    
    // Continuous joypad update loop to keep visuals synced (e.g. ring color) even when still
    if (this.isDragging && this.lastDragPos && this.joypad && this.currentProjectile) {
        this.updateJoypad(this.lastDragPos.x, this.lastDragPos.y);
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
      
      if (
        !isAboveGround &&
        !this.isDragging &&
        !this.currentProjectile.shouldDestroy &&
        !this.currentProjectile.fadingOut
      ) {
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

    // GAME OVER CHECK: End game if out of powder and no pending shots
    // Check cost against Hits+1 (validation logic)
    const nextCost = this.hitsInSequence + 1;
    if (this.powder < nextCost && 
        this.activeProjectiles.length === 0 && 
        !this.currentProjectile &&
        !this.gameOver) {
        console.log('[UPDATE] Out of powder and no active shots - Triggering Game Over');
        this.triggerGameOver();
    }

    // Update currentProjectile (being dragged/aimed) lifecycle
    if (this.currentProjectile && !this.isDragging) {
      const sprite = this.currentProjectile.sprite;
      const ring = this.currentProjectile.ring;
      const body = sprite.body as Phaser.Physics.Arcade.Body;

      // Only despawn on left/right edges, allow projectile to go off top and come back down
      // But if sequence is not active, also destroy projectiles that exit the top
      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50 ||
        (!this.sequenceActive && sprite.y < -TOP_ESCAPE_PADDING);

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      const isOnGround = sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30;

      // Handle off-screen projectiles even after sequence completes
      if (isOffscreen && !this.currentProjectile.fadingOut && !this.currentProjectile.shouldDestroy) {
        const reason = (!this.sequenceActive && sprite.y < -TOP_ESCAPE_PADDING) ? 'top-escape-post-sequence' : 'offscreen';
        console.log(`[OFF-SCREEN] Projectile detected off-screen (${reason}), cleaning up...`);
        this.handleOffscreenProjectile({ reason });
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
      // But if sequence is not active, also destroy projectiles that exit the top
      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50 ||
        (!this.sequenceActive && sprite.y < -TOP_ESCAPE_PADDING);

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      const isOnGround = sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30;

      // Handle off-screen projectiles
      if (isOffscreen && !projectile.fadingOut && !projectile.shouldDestroy) {
        const reason = (!this.sequenceActive && sprite.y < -TOP_ESCAPE_PADDING) ? 'top-escape-post-sequence' : 'offscreen';
        console.log(`[OFF-SCREEN] Active projectile detected off-screen (${reason}), cleaning up...`);
        this.handleOffscreenActiveProjectile(projectile, i, { reason });
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
    // Save current powder as the start point for this round/sequence
    // This ensures "TRY AGAIN" restores to this specific amount
    this.roundStartPowder = this.powder;

    this.countdownActive = true;

    // Stop any existing countdown timer
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
        fontFamily: "'Orbitron', sans-serif",
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
    this.targetsInRound = this.getWaveTargetCount(this.currentRound);
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

  
  private getWaveTargetCount(round: number): number {
    // Custom progression: 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100
    if (round === 1) return 3;
    if (round === 2) return 5;
    if (round === 3) return 10;
    if (round === 4) return 15;
    if (round === 5) return 20;
    if (round === 6) return 25;
    if (round === 7) return 30;
    if (round === 8) return 40;
    if (round === 9) return 50;
    if (round === 10) return 75;
    return 100; // Cap at 100 for round 11+
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
    if (this.targetsSpawnedInRound >= this.targetsInRound || this.gameOver) {
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

    // Determine bright text color based on base reward (proxy for stage)
    // Adjusted colors to be more distinct as requested
    let textColor = '#ffffff';
    if (baseReward === 1) textColor = '#ff4444';       // Pure Light Red
    else if (baseReward === 2) textColor = '#ffaa00';  // Vibrant Orange
    else if (baseReward === 3) textColor = '#44ff44';  // Bright Green
    else if (baseReward === 4) textColor = '#aa44ff';  // Bright Purple

    const rewardDisplay = this.add.text(
      circle.fixedX,
      circle.fixedY,
      `+${baseReward}`,
      {
        fontSize: '32px',
        color: textColor,
        fontFamily: "'Orbitron', sans-serif",
        fontStyle: 'bold',
        stroke: '#ffd700', // Yellow outline
        strokeThickness: 4,
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

  private createProgressiveRewardDisplay(circle: TargetData, breakdown: RewardBreakdown, hitColor: number, hitQuality: string): void {
    // Remove base reward display if it exists
    this.removeRewardDisplay(circle);
    
    const x = circle.fixedX;
    const y = circle.fixedY;
    
    // Helper function to convert color number to CSS hex string
    const colorToCss = (color: number): string => {
      return '#' + color.toString(16).padStart(6, '0');
    };
    
    const hitColorCss = colorToCss(hitColor);
    
    // Build sequence of reward stages
    const sequence = this.buildRewardSequence(breakdown, hitColorCss, hitQuality);
    
    // Start playing the sequence
    this.playRewardSequence(x, y, sequence, 0);
  }
  
  private buildRewardSequence(breakdown: RewardBreakdown, hitColorCss: string, hitQuality: string): RewardStageConfig[] {
    const sequence: RewardStageConfig[] = [];
    const PINK = '#ff69b4';
    const BLUE = '#4169e1';
    const RED = '#e74c3c';
    
    // Dynamic timing and sizing
    let stageIndex = 0;
    const baseFontSize = 24; // Reasonable base size to avoid pixelation
    
    // Helper to create stage config with escalating impact
    const createStage = (text: string, color: string, key: string, logMsg: string) => {
      // 10% size increase per stage (smaller than before to avoid excessive size)
      const fontSize = Math.round(baseFontSize * Math.pow(1.10, stageIndex));
      // Moderate impact multiplier to avoid pixelation (max scale ~1.5)
      const impactMultiplier = 1.0 + (stageIndex * 0.1);
      
      const config: RewardStageConfig = {
        key,
        text,
        color,
        fontSize,
        logMessage: logMsg,
        impactDuration: 350 + (stageIndex * 50),
        holdDuration: 250 + (stageIndex * 40),
        fadeDuration: 200 + (stageIndex * 30),
        // Much smaller scale values to prevent pixelation
        impactScale: 1.2 * impactMultiplier,
        holdScale: 1.3 * impactMultiplier,
        fadeScale: 1.4 * impactMultiplier
      };
      
      stageIndex++;
      return config;
    };
    
    // Always show quality (including NOT BAD in red)
    sequence.push(createStage(hitQuality, hitQuality === 'NOT BAD' ? RED : hitColorCss, 'quality', `Quality: ${hitQuality}`));
    
    // Check if we have any modifiers
    const hasModifiers = breakdown.bonusAmount > 0 || breakdown.multiplier > 1;
    
    if (!hasModifiers) {
      // No modifiers: just show final total (skip base)
      const finalConfig = createStage(`${breakdown.finalTotal}`, hitColorCss, 'final', `Final total ${breakdown.finalTotal}`);
      sequence.push(finalConfig);
    } else {
      // Has modifiers: show full sequence
      
      // Base amount
      sequence.push(createStage(`${breakdown.baseAmount}`, hitColorCss, 'base', `Base amount ${breakdown.baseAmount}`));
      
      // Bonus (if applicable)
      if (breakdown.bonusAmount > 0) {
        sequence.push(createStage(`+${breakdown.bonusAmount}`, PINK, 'bonus', `Bonus +${breakdown.bonusAmount}`));
        sequence.push(createStage(`${breakdown.intermediateAfterBonus}`, hitColorCss, 'intermediate', `Intermediate total ${breakdown.intermediateAfterBonus}`));
      }
      
      // Multiplier (if applicable)
      if (breakdown.multiplier > 1) {
        sequence.push(createStage(`x${breakdown.multiplier}`, BLUE, 'multiplier', `Multiplier x${breakdown.multiplier}`));
      }
      
      // Final total
      const finalConfig = createStage(`${breakdown.finalTotal}`, hitColorCss, 'final', `Final total ${breakdown.finalTotal}`);
      sequence.push(finalConfig);
    }
    
    return sequence;
  }
  
  private playRewardSequence(x: number, y: number, sequence: RewardStageConfig[], index: number): void {
    if (index >= sequence.length || sequence.length === 0) {
      return;
    }
    
    const stage = sequence[index];
    const nextIndex = index + 1;
    const nextStageDelay = 60;
    
    console.log(`[REWARD] Stage ${index + 1}/${sequence.length}: ${stage.logMessage} (${stage.fontSize}px, ${stage.color})`);
    
    this.animateRewardStage(x, y, stage, () => {
      if (nextIndex < sequence.length) {
        this.time.delayedCall(nextStageDelay, () => {
          this.playRewardSequence(x, y, sequence, nextIndex);
        });
      }
    });
  }
  
  private animateRewardStage(x: number, y: number, stage: RewardStageConfig, onComplete: () => void): void {
    const rewardText = this.add.text(x, y, stage.text, {
      fontSize: `${stage.fontSize}px`,
      color: stage.color,
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5, 0.5);
    
    rewardText.setDepth(102);
    rewardText.setScale(0.8); // Start closer to target scale to reduce pixelation
    rewardText.setAlpha(0);
    
    const impactScale = stage.impactScale ?? 1.2;
    const holdScale = stage.holdScale ?? impactScale + 0.06;
    const fadeScale = stage.fadeScale ?? holdScale + 0.08;
    
    this.tweens.add({
      targets: rewardText,
      scale: impactScale,
      alpha: 1,
      duration: stage.impactDuration,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: rewardText,
          scale: holdScale,
          alpha: 1,
          duration: stage.holdDuration,
          ease: 'Sine.InOut',
          onComplete: () => {
            this.tweens.add({
              targets: rewardText,
              scale: fadeScale,
              alpha: 0,
              duration: stage.fadeDuration,
              ease: 'Cubic.In',
              onComplete: () => {
                try {
                  rewardText.destroy();
                } catch (_e) {
                  // Ignore destruction errors
                }
                onComplete();
              }
            });
          }
        });
      }
    });
  }

  private updateTargets(): void {
    const now = this.time.now;

    this.targets.forEach((targetData) => {
      if (targetData.hit) return;

      const elapsed = now - targetData.startTime;
      const progress = Math.min(elapsed / targetData.lifetime, 1);
      const timeRemaining = 1 - progress;

      // Use Lerp for smooth shrinking from startRadius down to MIN_RADIUS over the full lifetime
      // Formula: min + (max - min) * timeRemaining (where timeRemaining goes 1.0 -> 0.0)
      const currentRadius = TARGET_CONFIG.MIN_RADIUS + (targetData.initialRadius - TARGET_CONFIG.MIN_RADIUS) * timeRemaining;
      targetData.graphic.setRadius(currentRadius);
      targetData.ring.setRadius(currentRadius + 8);

      const body = targetData.sprite.body as Phaser.Physics.Arcade.Body;
      body.setCircle(currentRadius);

      targetData.graphic.setPosition(targetData.fixedX, targetData.fixedY);
      targetData.ring.setPosition(targetData.fixedX, targetData.fixedY);
      targetData.sprite.setPosition(targetData.fixedX, targetData.fixedY);

      // Fine-tuned progress for color thresholds (32%, 32%, 21%, 15%)
      // Red: 0 - 0.32 (32%)
      // Orange: 0.32 - 0.64 (32%)
      // Green: 0.64 - 0.85 (21%)
      // Purple: 0.85 - 1.0 (15%)
      
      let color: number;
      
      if (progress < 0.32) {
        color = TARGET_COLORS.RED;
      } else if (progress < 0.64) {
        color = TARGET_COLORS.ORANGE;
      } else if (progress < 0.85) {
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

      const alpha = Phaser.Math.Clamp(timeRemaining * 1.5, 0.15, 1);
      targetData.graphic.setAlpha(alpha);
      targetData.ring.setAlpha(alpha * 0.8);

      // Scale reward text with circle (min 50%)
      const rewardDisplay = this.rewardDisplays.get(targetData);
      if (rewardDisplay) {
        // Linear scaling from 1.0 down to 0.5
        const scale = 0.5 + (0.5 * timeRemaining);
        rewardDisplay.setScale(scale);
      }

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
      fontFamily: "'Orbitron', sans-serif", // Double quotes to ensure parsing
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

    if (!this.textures.exists('projectile-rocket')) {
      const graphics = this.add.graphics();
      
      // Create Rocket Shape (Pointing Right -> 0 degrees)
      // Overall size approx 40x20
      
      // 1. Body (Cylinder/Rect) - "NEEDLE" STYLE
      // Center Y is 16.
      // Height 4px -> Y 14 to 18.
      
      // Body
      graphics.fillStyle(0xdddddd, 1);
      graphics.fillRect(10, 14, 20, 4); // Height 4 (was 8)
      
      // 2. Nose Cone (Triangle)
      graphics.fillStyle(0xff0000, 1);
      graphics.beginPath();
      graphics.moveTo(30, 14);
      graphics.lineTo(40, 16); // Tip
      graphics.lineTo(30, 18);
      graphics.closePath();
      graphics.fillPath();
      
      // 3. Fins (Back) - tighter
      graphics.fillStyle(0x555555, 1);
      // Top Fin
      graphics.beginPath();
      graphics.moveTo(15, 14);
      graphics.lineTo(5, 10); // Very close
      graphics.lineTo(10, 14);
      graphics.closePath();
      graphics.fillPath();
      // Bottom Fin
      graphics.beginPath();
      graphics.moveTo(15, 18);
      graphics.lineTo(5, 22); // Very close
      graphics.lineTo(10, 18);
      graphics.closePath();
      graphics.fillPath();

      // 4. Window (Blue circle)
      graphics.fillStyle(0x00aaff, 1);
      graphics.fillCircle(20, 16, 3);

      // 5. Engine Glow (Rear) - Orange
      graphics.fillStyle(0xffaa00, 1);
      graphics.beginPath();
      graphics.moveTo(10, 12);
      graphics.lineTo(4, 16);
      graphics.lineTo(10, 20);
      graphics.closePath();
      graphics.fillPath();

      graphics.generateTexture('projectile-rocket', 44, 32);
      graphics.destroy();
    }

    const sprite = this.physics.add.sprite(x, y, 'projectile-rocket');
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

    console.log('[SHOOT-DEBUG] Projectile ready for aiming');
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
    this.lastDragPos = { x: pointer.x, y: pointer.y };
    this.activePointer = pointer;
    this.snappedVelocity = undefined;

    this.createJoypad(joypadX, joypadY);
    this.createProjectile(joypadX, joypadY);
    
    console.log('[JOYPAD-DEBUG] Joypad and projectile created for aiming, awaiting drag/release');

    if (this.joypad) {
      // Center the input relative to the joypad to prevent "jumping"
      const pointerWithSetter = pointer as Phaser.Input.Pointer & {
        setPosition?: (x: number, y: number) => void;
      };
      pointerWithSetter.setPosition?.(this.joypad.centerX, this.joypad.centerY);
      pointer.prevPosition.set(this.joypad.centerX, this.joypad.centerY);

      this.pointerOffsetX = this.joypad.centerX - pointer.x;
      this.pointerOffsetY = this.joypad.centerY - pointer.y;

      // Initial update to draw joypad at pointer position (which is now center)
      this.updateJoypad(this.joypad.centerX, this.joypad.centerY);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;
    
    this.lastDragPos = { x: pointer.x, y: pointer.y };

    if (this.activePointer && pointer.id !== this.activePointer.id) {
      return;
    }

    console.log('[JOYPAD-DEBUG] Drag detected, updating trajectory preview');

    const adjustedX = pointer.x + this.pointerOffsetX;
    const adjustedY = pointer.y + this.pointerOffsetY;
    
    // Store ADJUSTED position so update loop uses the correct reference
    this.lastDragPos = { x: adjustedX, y: adjustedY };

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
      this.fadeOutJoypadCost('cancelled', true);
      this.destroyJoypad();
      this.prepareNextShot();
      this.resetDragState();
      this.lastDragPos = null;
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
      // Fade out cost label on successful launch with linger effect
      this.fadeOutJoypadCost('successful launch', false, JOYPAD_COST_HOLD_MS, JOYPAD_COST_FADE_MS);
    } else {
      console.log('[JOYPAD-DEBUG] Launch failed');
      const reason = this.shotBlockedDueToPowder ? 'insufficient powder' : 'launch failed';
      this.fadeOutJoypadCost(reason, this.shotBlockedDueToPowder);
    }
    
    // Clear joypad UI immediately after shot
    this.destroyJoypad();

    if (!launched) {
      this.prepareNextShot();
    }

    this.resetDragState();
    this.lastDragPos = null;
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
        this.fadeOutJoypadCost('clearJoypadState', true);
        this.destroyJoypad();
        console.log('[INPUT] Joypad container destroyed');
      }
      
      // Call prepareNextShot to clean any pre-launch projectile
      this.prepareNextShot();
      
      // Reset drag tracking
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.isDragging = false;
      this.lastDragPos = null;
      
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
      this.lastDragPos = null;
    }
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.clearDragPointerData();
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastDragPos = null;
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

    // Calculate next shot cost based on HITS in sequence (+1)
    // Starts at 1 (0 hits + 1), increases only after a hit
    const nextShotCost = this.hitsInSequence + 1;
    
    // Create cost text showing powder cost for this shot
    // Centered in joypad, no animation
    const costText = this.add.text(x, centerY, `-${nextShotCost}`, {
      fontSize: '28px',
      color: '#ff3333',
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5, 0.5);
    
    costText.setDepth(56);

    container.add([base, powerLine, trajectoryLine, knob, costText]);
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
      costText,
    };

    if (this.joypad) {
        // Revert: Knob visible (alpha 1) as requested
        this.joypad.knob.setAlpha(1);
        
        // Remove projectile ring sync (keeps default)
        // User wants "original version" behavior for inner circle
    }

    console.log(`[JOYPAD] Cost label created: -${nextShotCost} powder`);

    if (this.currentProjectile) {
      this.currentProjectile.sprite.setPosition(x, centerY);
      this.currentProjectile.ring.setPosition(x, centerY);
    }
  }

  private updateJoypad(pointerX: number, pointerY: number): void {
    if (!this.joypad || !this.currentProjectile) return;

    // The knob now directly follows the pointer, clamped to the base radius
    const dx = pointerX - this.joypad.centerX;
    const dy = pointerY - this.joypad.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = JOYPAD_BASE_RADIUS; // Knob can move up to the edge of the base

    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);

    const knobX = this.joypad.centerX + Math.cos(angle) * clampedDistance;
    const knobY = this.joypad.centerY + Math.sin(angle) * clampedDistance;

    this.joypad.knob.setPosition(knobX, knobY);
    this.joypad.offsetX = knobX - this.joypad.centerX; // Offset from center to knob
    this.joypad.offsetY = knobY - this.joypad.centerY;

    if (this.currentProjectile) {
      this.currentProjectile.sprite.setPosition(this.joypad.centerX, this.joypad.centerY);
      this.currentProjectile.ring.setPosition(this.joypad.centerX, this.joypad.centerY);

      // Rotate arrow to point in drag direction (opposite of offset)
      const aimAngle = Math.atan2(-this.joypad.offsetY, -this.joypad.offsetX);
      this.currentProjectile.sprite.setRotation(aimAngle);
    }

    // Calculate power ratio for variable thickness
    const dragDistance = Math.sqrt(this.joypad.offsetX * this.joypad.offsetX + this.joypad.offsetY * this.joypad.offsetY);
    const minDrag = INPUT_THRESHOLDS.DRAG_MIN_DISTANCE;
    const maxDragForPower = JOYPAD_BASE_RADIUS; // Max distance for power calculation
    const powerRatio = Math.max(0, Math.min(1, (dragDistance - minDrag) / (maxDragForPower - minDrag)));
    
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
    const maxDrag = JOYPAD_BASE_RADIUS; // Joystick max distance
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

    const lineAlpha = isSnapped ? 0.7 : 0.45;
    
    // Interpolate base trajectory thickness from 2px to 6px based on power
    const baseLineWidth = 2 + powerRatio * 4;
    
    // Calculate gradient widths: taper from thin at origin to thick at target
    // Start width is 15% thinner, end width is now 38% thicker (20% increase from 1.15)
    const startWidth = baseLineWidth * 0.85; // 15% thinner at origin
    const endWidth = baseLineWidth * 1.38; // 38% thicker at target
    // Add +1px when snapped for visual distinction to the end width
    const finalEndWidth = isSnapped ? endWidth + 1 : endWidth;
    
    console.log(`[JOYPAD-DEBUG] Trajectory gradient: start=${startWidth.toFixed(2)}px, end=${finalEndWidth.toFixed(2)}px (power: ${(powerRatio * 100).toFixed(0)}%, snapped: ${isSnapped})`);

    // Draw trajectory but stop at circle boundary if aiming at a target
    let trajectoryLength = maxSteps;
    
    // Update joypad ring color to match targeted circle
    if (this.joypad && this.joypad.base) {
      if (isSnapped && snappedTargetData) {
        // Match target color when snapped - update ONLY outer ring (knob stays primary)
        const targetColor = snappedTargetData.graphic.fillColor;
        this.joypad.base.setStrokeStyle(3, targetColor, 1);
        
        // Reverted: Do NOT sync projectile ring or knob color
        // User requested: "revert to version ... inner circle didn't change its color"
      } else {
        // Revert to white/default when not snapped
        this.joypad.base.setStrokeStyle(3, COLORS.WHITE, 0.55);
      }
    }

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

    // Store trajectory points for gradient drawing
    const points: { x: number; y: number }[] = [];
    points.push({ x: px, y: py });

    for (let i = 0; i < trajectoryLength; i++) {
      px += vx * timeStep;
      py += drawVy * timeStep;
      drawVy += gravity * timeStep;
      points.push({ x: px, y: py });

      if (px < 0 || px > this.scale.width || py > this.scale.height) {
        break;
      }
    }

    // Draw trajectory with gradient width and color interpolation
    // Colors: red at origin (0xff0000), green at target (0x00ff00)
    const colorStart = { r: 255, g: 0, b: 0 }; // Red
    const colorEnd = { r: 0, g: 255, b: 0 }; // Green

    const interpolatedColors: { color: number; width: number }[] = [];

    // Draw trajectory with gradient width by drawing segments
    for (let i = 0; i < points.length - 1; i++) {
      const progress = i / (points.length - 1); // Normalized progress (0 to 1)
      const segmentWidth = startWidth + (finalEndWidth - startWidth) * progress;
      
      // Interpolate RGB values linearly from red to green
      const r = Math.round(
        colorStart.r * (1 - progress) + colorEnd.r * progress
      );
      const g = Math.round(
        colorStart.g * (1 - progress) + colorEnd.g * progress
      );
      const b = Math.round(
        colorStart.b * (1 - progress) + colorEnd.b * progress
      );

      // Convert RGB to 0xRRGGBB format
      const interpolatedColor = (r << 16) | (g << 8) | b;

      // Store for logging first segment
      if (i === 0) {
        interpolatedColors.push({
          color: interpolatedColor,
          width: segmentWidth,
        });
      }
      if (i === points.length - 2) {
        interpolatedColors.push({
          color: interpolatedColor,
          width: segmentWidth,
        });
      }

      this.joypad.trajectoryLine.lineStyle(
        segmentWidth,
        interpolatedColor,
        lineAlpha
      );
      this.joypad.trajectoryLine.beginPath();
      this.joypad.trajectoryLine.moveTo(points[i].x, points[i].y);
      this.joypad.trajectoryLine.lineTo(points[i + 1].x, points[i + 1].y);
      this.joypad.trajectoryLine.strokePath();
    }

    // Log color interpolation for QA validation
    if (interpolatedColors.length > 0) {
      const startColor = interpolatedColors[0];
      const endColor = interpolatedColors[interpolatedColors.length - 1];
      console.log(
        `[JOYPAD-DEBUG] Gradient colors: start=#${startColor.color.toString(16).padStart(6, '0')} (${startColor.width.toFixed(2)}px), end=#${endColor.color.toString(16).padStart(6, '0')} (${endColor.width.toFixed(2)}px)`
      );
    }

    // Draw snap indicator if snapped to target
    if (isSnapped && snappedTargetData) {
      this.joypad.trajectoryLine.lineStyle(2, 0x00ff00, 0.5);
      this.joypad.trajectoryLine.strokeCircle(snappedTargetData.fixedX, snappedTargetData.fixedY, snappedTargetData.graphic.radius + 15);
    }
  }

  private fadeOutJoypadCost(
    reason: string = 'default',
    immediate: boolean = false,
    holdDurationMs: number = 0,
    fadeDurationMs: number = 200
  ): void {
    if (!this.joypad || !this.joypad.costText) {
      return;
    }

    const joypad = this.joypad;
    const costText = joypad.costText!; // Non-null assertion - we've checked it exists

    if (!costText.active) {
      joypad.costText = undefined;
      if (joypad.costTween) {
        joypad.costTween.stop();
        joypad.costTween = undefined;
      }
      return;
    }

    if (joypad.costTween) {
      if (!immediate) {
        return;
      }

      joypad.costTween.stop();
      joypad.costTween = undefined;
    }

    if (immediate) {
      if (costText.parentContainer) {
        costText.parentContainer.remove(costText);
      }

      try {
        costText.destroy();
      } catch (_error) {
        // Ignore cleanup errors for cost text
      }

      joypad.costText = undefined;
      console.log(`[JOYPAD] Cost label cleared immediately (${reason})`);
      return;
    }

    if (costText.parentContainer) {
      costText.parentContainer.remove(costText);
    }
    
    // Re-add to scene display list so it remains visible after container destruction
    this.add.existing(costText);
    costText.setPosition(joypad.centerX, joypad.centerY);
    costText.setDepth(200); // High depth to stay visible

    // If holdDurationMs is specified, use a sequence of tweens (hold then fade)
    if (holdDurationMs > 0) {
      console.log(
        `[JOYPAD] Cost label lingering: ${holdDurationMs}ms hold + ${fadeDurationMs}ms fade (${reason})`
      );

      joypad.costTween = this.tweens.add({
        targets: costText,
        duration: holdDurationMs,
        onComplete: () => {
          // After hold completes, fade out
          if (joypad.costTween && !joypad.costTween.isDestroyed()) {
            joypad.costTween = undefined;
          }

          if (costText.active && costText.scene) {
            joypad.costTween = this.tweens.add({
              targets: costText,
              alpha: 0,
              duration: fadeDurationMs,
              ease: 'Quad.easeOut',
              onComplete: () => {
                try {
                  costText.destroy();
                } catch (_error) {
                  // Ignore destruction errors
                }

                if (this.joypad && this.joypad.costText === costText) {
                  this.joypad.costText = undefined;
                  this.joypad.costTween = undefined;
                }

                console.log(`[JOYPAD] Cost label faded after linger (${reason})`);
              },
              onStop: () => {
                if (this.joypad && this.joypad.costTween) {
                  this.joypad.costTween = undefined;
                }
              },
            });
          } else {
            // Text was destroyed during hold, clean up references
            if (this.joypad && this.joypad.costText === costText) {
              this.joypad.costText = undefined;
            }
          }
        },
        onStop: () => {
          if (this.joypad && this.joypad.costTween) {
            this.joypad.costTween = undefined;
          }
        },
      });
    } else {
      // Immediate fade without hold (backward compatible)
      joypad.costTween = this.tweens.add({
        targets: costText,
        alpha: 0,
        duration: fadeDurationMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          try {
            costText.destroy();
          } catch (_error) {
            // Ignore destruction errors
          }

          if (this.joypad && this.joypad.costText === costText) {
            this.joypad.costText = undefined;
            this.joypad.costTween = undefined;
          }

          console.log(`[JOYPAD] Cost label faded (${reason})`);
        },
        onStop: () => {
          if (this.joypad && this.joypad.costTween) {
            this.joypad.costTween = undefined;
          }
        },
      });
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
    this.shotBlockedDueToPowder = false;

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

    // Calculate cost based on Hits (+1)
    const cost = this.hitsInSequence + 1;

    // Check if player has enough powder (unless infinite)
    if (this.powder < cost) {
      console.log('[INPUT] Insufficient powder for shot. Have:', this.powder, 'Need:', cost);
      this.shotBlockedDueToPowder = true;
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

    // Start trail effect
    this.currentProjectile.trailEmitter = this.particleManager.createProjectileTrail(this.currentProjectile.sprite);
    
    // Hide the aiming ring once launched
    if (this.currentProjectile.ring) {
      this.currentProjectile.ring.setVisible(false);
    }

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
        
        // FIX: Emit explosion
        this.particleManager.emitExplosion(launchedProjectile.sprite.x, launchedProjectile.sprite.y);
        
        this.missesInSequence++; // Ensure miss is counted
        this.onMiss(); // Reset multiplier

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
    
    // Cost per shot scales with position in sequence
    // CORRECT FIX: Use same logic as validation (Hits + 1) to avoid negative powder bugs
    const shotCost = this.hitsInSequence + 1;
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

  private handleOffscreenProjectile(options: { reason?: string } = {}): void {
    const { reason = 'offscreen' } = options;
    console.log(`[OFF-SCREEN] handleOffscreenProjectile called (${reason})`);
    
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

    console.log(`[OFF-SCREEN] Starting cleanup sequence - projectile position:`, 
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
        fontFamily: "'Orbitron', sans-serif", // Double quotes to ensure parsing
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

      // Only count as miss if it's a true miss (not post-sequence top escape)
      if (reason !== 'top-escape-post-sequence') {
        this.missesInSequence++;
        // Handle miss mechanics (reset streaks/bonus)
        this.onMiss();
      } else {
        console.log('[OFF-SCREEN] Skipping miss counter for post-sequence top escape');
      }

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


      // Stop trail if it exists
      if (projectile.trailEmitter) {
        this.particleManager.stopTrail(projectile.trailEmitter);
        projectile.trailEmitter = undefined;
      }

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
      this.fadeOutJoypadCost('offscreen cleanup', true);
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
        this.fadeOutJoypadCost('offscreen cleanup failsafe', true);
        this.destroyJoypad();
        this.resetDragState();
        this.enableSlingshot();
      } catch (_e2) {
        // Last resort: just clear the reference
        this.currentProjectile = undefined;
      }
    }
  }

  private commonProjectileCleanup(projectile: ProjectileData, context: string): void {
    try {
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.stop();
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        body.enable = false;
        try {
          body.world.remove(body);
        } catch (_error) {
          // Ignore removal errors
        }
      }
    } catch (error) {
      console.error(`[CLEANUP] Error disabling physics (${context}):`, error);
    }

    try {
      projectile.sprite.destroy();
    } catch (error) {
      console.error(`[CLEANUP] Error destroying sprite (${context}):`, error);
    }

    try {
      projectile.ring.destroy();
    } catch (error) {
      console.error(`[CLEANUP] Error destroying ring (${context}):`, error);
    }

    console.log(`[CLEANUP] Projectile destroyed (${context})`);
  }

  private destroyProjectileOnGroundImpact(reason: string = 'ground-impact-current'): void {
    if (!this.currentProjectile) {
      console.log('[GROUND-IMPACT] No current projectile to clean up');
      return;
    }

    const projectile = this.currentProjectile;

    if (projectile.fadingOut) {
      console.log('[GROUND-IMPACT] Current projectile already cleaning up');
      return;
    }

    projectile.fadingOut = true;
    projectile.shouldDestroy = true;

    this.missesInSequence++;
    this.onMiss();

    // Trigger explosion effect
    this.particleManager.emitExplosion(projectile.sprite.x, projectile.sprite.y);
    
    // Stop the specific trail for this projectile
    if (projectile.trailEmitter) {
      this.particleManager.stopTrail(projectile.trailEmitter);
      projectile.trailEmitter = undefined;
    }

    this.commonProjectileCleanup(projectile, reason);

    this.currentProjectile = undefined;

    this.fadeOutJoypadCost(reason, true);
    this.destroyJoypad();
    this.resetDragState();
    this.enableSlingshot();
  }

  private destroyActiveProjectileOnGroundImpact(
    projectile: ProjectileData,
    index: number,
    reason: string = 'ground-impact-active'
  ): void {
    if (!projectile) {
      console.log('[GROUND-IMPACT] No active projectile to clean up');
      return;
    }

    if (projectile.fadingOut) {
      console.log('[GROUND-IMPACT] Active projectile already cleaning up');
      return;
    }

    projectile.fadingOut = true;
    projectile.shouldDestroy = true;

    this.missesInSequence++;
    this.onMiss();

    // Trigger explosion effect
    this.particleManager.emitExplosion(projectile.sprite.x, projectile.sprite.y);
    
    // Stop the specific trail for this projectile
    if (projectile.trailEmitter) {
      this.particleManager.stopTrail(projectile.trailEmitter);
      projectile.trailEmitter = undefined;
    }
    
    this.commonProjectileCleanup(projectile, reason);

    this.activeProjectiles.splice(index, 1);
    this.enableSlingshot();
  }

  private destroyProjectileImmediately(): void {
    this.destroyProjectileOnGroundImpact('ground-immediate-current');
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


    const currentColor = targetData.graphic.fillColor;

    let powderReward: number = POWDER_REWARDS.RED;
    let hitQuality: string = 'NOT BAD';

    if (currentColor === TARGET_COLORS.PURPLE) {
      powderReward = POWDER_REWARDS.PURPLE;
      hitQuality = 'PERFECT';
    } else if (currentColor === TARGET_COLORS.GREEN) {
      powderReward = POWDER_REWARDS.GREEN;
      hitQuality = 'AWESOME'; // Green is AWESOME
    } else if (currentColor === TARGET_COLORS.ORANGE) {
      powderReward = POWDER_REWARDS.ORANGE;
      hitQuality = 'NICE'; // Orange is NICE
    } else {
      powderReward = POWDER_REWARDS.RED;
      hitQuality = 'NOT BAD'; // Red is NOT BAD
    }

    // Trigger FIREWORK effect
    // Map visual tier to quality - DIRECT MAPPING
    // hitQuality now holds 'NOT BAD', 'NICE', 'AWESOME', 'PERFECT'
    // particleManager handles these strings directly now.
    
    this.particleManager.createFirework(targetData.sprite.x, targetData.sprite.y, hitQuality);

    // Apply multiplier to reward if active
    // if (this.streakMultiplier > 1) { } // Removed logic

    const breakdown = this.processPowderReward(powderReward, currentColor === TARGET_COLORS.PURPLE);
    const oldPowder = this.powder;

    this.powder += breakdown.finalTotal;
    this.totalPowderEarned += breakdown.finalTotal;
    if (breakdown.finalTotal > this.bestHit) {
      this.bestHit = breakdown.finalTotal;
    }

    // Display reward feedback
    this.displayPowderTransactionFeedback(breakdown.finalTotal, true);
    this.animatePowderCounter(oldPowder, this.powder, true);
    


    // Create progressive reward display at circle center
    this.createProgressiveRewardDisplay(targetData, breakdown, currentColor, hitQuality);

    // Legacy hit feedback removed in favor of progressive reward display

    // Remove target immediately (both circle and sprite disappear)
    this.removeTarget(targetData);
    this.updatePowderText();
    
    console.log('[HIT] Target processing complete');
  }

  private removeTarget(targetData: TargetData): void {
    // NOTE: Do NOT remove reward display here, as it needs to persist after target death
    // The reward display cleans itself up via tweens
    
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    targetData.ring.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }


  private processPowderReward(baseReward: number, isPerfect: boolean): RewardBreakdown {
    let bonusAmount = 0;
    
    // Handle perfect hit tracking and bonus stage
    if (isPerfect) {
      this.consecutivePerfects++;
      
      // Activate bonus after 3 perfects
      if (this.consecutivePerfects === 3) {
        this.bonusStageActive = true;
        this.activateBonusModeVisual();
        this.showStatusIndicator('BONUS ENABLED', '#00ff00');
      }
      
      // Apply bonus multiplier
      if (this.bonusStageActive && this.consecutivePerfects > 3) {
        bonusAmount = this.consecutivePerfects - 3; // 1, 2, 3, 4...
        this.showStatusIndicator(`+${bonusAmount} BONUS`, '#00ff00');
      }
    } else {
      // Non-perfect hit - exit bonus
      if (this.bonusStageActive) {
        this.deactivateBonusModeVisual();
        this.showStatusIndicator('BONUS LOST', '#ff0000');
      }
      this.bonusStageActive = false;
      this.consecutivePerfects = 0;
    }
    
    // Track consecutive hits
    this.consecutiveHits++;
    this.updateStreakMultiplier();
    
    // Calculate breakdown
    const intermediateAfterBonus = baseReward + bonusAmount;
    const finalTotal = intermediateAfterBonus * this.streakMultiplier;
    
    const breakdown: RewardBreakdown = {
      baseAmount: baseReward,
      bonusAmount: bonusAmount,
      multiplier: this.streakMultiplier,
      intermediateAfterBonus: intermediateAfterBonus,
      finalTotal: finalTotal
    };
    
    // Update streak display
    if (this.streakCounterText && this.streakCounterText.active) {
     this.streakCounterText.setText(`Streak: ${this.consecutiveHits}`);
    }

    // Apply streak increment cue
    this.applyStreakIncrementCue();
    
    console.log(`[REWARD] Breakdown: base=${breakdown.baseAmount}, bonus=${breakdown.bonusAmount}, multiplier=${breakdown.multiplier}x, intermediate=${breakdown.intermediateAfterBonus}, final=${breakdown.finalTotal}`);
    
    return breakdown;
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
      this.showStatusIndicator('BONUS LOST', '#ff0000');
    }
    this.bonusStageActive = false;
    this.consecutivePerfects = 0;
    
    // Update streak displays
    if (this.streakCounterText && this.streakCounterText.active) {
     this.streakCounterText.setText('Streak: 0');
    }
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

  private showStatusIndicator(
    mainText: string,
    color: string,
    subText?: string
  ): void {
    const request: StatusIndicatorRequest = {
      mainText,
      subText,
      color,
      requestedAt: this.time ? this.time.now : 0
    };

    this.statusIndicatorQueue.push(request);
    this.processStatusIndicatorQueue();
  }

  private processStatusIndicatorQueue(): void {
    while (this.statusIndicators.length < STATUS_INDICATOR_MAX && this.statusIndicatorQueue.length > 0) {
      const nextRequest = this.statusIndicatorQueue.shift();
      if (nextRequest) {
        this.spawnStatusIndicator(nextRequest);
      }
    }
  }

  private spawnStatusIndicator(request: StatusIndicatorRequest): void {
    // Position at left of screen below powder HUD
    const container = this.add.container(this.powderHudPaddingX, this.powderHudPaddingY);
    container.setDepth(STATUS_INDICATOR_DEPTH);
    container.setAlpha(0);

    const main = this.add.text(0, 0, request.mainText, {
      fontSize: '40px', // Increased by another 50% (was 27px)
      color: request.color,
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0, 0.5);

    const sub = this.add.text(0, STATUS_INDICATOR_SUBTEXT_OFFSET, request.subText || '', {
      fontSize: '22px', // Increased by another 50% (was 15px)
      color: request.color,
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);

    container.add([main, sub]);

    const indicator: ActiveStatusIndicator = { container };
    this.statusIndicators.push(indicator);

    this.layoutStatusIndicators();

    const delay = this.computeStatusIndicatorDelay(request.requestedAt);

    indicator.introTween = this.tweens.add({
      targets: container,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.9, to: 1 },
      scaleY: { from: 0.9, to: 1 },
      duration: STATUS_INDICATOR_ENTRY_DURATION,
      ease: 'Back.easeOut',
      delay
    });

    indicator.timer = this.time.delayedCall(
      delay + STATUS_INDICATOR_ENTRY_DURATION + STATUS_INDICATOR_HOLD_DURATION,
      () => this.fadeOutStatusIndicator(indicator)
    );
  }

  private layoutStatusIndicators(): void {
    // Position under powder HUD, stacked vertically
    const baseY = this.powderHudPaddingY + 60; // Below powder HUD with spacing
    const spacing = STATUS_INDICATOR_SPACING;
    const baseX = this.powderHudPaddingX;

    this.statusIndicators.forEach((indicator, index) => {
      const container = indicator.container;
      if (!container || !container.active) {
        return;
      }

      container.setDepth(STATUS_INDICATOR_DEPTH);
      const targetX = baseX;
      const targetY = baseY + index * spacing;

      if (Math.abs(container.x - targetX) < 1 && Math.abs(container.y - targetY) < 1) {
        container.setPosition(targetX, targetY);
        return;
      }

      this.tweens.add({
        targets: container,
        x: targetX,
        y: targetY,
        duration: 200,
        ease: 'Quad.easeOut'
      });
    });
  }

  private computeStatusIndicatorDelay(requestedAt: number): number {
    if (this.statusIndicatorLastRequestTime === null) {
      this.statusIndicatorLastRequestTime = requestedAt;
      this.statusIndicatorBurstCount = 0;
      return 0;
    }

    const delta = requestedAt - this.statusIndicatorLastRequestTime;

    if (delta <= STATUS_INDICATOR_BURST_THRESHOLD) {
      this.statusIndicatorBurstCount += 1;
    } else {
      this.statusIndicatorBurstCount = 0;
    }

    this.statusIndicatorLastRequestTime = requestedAt;
    return this.statusIndicatorBurstCount * STATUS_INDICATOR_STAGGER_STEP;
  }

  private fadeOutStatusIndicator(indicator: ActiveStatusIndicator): void {
    if (indicator.timer) {
      indicator.timer.remove();
      indicator.timer = undefined;
    }

    if (!indicator.container || !indicator.container.active) {
      this.destroyStatusIndicator(indicator);
      return;
    }

    indicator.fadeTween = this.tweens.add({
      targets: indicator.container,
      alpha: { from: indicator.container.alpha, to: 0 },
      scaleX: { from: indicator.container.scaleX, to: 0.95 },
      scaleY: { from: indicator.container.scaleY, to: 0.95 },
      duration: STATUS_INDICATOR_FADE_DURATION,
      ease: 'Cubic.easeIn',
      onComplete: () => this.destroyStatusIndicator(indicator)
    });
  }

  private destroyStatusIndicator(indicator: ActiveStatusIndicator, suppressQueueProcessing: boolean = false): void {
    if (indicator.timer) {
      indicator.timer.remove();
      indicator.timer = undefined;
    }

    if (indicator.introTween) {
      indicator.introTween.stop();
      indicator.introTween = undefined;
    }

    if (indicator.fadeTween) {
      indicator.fadeTween.stop();
      indicator.fadeTween = undefined;
    }

    const index = this.statusIndicators.indexOf(indicator);
    if (index !== -1) {
      this.statusIndicators.splice(index, 1);
    }

    try {
      indicator.container.destroy();
    } catch (_e) {
      // Ignore destruction errors
    }

    if (!suppressQueueProcessing) {
      this.layoutStatusIndicators();
      this.processStatusIndicatorQueue();
    }
  }

  private clearStatusIndicators(): void {
    this.statusIndicatorQueue = [];
    this.statusIndicatorLastRequestTime = null;
    this.statusIndicatorBurstCount = 0;

    while (this.statusIndicators.length > 0) {
      const indicator = this.statusIndicators.pop();
      if (indicator) {
        this.destroyStatusIndicator(indicator, true);
      }
    }

    this.layoutStatusIndicators();
  }

  private cleanupProjectileAfterHit(): void {
    console.log('[CLEANUP] cleanupProjectileAfterHit called - safe cleanup outside collision handler');
    
    if (!this.currentProjectile) {
      console.log('[CLEANUP] No projectile to clean up');
      return;
    }

    const projectile = this.currentProjectile;
    
    // Stop trail if it exists (on hit)
    if (projectile.trailEmitter) {
      this.particleManager.stopTrail(projectile.trailEmitter);
      projectile.trailEmitter = undefined;
    }

    this.commonProjectileCleanup(projectile, 'hit-current');

    this.currentProjectile = undefined;
    this.snappedVelocity = undefined;
    this.fadeOutJoypadCost('hit-current', true);
    this.destroyJoypad();
    this.resetDragState();
    this.enableSlingshot();
    
    console.log('[CLEANUP] Cleanup complete, input re-enabled for next shot');
  }

  private prepareNextShot(): void {
    console.log('[CLEANUP] prepareNextShot called');
    
    if (this.currentProjectile) {
      this.commonProjectileCleanup(this.currentProjectile, 'prepare-next-shot-current');
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
    
    // Stop trail if it exists (on hit)
    if (projectile.trailEmitter) {
      this.particleManager.stopTrail(projectile.trailEmitter);
      projectile.trailEmitter = undefined;
    }

    this.commonProjectileCleanup(projectile, 'hit-active');

    this.activeProjectiles.splice(index, 1);
    this.enableSlingshot();
    
    console.log('[CLEANUP] Active projectile cleanup complete. Remaining active:', this.activeProjectiles.length);
  }

  private handleOffscreenActiveProjectile(projectile: ProjectileData, index: number, options: { reason?: string } = {}): void {
    const { reason = 'offscreen' } = options;
    console.log(`[OFF-SCREEN] handleOffscreenActiveProjectile called (${reason})`);
    
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
        fontFamily: '"Orbitron", sans-serif',
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

      // Only count as miss if it's a true miss (not post-sequence top escape)
      if (reason !== 'top-escape-post-sequence') {
        this.missesInSequence++;
        // Handle miss mechanics (reset streaks/bonus)
        this.onMiss();
      } else {
        console.log('[OFF-SCREEN] Skipping miss counter for post-sequence top escape');
      }

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
    
    // Guard against double-spawn of dust particles
    if (projectile.fadingOut || projectile.shouldDestroy) {
      console.log('[GROUND-FADE] Active projectile already marked for cleanup, skipping dust FX');
      return;
    }
    
    // Register as miss
    this.missesInSequence++;

    // Handle miss mechanics (reset streaks/bonus)
    this.onMiss();

    // Ground impact particles are spawned when the collision is detected before this point

    try {
      if (projectile.trailEmitter) {
        this.particleManager.stopTrail(projectile.trailEmitter);
        projectile.trailEmitter = undefined;
      }
      
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

    // Structured powder HUD container (label, value, transaction)
    this.powderHudPaddingX = Math.max(20, width * 0.02);
    this.powderHudPaddingY = Math.max(24, height * 0.03); // Common baseline Y

    this.roundText = this.add.text(
      width / 2,
      this.powderHudPaddingY,
      `Round ${this.currentRound}`,
      createTextStyle('32px', '#ffffff')
    );
    this.roundText.setOrigin(0.5, 0.5); // Center aligned
    this.roundText.setDepth(100);

    this.powderHudContainer = this.add.container(this.powderHudPaddingX, this.powderHudPaddingY);
    this.powderHudContainer.setDepth(100);

    this.powderLabel = this.add.text(0, 0, 'POWDER', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);

    this.powderValue = this.add.text(0, 0, this.powder.toString(), {
      fontSize: '28px',
      color: '#FFD700',
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);

    this.transactionText = this.add.text(0, 0, '', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: "'Orbitron', sans-serif",
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0, 0.5);
    this.transactionText.setVisible(false);
    this.transactionText.setAlpha(0);

    this.powderHudContainer.add([this.powderLabel, this.powderValue, this.transactionText]);

    // Keep original powderText for backward compatibility with existing animation methods
    this.powderText = this.add.text(
      this.powderHudPaddingX,
      this.powderHudPaddingY - 14,
      `POWDER: ${this.powder}`,
      createTextStyle('28px', '#FFD700')
    );
    this.powderText.setOrigin(0, 0);
    this.powderText.setDepth(90); // Behind the new elements
    this.powderText.setVisible(false); // Hide the original

    this.layoutPowderHud();

    this.sequenceProgressText = this.add.text(
      width - 20,
      this.powderHudPaddingY,
      `Targets: 0/${this.targetsInRound}`,
      createTextStyle('24px', '#ffffff')
    );
    this.sequenceProgressText.setOrigin(1, 0.5); // Align right, vertically centered
    this.sequenceProgressText.setDepth(100);

    // HITS Counter (New)
    this.hitsText = this.add.text(
      width - 20,
      this.powderHudPaddingY + 30,
      'HITS: 0',
      createTextStyle('20px', '#ffff00') // Yellow for visibility
    );
    this.hitsText.setOrigin(1, 0.5);
    this.hitsText.setDepth(100);

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

    // Fade out instructions after short delay
    this.time.delayedCall(3000, () => {
      if (this.instructionsText && this.instructionsText.active) {
        this.tweens.add({
          targets: this.instructionsText,
          alpha: 0,
          duration: 1000,
          onComplete: () => {
            if (this.instructionsText) this.instructionsText.setVisible(false);
          }
        });
      }
    });
  }

  private updatePowderText(): void {
    // Check if text objects exist and are valid before accessing them
    if (!this.powderValue || !this.powderValue.active) {
      return;
    }
    
    // Update the new separated value element
    this.powderValue.setText(this.powder.toString());
    
    // Also update the hidden original for backward compatibility
    if (this.powderText && this.powderText.active) {
      this.powderText.setText(`POWDER: ${this.powder}`);
    }

    this.layoutPowderHud();
  }

  private layoutPowderHud(): void {
    if (!this.powderLabel || !this.powderLabel.active || 
        !this.powderValue || !this.powderValue.active || 
        !this.transactionText || !this.transactionText.active) {
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
    if (!this.transactionText || !this.transactionText.active) {
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
      duration: 1350, // 125% longer than original 600 (another 50% on top of previous 50%)
      delay: 900,     // 125% longer than original 400 (another 50% on top of previous 50%)
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.transactionText && this.transactionText.active) {
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

    if (this.transactionText && this.transactionText.active) {
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
    // Check if text object exists and is valid before accessing it
    if (!this.streakMultiplierText || !this.streakMultiplierText.active) {
      return;
    }
    
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
    // Check if text object exists and is valid before accessing it
    if (!this.streakMultiplierText || !this.streakMultiplierText.active) {
      return;
    }
    
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
        if (this.streakMultiplierText && this.streakMultiplierText.active) {
          this.streakMultiplierText.setColor(originalColor);
        }
      });
    }
  }

  private refreshMultiplierDisplay(): void {
    // Check if text object exists and is valid before accessing it
    if (!this.streakMultiplierText || !this.streakMultiplierText.active) {
      return;
    }
    
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
    // Check if text object exists and is valid before accessing it
    if (!this.streakMultiplierText || !this.streakMultiplierText.active) {
      return;
    }
    
    // Only animate if multiplier display is visible (multiplier > 1)
    if (this.streakMultiplierText.visible) {
      const originalColor = '#ffaa00'; // Orange - original multiplier color
      this.streakMultiplierText.setColor('#ff0000');

      this.time.delayedCall(300, () => {
        if (this.streakMultiplierText && this.streakMultiplierText.active) {
          this.streakMultiplierText.setColor(originalColor);
        }
      });
    }
  }

  private updateRoundText(): void {
    if (!this.roundText || !this.roundText.active) {
      return;
    }
    this.roundText.setText(`Round ${this.currentRound}`);
  }

  private updateSequenceProgressText(): void {
    if (this.sequenceProgressText && this.sequenceProgressText.active) {
      // Show progress as Tasks Spawned / Total (instead of Completed/Total)
      // This addresses "Targets counter not updating correctly"
      this.sequenceProgressText.setText(`Targets: ${this.targetsSpawnedInRound}/${this.targetsInRound}`);
    }
    
    if (this.hitsText && this.hitsText.active) {
      this.hitsText.setText(`HITS: ${this.hitsInSequence}`);
    }
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
        fontFamily: "'Orbitron', sans-serif",
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
        fontFamily: "'Orbitron', sans-serif",
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
        fontFamily: "'Orbitron', sans-serif",
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
      width / 2 - 185, // Adjust position for wider buttons
      height / 2 + 130,
      'TRY AGAIN',
      () => {
        destroyUI();
        
        // Store round start powder for restore
        const retryPowder = this.roundStartPowder;
        
        // Restart same sequence with countdown
        this.roundComplete = false;
        this.sequenceActive = false;
        this.hitsInSequence = 0;
        this.missesInSequence = 0;
        this.shotsInCurrentSequence = 0;
        
        // Restore powder to what it was at START of round/sequence
        this.powder = retryPowder;
        this.updatePowderText(); // Update UI immediately
        
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
      175, // 25% wider (was 140)
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
      175, // 25% wider (was 140)
      60
    );
    restartButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2 + 185, // Adjust position for wider buttons
      height / 2 + 130,
      'MENU',
      () => {
        destroyUI();
        
        // Return to main menu
        this.scene.stop();
        this.scene.start(SCENES.MAIN_MENU);
      },
      175, // 25% wider (was 140)
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
        fontFamily: '"Orbitron", sans-serif',
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
    if (this.streakCounterText && this.streakCounterText.active) {
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
    
    // Stop sequence timer to prevent new targets spawning
    if (this.sequenceTimer) {
        this.sequenceTimer.remove();
        this.sequenceTimer = null;
    }
    
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
      fontFamily: "'Orbitron', sans-serif",
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
        fontFamily: "'Orbitron', sans-serif",
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
      width / 2, // Center
      height / 2 + 120,
      'RESTART',
      () => {
        this.scene.stop();
        this.scene.start(SCENES.SLINGSHOT);
      },
      175,
      60
    );
    restartButton.setDepth(201);

    const tryAgainButton = createButton(
      this,
      width / 2 - 200, // Left
      height / 2 + 120,
      'TRY AGAIN',
      () => {
        destroyUI();
        
        // Store round start powder for restore
        const retryPowder = this.roundStartPowder;
        
        // Restart logic
        this.roundComplete = false;
        this.sequenceActive = false;
        this.hitsInSequence = 0;
        this.missesInSequence = 0;
        this.shotsInCurrentSequence = 0;
        
        // Restore powder
        this.powder = retryPowder;
        this.updatePowderText();
        
        // CRITICAL: Force clear all timers
        this.time.removeAllEvents();
        
        // Clean up remaining targets to respawn them fresh
        if (this.targets) {
            this.targets.forEach(target => this.removeTarget(target));
            this.targets = [];
        }

        // Clean up any projectiles
        if (this.activeProjectiles) {
            this.activeProjectiles.forEach(p => {
               if (p.sprite) p.sprite.destroy();
               if (p.ring) p.ring.destroy();
            });
            this.activeProjectiles = [];
        }
        
        // Start countdown for retry
        this.gameOver = false; // Reset flag!
        this.startCountdown();
      },
      175,
      60
    );
    tryAgainButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2 + 200, // Right
      height / 2 + 120,
      'MENU',
      () => {
        this.scene.stop();
        this.scene.start(SCENES.MAIN_MENU);
      },
      175,
      60
    );
    menuButton.setDepth(201);

    // Helpers to clear UI
    function destroyUI() {
        overlay.destroy();
        gameOverText.destroy();
        statsText.destroy();
        restartButton.destroy();
        menuButton.destroy();
        tryAgainButton.destroy();
    }

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
