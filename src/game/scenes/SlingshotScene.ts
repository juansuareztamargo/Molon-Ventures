import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS, TARGET_COLORS, POWDER_REWARDS } from '@/utils/constants';
import { createButton, createTextStyle } from '@/utils/helpers';

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

  private roundComplete: boolean = false;
  private gameOver: boolean = false;
  private firstSequenceStarted: boolean = false;
  private sequenceActive: boolean = false;
  private hitsInSequence: number = 0;
  private missesInSequence: number = 0;
  private sequenceTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: SCENES.SLINGSHOT });
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
        this.handleOffscreenProjectile();
      } else if (hasLowVelocity && isOnGround && !this.currentProjectile.fadingOut) {
        this.projectileIdleTimer += delta;

        if (this.projectileIdleTimer >= GAME_SETTINGS.PROJECTILE_IDLE_TIME) {
          this.fadeOutProjectile();
        }
      } else {
        this.projectileIdleTimer = 0;
      }

      if (ring && !this.currentProjectile.fadingOut) {
        ring.setPosition(sprite.x, sprite.y);
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

  private startCountdown(): void {
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
    const groundY = height - GAME_SETTINGS.GROUND_HEIGHT;

    const fixedX = Phaser.Math.Between(200, width - 200);
    const fixedY = Phaser.Math.Between(groundY * 0.2, groundY * 0.6);

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

    if (!this.textures.exists('projectile')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(COLORS.PROJECTILE, 1);
      graphics.fillCircle(15, 15, 15);
      graphics.lineStyle(2, COLORS.WHITE, 0.5);
      graphics.strokeCircle(15, 15, 15);
      graphics.generateTexture('projectile', 30, 30);
      graphics.destroy();
    }

    const sprite = this.physics.add.sprite(x, y, 'projectile');

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setBounce(0.2);
    body.setCircle(15);
    body.setMass(0.5);
    body.setAllowGravity(false);

    sprite.setDepth(60);

    const ring = this.add.circle(x, y, 25, 0x00000000);
    ring.setStrokeStyle(3, TARGET_COLORS.RED, 0.7);
    ring.setDepth(59);

    this.currentProjectile = {
      sprite,
      ring,
      targetColor: TARGET_COLORS.RED,
      fadingOut: false,
    };
  }

  private setupInput(): void {
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer) => {
      if (this.isDragging || this.currentProjectile || this.gameOver || this.roundComplete) return;

      this.isDragging = true;
      const groundY = this.scale.height - GAME_SETTINGS.GROUND_HEIGHT;
      // Auto-drag from center: always position joypad at screen center for consistency
      const centerX = this.scale.width / 2;
      this.createJoypad(centerX, groundY);
      this.createProjectile(centerX, groundY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.joypad || !this.currentProjectile) return;

      this.updateJoypad(pointer.x, pointer.y);
    });

    const releaseProjectile = (_pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.joypad || !this.currentProjectile) return;

      const launched = this.launchProjectile();
      this.destroyJoypad();

      if (!launched) {
        this.prepareNextShot();
      }

      this.isDragging = false;
    };

    this.input.on('pointerup', releaseProjectile);
    this.input.on('pointerupoutside', releaseProjectile);
  }

  private createJoypad(x: number, groundY: number): void {
    const container = this.add.container(0, 0);

    const base = this.add.circle(x, groundY, 82, COLORS.WHITE, 0.22);
    base.setStrokeStyle(3, COLORS.WHITE, 0.55);

    const knob = this.add.circle(x, groundY, 26, COLORS.PRIMARY, 0.72);
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
    const vx = -this.joypad.offsetX * velocityMultiplier;
    let vy = -this.joypad.offsetY * velocityMultiplier;

    const gravity = this.physics.world.gravity.y;
    const timeStep = 0.05;
    const maxSteps = 60;

    let px = this.joypad.centerX;
    let py = this.joypad.centerY;

    this.joypad.trajectoryLine.lineStyle(3, COLORS.WARNING, 0.45);
    this.joypad.trajectoryLine.beginPath();
    this.joypad.trajectoryLine.moveTo(px, py);

    for (let i = 0; i < maxSteps; i++) {
      px += vx * timeStep;
      py += vy * timeStep;
      vy += gravity * timeStep;

      this.joypad.trajectoryLine.lineTo(px, py);

      if (px < 0 || px > this.scale.width || py > this.scale.height) {
        break;
      }
    }

    this.joypad.trajectoryLine.strokePath();
  }

  private destroyJoypad(): void {
    if (!this.joypad) return;

    this.joypad.container.destroy();
    this.joypad = undefined;
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

    const velocityMultiplier = 6.5;
    const velocityX = -this.joypad.offsetX * velocityMultiplier;
    const velocityY = -this.joypad.offsetY * velocityMultiplier;

    const body = this.currentProjectile.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(velocityX, velocityY);

    this.physics.add.collider(this.currentProjectile.sprite, this.ground);

    this.targets.forEach((targetData) => {
      this.physics.add.overlap(this.currentProjectile!.sprite, targetData.sprite, () => {
        this.handleTargetHit(targetData);
      });
    });

    this.powder -= GAME_SETTINGS.POWDER_COST_PER_SHOT;
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
    // Create miss feedback at edge of screen
    let missX = this.scale.width / 2;
    let missY = this.scale.height / 2;
    
    if (this.currentProjectile) {
      const sprite = this.currentProjectile.sprite;
      if (sprite.x < 0) missX = 50;
      else if (sprite.x > this.scale.width) missX = this.scale.width - 50;
      else missX = sprite.x;
      
      if (sprite.y < 0) missY = 50;
      else if (sprite.y > this.scale.height) missY = this.scale.height - 50;
      else missY = sprite.y;
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
      onComplete: () => missText.destroy(),
    });

    this.prepareNextShot();
  }

  private handleTargetHit(targetData: TargetData): void {
    if (targetData.hit) return;
    targetData.hit = true;

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

    // Create particle explosion effect based on hit quality
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
        hitText.destroy();
        powderPopup.destroy();
      },
    });

    this.removeTarget(targetData);
    this.updatePowderText();
    this.prepareNextShot();
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
      },
    });
  }

  private prepareNextShot(): void {
    if (this.currentProjectile) {
      this.currentProjectile.sprite.destroy();
      this.currentProjectile.ring.destroy();
      this.currentProjectile = undefined;
    }

    this.projectileIdleTimer = 0;
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
    
    // Don't pause the scene - just use the roundComplete flag to control updates
    // This ensures buttons remain interactive

    const width = this.scale.width;
    const height = this.scale.height;

    // Calculate sequence score
    const totalTargets = this.hitsInSequence + this.missesInSequence;
    const accuracy = totalTargets > 0 ? (this.hitsInSequence / totalTargets) * 100 : 0;
    
    let scoreTier: string;
    let scoreColor: string;
    let buttonText: string;
    
    if (accuracy <= 25) {
      scoreTier = 'BAD';
      scoreColor = '#e74c3c';
      buttonText = 'TRY AGAIN';
    } else if (accuracy <= 50) {
      scoreTier = 'NICE';
      scoreColor = '#f39c12';
      buttonText = 'CONTINUE';
    } else if (accuracy <= 75) {
      scoreTier = 'GOOD';
      scoreColor = '#2ecc71';
      buttonText = 'CONTINUE';
    } else if (accuracy <= 90) {
      scoreTier = 'PERFECT';
      scoreColor = '#3498db';
      buttonText = 'CONTINUE';
    } else {
      scoreTier = 'OUTSTANDING';
      scoreColor = '#9b59b6';
      buttonText = 'CONTINUE';
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

    const actionButton = createButton(
      this,
      width / 2,
      height / 2 + 120,
      buttonText,
      () => {
        overlay.destroy();
        sequenceCompleteText.destroy();
        scoreText.destroy();
        statsText.destroy();
        actionButton.destroy();
        menuButton.destroy();
        
        if (buttonText === 'TRY AGAIN') {
          // Restart same sequence with countdown
          this.roundComplete = false;
          this.sequenceActive = false;
          this.startCountdown();
        } else {
          // Move to next sequence (CONTINUE)
          this.nextRound();
        }
      },
      200,
      60
    );
    actionButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2,
      height / 2 + 190,
      'MENU',
      () => {
        this.scene.stop();
        this.scene.start(SCENES.MAIN_MENU);
      },
      150,
      50
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
