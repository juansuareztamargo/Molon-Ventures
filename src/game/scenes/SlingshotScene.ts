import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS } from '@/utils/constants';
import { createButton, createTextStyle } from '@/utils/helpers';

interface TargetData {
  sprite: Phaser.Physics.Arcade.Sprite;
  graphic: Phaser.GameObjects.Arc;
  startTime: number;
  lifetime: number;
  initialRadius: number;
  hit: boolean;
  missTriggered: boolean;
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

export class SlingshotScene extends Phaser.Scene {
  private projectileCount: number = GAME_SETTINGS.INITIAL_PROJECTILES;
  private targetsRemaining: number = GAME_SETTINGS.TARGET_COUNT;
  private scoreText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private projectileCountText!: Phaser.GameObjects.Text;

  private isDragging: boolean = false;
  private currentProjectile?: Phaser.Physics.Arcade.Sprite;

  private targets: TargetData[] = [];
  private ground!: Phaser.GameObjects.Rectangle;

  private joypad?: JoypadUI;
  private projectileIdleTimer: number = 0;
  private readonly projectileIdleThreshold: number = 1500;

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
    this.startTargetSpawning();
  }

  update(_time: number, delta: number): void {
    this.updateTargets();

    if (this.currentProjectile && !this.isDragging) {
      const sprite = this.currentProjectile;
      const body = sprite.body as Phaser.Physics.Arcade.Body;

      const isOffscreen =
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50 ||
        sprite.y < -50;

      const hasLowVelocity =
        Math.abs(body.velocity.x) < 1 &&
        Math.abs(body.velocity.y) < 1;

      if (isOffscreen) {
        this.prepareNextShot();
      } else if (
        hasLowVelocity &&
        sprite.y > this.scale.height - GAME_SETTINGS.GROUND_HEIGHT - 30
      ) {
        this.projectileIdleTimer += delta;

        if (this.projectileIdleTimer >= this.projectileIdleThreshold) {
          this.prepareNextShot();
        }
      } else {
        this.projectileIdleTimer = 0;
      }
    }

    if (this.targetsRemaining === 0) {
      this.handleWin();
    } else if (this.projectileCount === 0 && !this.currentProjectile) {
      this.handleLoss();
    }
  }

