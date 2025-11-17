import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS, TARGET_COLORS, POWDER_REWARDS } from '@/utils/constants';
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
}

interface JoypadUI {
  container: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  powerLine: Phaser.GameObjects.Graphics;
  trajectoryLine: Phaser.GameObjects.Graphics;
  centerX: number;
  centerY: number;
  groundY: number;
  offsetX: number;
  offsetY: number;
}

interface ProjectileData {
  sprite: Phaser.Physics.Arcade.Sprite;
  ring: Phaser.GameObjects.Arc;
  targetColor: number;
  fadingOut: boolean;
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
  private powderText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private sequenceProgressText!: Phaser.GameObjects.Text;

  private isDragging: boolean = false;
  private currentProjectile?: ProjectileData;

  private targets: TargetData[] = [];
  private ground!: Phaser.GameObjects.Rectangle;

  private joypad?: JoypadUI;
  private projectileIdleTimer: number = 0;
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

  constructor() {
    super({ key: SCENES.SLINGSHOT });
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
        target.sprite.destroy();
        target.graphic.destroy();
        target.ring.destroy();
      });
      this.targets = [];
    }

    this.resetDragState();

    this.projectileIdleTimer = 0;
    this.snappedVelocity = undefined;

    this.roundComplete = false;
    this.gameOver = false;
    this.firstSequenceStarted = false;
    this.sequenceActive = false;
    this.countdownActive = false;

    this.hitsInSequence = 0;
    this.missesInSequence = 0;

    this.currentRound = 1;
    this.targetsInRound = 1;
    this.targetsRemainingInRound = 0;
    this.targetsSpawnedInRound = 0;
    this.powder = GAME_SETTINGS.INITIAL_POWDER;
    this.totalPowderEarned = 0;
    this.bestHit = 0;

    if (this.input) {
      this.input.removeAllListeners();
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

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

  update(_time: number, delta: number): void {
    // Don't update game state when round is complete or game is over
    if (this.roundComplete || this.gameOver) {
      return;
    }

    this.updateTargets();

    if (this.currentProjectile && !this.isDragging) {
      const sprite = this.currentProjectile.sprite;
      const ring = this.currentProjectile.ring;
      const body = sprite.body as Phaser.Physics.Arcade.Body;

      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50 ||
        sprite.y < -50;

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      const isOnGround = sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30;

      if (isOffscreen && !this.currentProjectile.fadingOut) {
        console.log('[OFF-SCREEN] Projectile detected off-screen, cleaning up...');
        this.handleOffscreenProjectile();
      } else if (hasLowVelocity && isOnGround && !this.currentProjectile.fadingOut) {
        this.projectileIdleTimer += delta;

        if (this.projectileIdleTimer >= GAME_SETTINGS.PROJECTILE_IDLE_TIME) {
          this.fadeOutProjectile();
        }
      } else {
        this.projectileIdleTimer = 0;
      }

      // Manual radius-based collision detection for improved hit detection
      if (!this.currentProjectile.fadingOut) {
        this.checkManualCollisions();
      }

      if (ring && !this.currentProjectile.fadingOut) {
        ring.setPosition(sprite.x, sprite.y);
      }

      // Keep particle emitter following projectile and rotate arrow to velocity direction
      if (this.currentProjectile.particles && !this.currentProjectile.fadingOut) {
        this.currentProjectile.particles.setPosition(sprite.x, sprite.y);
      }

      // Rotate arrow to point in direction of travel during flight
      if (!this.currentProjectile.fadingOut && (Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1)) {
        const angle = Math.atan2(body.velocity.y, body.velocity.x);
        sprite.setRotation(angle);
      }
    }

    if (this.targetsRemainingInRound === 0 && 
        this.targetsSpawnedInRound === this.targetsInRound && 
        !this.roundComplete && 
        !this.gameOver &&
        this.sequenceActive) {
      this.handleSequenceComplete();
    }
  }

  private checkManualCollisions(): void {
    if (!this.currentProjectile || this.currentProjectile.fadingOut) {
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
        console.log('[HIT] Manual collision detected!');
        this.handleTargetHit(target);
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
    
    // Clear any existing targets
    this.targets.forEach(target => this.removeTarget(target));
    this.targets = [];
    
    this.updateRoundText();
    this.updateSequenceProgressText();
    
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

  private spawnTarget(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const fixedX = Phaser.Math.Between(200, width - 200);
    // Ensure circles spawn in upper 50% of screen (between 10% and 50% of screen height)
    const fixedY = Phaser.Math.Between(height * 0.1, height * 0.5);

    const initialRadius = 60;
    const lifetime = 5000;

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
    };

    this.targets.push(targetData);

    if (this.currentProjectile) {
      this.physics.add.overlap(this.currentProjectile.sprite, sprite, () => {
        this.handleTargetHit(targetData);
      });
    }
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
  }

  private handleTargetMiss(targetData: TargetData): void {
    const x = targetData.fixedX;
    const y = targetData.fixedY;

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

    if (!this.textures.exists('trail-particle')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0xcccccc, 1);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture('trail-particle', 4, 4);
      graphics.destroy();
    }

    const sprite = this.physics.add.sprite(x, y, 'projectile-arrow');

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setBounce(0.2);
    body.setCircle(8);
    body.setMass(0.5);
    body.setAllowGravity(false);

    sprite.setDepth(60);

    const ring = this.add.circle(x, y, 25, 0x00000000);
    ring.setStrokeStyle(3, TARGET_COLORS.RED, 0.7);
    ring.setDepth(59);

    // Create particle emitter for trail (not active yet, will activate on launch)
    const particles = this.add.particles(x, y, 'trail-particle', {
      speed: 0,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      frequency: 50,
      blendMode: 'NORMAL',
    });
    particles.setDepth(58);
    particles.stop();

    this.currentProjectile = {
      sprite,
      ring,
      targetColor: TARGET_COLORS.RED,
      fadingOut: false,
      particles,
    };
  }

  private setupInput(): void {
    this.input.removeAllListeners();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    console.log('[INPUT] PointerDown - gameOver:', this.gameOver, 'roundComplete:', this.roundComplete, 'isDragging:', this.isDragging, 'hasProjectile:', !!this.currentProjectile, 'sequenceActive:', this.sequenceActive, 'powder:', this.powder);
    
    if (this.gameOver || this.roundComplete) {
      console.log('[INPUT] Blocked: gameOver or roundComplete');
      return;
    }

    if (this.isDragging || this.currentProjectile) {
      console.log('[INPUT] Blocked: isDragging or currentProjectile exists');
      return;
    }

    const canPrepareShot = this.sequenceActive || this.countdownActive;
    if (!canPrepareShot) {
      console.log('[INPUT] Blocked: sequence not active');
      return;
    }

    if (this.powder <= 0) {
      console.log('[INPUT] Blocked: no powder');
      return;
    }

    console.log('[INPUT] Creating joypad and projectile');
    const groundY = this.scale.height - GAME_SETTINGS.GROUND_HEIGHT;
    const baseRadius = JOYPAD_BASE_RADIUS;
    const centerX = Phaser.Math.Clamp(pointer.x, baseRadius, this.scale.width - baseRadius);

    this.isDragging = true;
    this.activePointer = pointer;
    this.snappedVelocity = undefined;

    this.createJoypad(centerX, groundY);
    this.createProjectile(centerX, groundY);

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

    const waitingForSequence = this.countdownActive && !this.sequenceActive;

    if (!this.joypad || !this.currentProjectile || waitingForSequence) {
      this.destroyJoypad();
      this.prepareNextShot();
      this.resetDragState();
      return;
    }

    const launched = this.launchProjectile();
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

  private resetDragState(): void {
    this.isDragging = false;
    this.clearDragPointerData();
  }

  private createJoypad(x: number, groundY: number): void {
    const container = this.add.container(0, 0);

    const base = this.add.circle(x, groundY, JOYPAD_BASE_RADIUS, COLORS.WHITE, 0.22);
    base.setStrokeStyle(3, COLORS.WHITE, 0.55);

    const knob = this.add.circle(x, groundY, JOYPAD_KNOB_RADIUS, COLORS.PRIMARY, 0.72);
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
      centerY: groundY,
      groundY,
      offsetX: 0,
      offsetY: 0,
    };

    if (this.currentProjectile) {
      this.currentProjectile.sprite.setPosition(x, groundY);
      this.currentProjectile.ring.setPosition(x, groundY);
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

    this.currentProjectile.sprite.setPosition(this.joypad.centerX, this.joypad.groundY);
    this.currentProjectile.ring.setPosition(this.joypad.centerX, this.joypad.groundY);

    // Rotate arrow to point in drag direction (opposite of offset)
    const aimAngle = Math.atan2(-offsetY, -offsetX);
    this.currentProjectile.sprite.setRotation(aimAngle);

    this.joypad.powerLine.clear();
    this.joypad.powerLine.lineStyle(4, COLORS.PRIMARY, 0.6);
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
    const lineWidth = isSnapped ? 4 : 3;

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

    let velocityX: number;
    let velocityY: number;

    // Use snapped velocity if available, otherwise use manual aim
    if (this.snappedVelocity) {
      velocityX = this.snappedVelocity.vx;
      velocityY = this.snappedVelocity.vy;
      this.snappedVelocity = undefined;
    } else {
      const velocityMultiplier = 6.5;
      velocityX = -this.joypad.offsetX * velocityMultiplier;
      velocityY = -this.joypad.offsetY * velocityMultiplier;
    }

    const body = this.currentProjectile.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(velocityX, velocityY);

    // Rotate arrow to point in direction of travel
    const angle = Math.atan2(velocityY, velocityX);
    this.currentProjectile.sprite.setRotation(angle);

    // Start particle trail
    if (this.currentProjectile.particles) {
      this.currentProjectile.particles.emitParticleAt(
        this.currentProjectile.sprite.x,
        this.currentProjectile.sprite.y
      );
      this.currentProjectile.particles.start();
    }

    this.physics.add.collider(this.currentProjectile.sprite, this.ground);

    this.targets.forEach((targetData) => {
      this.physics.add.overlap(this.currentProjectile!.sprite, targetData.sprite, () => {
        this.handleTargetHit(targetData);
      });
    });

    // Cost per shot scales with sequence number (Round 1 = 1 powder, Round 2 = 2 powder, etc.)
    const shotCost = this.currentRound;
    this.powder -= shotCost;
    this.updatePowderText();

    this.projectileIdleTimer = 0;

    if (this.powder <= 0 && !this.currentProjectile.fadingOut) {
      this.time.delayedCall(2000, () => {
        if (!this.gameOver) {
          this.handleGameOver();
        }
      });
    }

    return true;
  }

  private handleOffscreenProjectile(): void {
    if (!this.currentProjectile) {
      console.log('[OFF-SCREEN] No projectile to clean up');
      return;
    }

    const projectile = this.currentProjectile;

    if (projectile.fadingOut) {
      console.log('[OFF-SCREEN] Projectile already fading out');
      return;
    }

    console.log('[OFF-SCREEN] Starting cleanup sequence');

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

      // Stop trail particles immediately
      if (projectile.particles) {
        try {
          projectile.particles.stop();
        } catch (_e) {
          // Ignore
        }
      }

      // Destroy sprite IMMEDIATELY (don't just hide it)
      console.log('[OFF-SCREEN] Destroying projectile and ring');
      try {
        sprite.destroy();
        projectile.ring.destroy();
        if (projectile.particles) {
          projectile.particles.destroy();
        }
      } catch (error) {
        console.log('[OFF-SCREEN] Error destroying objects:', error);
      }

      // Clear projectile reference IMMEDIATELY
      this.currentProjectile = undefined;
      console.log('[OFF-SCREEN] Projectile reference cleared');

      // Clear joypad and reset state
      this.destroyJoypad();
      this.resetDragState();
      
      console.log('[OFF-SCREEN] Cleanup complete, input re-enabled');
    } catch (error) {
      console.log('[OFF-SCREEN] Fatal error during cleanup:', error);
      // Failsafe: force cleanup if any error occurs
      try {
        this.currentProjectile = undefined;
        this.destroyJoypad();
        this.resetDragState();
      } catch (_e2) {
        // Last resort: just clear the reference
        this.currentProjectile = undefined;
      }
    }
  }

  private handleTargetHit(targetData: TargetData): void {
    if (targetData.hit) return;
    targetData.hit = true;

    console.log('[HIT] Target hit detected');

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

    this.powder += powderReward;
    this.totalPowderEarned += powderReward;
    if (powderReward > this.bestHit) {
      this.bestHit = powderReward;
    }

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

    const powderPopup = this.add.text(x, y + 10, `+${powderReward} POWDER`, {
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
    
    // Immediately destroy projectile on hit
    console.log('[HIT] Cleaning up projectile');
    this.prepareNextShot();
    
    // Clear joypad UI and reset drag state to allow next shot
    this.destroyJoypad();
    this.resetDragState();
    
    console.log('[HIT] Cleanup complete, input should be re-enabled');
  }

  private removeTarget(targetData: TargetData): void {
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    targetData.ring.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }

  private createHitParticleExplosion(x: number, y: number, color: number, quality: number): void {
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

    // Create particle emitter
    const particles = this.add.particles(x, y, particleKey, {
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

    // Emit particles once
    particles.explode(particleCount, x, y);

    // Clean up the emitter after particles finish
    this.time.delayedCall(particleLifespan + 100, () => {
      particles.destroy();
    });
  }

  private fadeOutProjectile(): void {
    if (!this.currentProjectile || this.currentProjectile.fadingOut) return;

    this.currentProjectile.fadingOut = true;

    this.tweens.add({
      targets: [this.currentProjectile.sprite, this.currentProjectile.ring],
      alpha: 0,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        this.prepareNextShot();
        this.destroyJoypad();
      },
    });
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
        }
      } catch (_error) {
        // Ignore cleanup errors during projectile teardown
      }

      projectile.sprite.destroy();
      projectile.ring.destroy();
      
      // Clean up particle emitter
      if (projectile.particles) {
        try {
          projectile.particles.stop();
          projectile.particles.destroy();
        } catch (_e) {
          // Ignore particle cleanup errors
        }
      }
      
      this.currentProjectile = undefined;
      console.log('[CLEANUP] Projectile destroyed and reference cleared');
    } else {
      console.log('[CLEANUP] No projectile to clean up');
    }

    this.projectileIdleTimer = 0;
    this.snappedVelocity = undefined;
    
    console.log('[CLEANUP] prepareNextShot complete - ready for next shot');
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

    this.powderText = this.add.text(
      20,
      20,
      `POWDER: ${this.powder}`,
      createTextStyle('28px', '#FFD700')
    );
    this.powderText.setOrigin(0, 0);
    this.powderText.setDepth(100);

    this.sequenceProgressText = this.add.text(
      width - 20,
      20,
      `Targets: 0/${this.targetsInRound}`,
      createTextStyle('24px', '#ffffff')
    );
    this.sequenceProgressText.setOrigin(1, 0);
    this.sequenceProgressText.setDepth(100);

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
    this.powderText.setText(`POWDER: ${this.powder}`);
  }

  private updateRoundText(): void {
    this.roundText.setText(`Round ${this.currentRound}`);
  }

  private updateSequenceProgressText(): void {
    const completed = this.targetsInRound - this.targetsRemainingInRound;
    this.sequenceProgressText.setText(`Targets: ${completed}/${this.targetsInRound}`);
  }

  private handleSequenceComplete(): void {
    this.roundComplete = true;
    this.sequenceActive = false;
    
    // Clean up sequence timer
    if (this.sequenceTimer) {
      this.sequenceTimer.remove();
      this.sequenceTimer = null;
    }

    const totalTargets = this.hitsInSequence + this.missesInSequence;
    const successfulHit = this.missesInSequence === 0;

    // If sequence was successful (all circles hit), auto-transition to next sequence
    if (successfulHit) {
      // Schedule next sequence after a brief moment
      this.time.delayedCall(500, () => {
        if (this.roundComplete) {
          this.nextRound();
        }
      });
      return;
    }

    // Sequence failed (missed at least 1 circle) - show summary screen with options
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
        
        // Clean up any existing projectiles and joypad
        this.prepareNextShot();
        this.destroyJoypad();
        
        // Clean up any remaining targets
        this.targets.forEach(target => this.removeTarget(target));
        this.targets = [];
        
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

  private nextRound(): void {
    this.currentRound++;
    this.roundComplete = false;

    this.targets.forEach((target) => this.removeTarget(target));
    this.targets = [];
    this.prepareNextShot();

    // Start next sequence with countdown for consistency
    this.startCountdown();
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