  private startTargetSpawning(): void {
    this.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => {
        if (this.targets.length < 2) {
          this.spawnTarget();
        }
      },
    });

    this.time.delayedCall(500, () => {
      this.spawnTarget();
    });
  }

  private spawnTarget(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const groundY = height - GAME_SETTINGS.GROUND_HEIGHT;

    const spawnX = Phaser.Math.Between(250, width - 250);
    const initialRadius = 54;
    const lifetime = 6500;

    const sprite = this.physics.add.sprite(spawnX, groundY, '');
    sprite.setDisplaySize(0, 0);
    sprite.setVisible(false);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(initialRadius);
    body.setAllowGravity(true);
    body.setBounce(0);
    body.setDamping(false);
    body.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-520, -580));
    body.setGravityY(-100);

    const graphic = this.add.circle(spawnX, groundY, initialRadius, 0xe74c3c);
    graphic.setStrokeStyle(3, COLORS.WHITE, 0.8);

    const targetData: TargetData = {
      sprite,
      graphic,
      startTime: this.time.now,
      lifetime,
      initialRadius,
      hit: false,
      missTriggered: false,
    };

    this.targets.push(targetData);

    if (this.currentProjectile) {
      this.physics.add.overlap(this.currentProjectile, sprite, () => {
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

      const currentRadius = Math.max(targetData.initialRadius * timeRemaining, 12);
      targetData.graphic.setRadius(currentRadius);

      const body = targetData.sprite.body as Phaser.Physics.Arcade.Body;
      body.setCircle(currentRadius);

      targetData.graphic.setPosition(targetData.sprite.x, targetData.sprite.y);

      let color: number;
      if (timeRemaining >= 0.75) {
        color = 0xe74c3c;
      } else if (timeRemaining >= 0.5) {
        color = 0xf39c12;
      } else if (timeRemaining >= 0.25) {
        color = 0x2ecc71;
      } else {
        color = 0x9b59b6;

        if (!targetData.missTriggered) {
          targetData.missTriggered = true;
          this.handleTargetMiss(targetData);
        }
      }

      targetData.graphic.setFillStyle(color, 1);

      const alpha = Phaser.Math.Clamp(timeRemaining * 1.2, 0, 1);
      targetData.graphic.setAlpha(alpha);

      if (progress >= 1) {
        this.removeTarget(targetData);
        this.time.delayedCall(600, () => this.spawnTarget());
      }
    });

    this.targets = this.targets.filter((target) => target.graphic.active);
  }

  private handleTargetMiss(targetData: TargetData): void {
    const x = targetData.sprite.x;
    const y = targetData.sprite.y;

    const missText = this.add.text(x, y, 'MISS', {
      fontSize: '28px',
      color: '#9b59b6',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    missText.setOrigin(0.5);
    missText.setDepth(100);

    this.tweens.add({
      targets: missText,
      y: y - 50,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => missText.destroy(),
    });

    if (this.currentProjectile && !this.isDragging) {
      this.prepareNextShot();
    }
  }

  private createProjectile(x: number, y: number): void {
    if (this.projectileCount <= 0) {
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

    this.currentProjectile = this.physics.add.sprite(x, y, 'projectile');

    const body = this.currentProjectile.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setBounce(0.2);
    body.setCircle(15);
    body.setMass(0.5);
    body.setAllowGravity(false);

    this.currentProjectile.setDepth(60);
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging || this.currentProjectile) return;

      this.isDragging = true;
      this.createJoypad(pointer.x, pointer.y);
      this.createProjectile(pointer.x, pointer.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.joypad || !this.currentProjectile) return;

      this.updateJoypad(pointer.x, pointer.y);
    });

    const releaseProjectile = (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || !this.joypad || !this.currentProjectile) return;

      if (this.launchProjectile()) {
        this.destroyJoypad();
      } else {
        this.prepareNextShot();
      }

      this.isDragging = false;
    };

    this.input.on('pointerup', releaseProjectile);
    this.input.on('pointerupoutside', releaseProjectile);
  }

  private createJoypad(x: number, y: number): void {
    const container = this.add.container(0, 0);

    const base = this.add.circle(x, y, 82, COLORS.WHITE, 0.22);
    base.setStrokeStyle(3, COLORS.WHITE, 0.55);

    const knob = this.add.circle(x, y, 26, COLORS.PRIMARY, 0.72);
    knob.setStrokeStyle(3, COLORS.WHITE, 0.9);

    const powerLine = this.add.graphics();
    const trajectoryLine = this.add.graphics();

    container.add([base, powerLine, trajectoryLine, knob]);
    container.setDepth(55);
    container.setAlpha(0);
    container.setScale(0.85);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 120,
      ease: 'Cubic.easeOut',
    });

    this.joypad = {
      container,
      base,
      knob,
      powerLine,
      trajectoryLine,
      centerX: x,
      centerY: y,
      offsetX: 0,
      offsetY: 0,
    };

    if (this.currentProjectile) {
      this.currentProjectile.setPosition(x, y);
    }
  }

  private updateJoypad(pointerX: number, pointerY: number): void {
    if (!this.joypad || !this.currentProjectile) return;

    const dx = pointerX - this.joypad.centerX;
    const dy = pointerY - this.joypad.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 90;

    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);

    const offsetX = Math.cos(angle) * clampedDistance;
    const offsetY = Math.sin(angle) * clampedDistance;

    this.joypad.knob.setPosition(this.joypad.centerX + offsetX, this.joypad.centerY + offsetY);
    this.joypad.offsetX = offsetX;
    this.joypad.offsetY = offsetY;

    this.currentProjectile.setPosition(this.joypad.centerX, this.joypad.centerY);

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

    const velocityMultiplier = 4.2;
    let vx = -this.joypad.offsetX * velocityMultiplier;
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

    const container = this.joypad.container;

    this.tweens.add({
      targets: container,
      alpha: 0,
      scale: 0.8,
      duration: 120,
      ease: 'Cubic.easeIn',
      onComplete: () => container.destroy(),
    });

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

    const velocityMultiplier = 4.2;
    const velocityX = -this.joypad.offsetX * velocityMultiplier;
    const velocityY = -this.joypad.offsetY * velocityMultiplier;

    const body = this.currentProjectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(velocityX, velocityY);

    this.physics.add.collider(this.currentProjectile, this.ground);

    this.targets.forEach((targetData) => {
      this.physics.add.overlap(this.currentProjectile!, targetData.sprite, () => {
        this.handleTargetHit(targetData);
      });
    });

    this.projectileCount--;
    this.updateProjectileCountText();

    this.projectileIdleTimer = 0;
    return true;
  }

  private handleTargetHit(targetData: TargetData): void {
    if (targetData.hit) return;
    targetData.hit = true;

    this.targetsRemaining--;

    const x = targetData.sprite.x;
    const y = targetData.sprite.y;
    const currentColor = targetData.graphic.fillColor;

    for (let i = 0; i < 12; i++) {
      const particle = this.add.circle(x, y, 6, currentColor);
      const angle = (Math.PI * 2 * i) / 12;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 80,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    const scorePopup = this.add.text(x, y, '+100', {
      fontSize: '32px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    scorePopup.setOrigin(0.5);
    scorePopup.setDepth(100);

    this.tweens.add({
      targets: scorePopup,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => scorePopup.destroy(),
    });

    this.removeTarget(targetData);
    this.updateScore();
    this.prepareNextShot();
    this.time.delayedCall(500, () => this.spawnTarget());
  }

  private removeTarget(targetData: TargetData): void {
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }

  private prepareNextShot(): void {
    if (this.currentProjectile) {
      this.currentProjectile.destroy();
      this.currentProjectile = undefined;
    }

    this.projectileIdleTimer = 0;
  }

  private createUI(): void {
    const width = this.scale.width;

    this.scoreText = this.add.text(
      20,
      20,
      `Targets: ${this.targetsRemaining}`,
      createTextStyle('24px', '#ffffff')
    );
    this.scoreText.setOrigin(0);

    this.projectileCountText = this.add.text(
      width - 20,
      20,
      `Projectiles: ${this.projectileCount}`,
      createTextStyle('24px', '#ffffff')
    );
    this.projectileCountText.setOrigin(1, 0);

    this.instructionsText = this.add.text(
      width / 2,
      20,
      'Tap anywhere, drag to aim, release to launch',
      createTextStyle('20px', '#ffffff')
    );
    this.instructionsText.setOrigin(0.5, 0);

    this.scoreText.setDepth(100);
    this.projectileCountText.setDepth(100);
    this.instructionsText.setDepth(100);
  }

  private updateScore(): void {
    this.scoreText.setText(`Targets: ${this.targetsRemaining}`);
  }

  private updateProjectileCountText(): void {
    this.projectileCountText.setText(`Projectiles: ${this.projectileCount}`);
  }

  private handleWin(): void {
    this.showGameOver('YOU WIN!', COLORS.SECONDARY);
  }

  private handleLoss(): void {
    this.showGameOver('GAME OVER', COLORS.DANGER);
  }

  private showGameOver(message: string, color: number): void {
    if (this.scene.isPaused()) return;
    this.scene.pause();

    const width = this.scale.width;
    const height = this.scale.height;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.BLACK, 0.7);
    overlay.setDepth(200);

    const gameOverText = this.add.text(width / 2, height / 2 - 80, message, {
      fontSize: '64px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    gameOverText.setOrigin(0.5);
    gameOverText.setDepth(201);

    const statsText = this.add.text(
      width / 2,
      height / 2,
      `Targets Destroyed: ${GAME_SETTINGS.TARGET_COUNT - this.targetsRemaining}/${GAME_SETTINGS.TARGET_COUNT}\nProjectiles Used: ${GAME_SETTINGS.INITIAL_PROJECTILES - this.projectileCount}`,
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
    statsText.setLineSpacing(10);

    const restartButton = createButton(
      this,
      width / 2 - 130,
      height / 2 + 100,
      'RESTART',
      () => {
        this.scene.restart();
      },
      200,
      60
    );
    restartButton.setDepth(201);

    const menuButton = createButton(
      this,
      width / 2 + 130,
      height / 2 + 100,
      'MENU',
      () => {
        this.scene.start(SCENES.MAIN_MENU);
      },
      200,
      60
    );
    menuButton.setDepth(201);

    this.tweens.add({
      targets: gameOverText,
      scale: { from: 1, to: 1.1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
