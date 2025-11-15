import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS } from '@/utils/constants';
import { createButton, createTextStyle, distanceBetween } from '@/utils/helpers';

interface TargetData {
  sprite: Phaser.Physics.Arcade.Sprite;
  graphic: Phaser.GameObjects.Arc;
  startTime: number;
  lifetime: number;
  initialRadius: number;
  hit: boolean;
}

export class SlingshotScene extends Phaser.Scene {
  private projectileCount: number = GAME_SETTINGS.INITIAL_PROJECTILES;
  private targetsRemaining: number = GAME_SETTINGS.TARGET_COUNT;
  private scoreText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private projectileCountText!: Phaser.GameObjects.Text;

  private slingshot!: Phaser.GameObjects.Graphics;
  private slingshotX: number = 200;
  private slingshotY: number = 500;

  private isDragging: boolean = false;
  private dragLine!: Phaser.GameObjects.Graphics;
  private currentProjectile?: Phaser.Physics.Arcade.Sprite;
  private launchedProjectiles: Phaser.Physics.Arcade.Sprite[] = [];

  private targets: TargetData[] = [];
  private ground!: Phaser.GameObjects.Rectangle;
  private reloadScheduled: boolean = false;

  constructor() {
    super({ key: SCENES.SLINGSHOT });
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // Create ground
    this.ground = this.add.rectangle(
      width / 2,
      height - GAME_SETTINGS.GROUND_HEIGHT / 2,
      width,
      GAME_SETTINGS.GROUND_HEIGHT,
      COLORS.GROUND
    );
    this.physics.add.existing(this.ground, true);

    // Create slingshot base
    this.createSlingshot();

    // Create UI overlay
    this.createUI();

    // Create the first projectile
    this.createProjectile();

    // Create drag line graphics
    this.dragLine = this.add.graphics();

    // Set up input
    this.setupInput();

    // Start spawning targets
    this.startTargetSpawning();
  }

  update(): void {
    this.updateTargets();

    if (this.currentProjectile && !this.isDragging && !this.reloadScheduled) {
      const sprite = this.currentProjectile;
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      
      const isOffscreen = 
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50;
      
      const hasSettled = 
        Math.abs(body.velocity.x) < 1 && 
        Math.abs(body.velocity.y) < 1 && 
        sprite.y > this.slingshotY - 10;
      
      if (isOffscreen || hasSettled) {
        this.reloadScheduled = true;
        this.time.delayedCall(500, () => {
          if (!this.isDragging) {
            this.prepareNextShot();
            this.reloadScheduled = false;
          }
        });
      }
    }

    if (this.targetsRemaining === 0) {
      this.handleWin();
    } else if (this.projectileCount === 0 && !this.currentProjectile) {
      this.handleLoss();
    }
  }

  private createSlingshot(): void {
    this.slingshot = this.add.graphics();
    this.drawSlingshot();
  }

  private drawSlingshot(pullX?: number, pullY?: number): void {
    this.slingshot.clear();

    // Draw slingshot posts
    this.slingshot.fillStyle(COLORS.SLINGSHOT);
    this.slingshot.fillRect(this.slingshotX - 35, this.slingshotY - 60, 10, 60);
    this.slingshot.fillRect(this.slingshotX + 25, this.slingshotY - 60, 10, 60);

    // Draw elastic bands
    if (pullX !== undefined && pullY !== undefined) {
      this.slingshot.lineStyle(3, COLORS.SLINGSHOT, 1);
      this.slingshot.beginPath();
      this.slingshot.moveTo(this.slingshotX - 30, this.slingshotY - 60);
      this.slingshot.lineTo(pullX, pullY);
      this.slingshot.strokePath();

      this.slingshot.beginPath();
      this.slingshot.moveTo(this.slingshotX + 30, this.slingshotY - 60);
      this.slingshot.lineTo(pullX, pullY);
      this.slingshot.strokePath();
    } else {
      this.slingshot.lineStyle(3, COLORS.SLINGSHOT, 1);
      this.slingshot.beginPath();
      this.slingshot.moveTo(this.slingshotX - 30, this.slingshotY - 60);
      this.slingshot.lineTo(this.slingshotX, this.slingshotY - 30);
      this.slingshot.lineTo(this.slingshotX + 30, this.slingshotY - 60);
      this.slingshot.strokePath();
    }

    // Draw base
    this.slingshot.fillStyle(COLORS.SLINGSHOT);
    this.slingshot.fillRect(this.slingshotX - 50, this.slingshotY, 100, 20);
  }

  private startTargetSpawning(): void {
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        if (this.targets.length < 2) {
          this.spawnTarget();
        }
      },
      loop: true,
    });

    this.time.delayedCall(500, () => {
      this.spawnTarget();
    });
  }

  private spawnTarget(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const groundY = height - GAME_SETTINGS.GROUND_HEIGHT;

    const spawnX = Phaser.Math.Between(400, width - 200);
    const initialRadius = 50;
    const lifetime = 4000;

    const sprite = this.physics.add.sprite(spawnX, groundY, '');
    sprite.setDisplaySize(initialRadius * 2, initialRadius * 2);
    
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(initialRadius);
    body.setAllowGravity(true);
    body.setImmovable(false);
    body.setBounce(0);
    body.setDamping(false);

    const graphic = this.add.circle(spawnX, groundY, initialRadius, 0xe74c3c);
    graphic.setStrokeStyle(3, COLORS.WHITE, 0.8);

    const velocityX = Phaser.Math.Between(-40, 40);
    const velocityY = -280;
    body.setVelocity(velocityX, velocityY);

    const targetData: TargetData = {
      sprite: sprite,
      graphic: graphic,
      startTime: this.time.now,
      lifetime: lifetime,
      initialRadius: initialRadius,
      hit: false,
    };

    this.targets.push(targetData);

    if (this.currentProjectile) {
      this.physics.add.overlap(this.currentProjectile, sprite, () => {
        this.handleTargetHit(targetData);
      });
    }

    this.launchedProjectiles.forEach((projectile) => {
      this.physics.add.overlap(projectile, sprite, () => {
        this.handleTargetHit(targetData);
      });
    });
  }

  private updateTargets(): void {
    const now = this.time.now;

    this.targets.forEach((targetData) => {
      if (targetData.hit) return;

      const elapsed = now - targetData.startTime;
      const progress = Math.min(elapsed / targetData.lifetime, 1);
      const timeRemaining = 1 - progress;

      const currentRadius = Math.max(
        targetData.initialRadius * timeRemaining,
        5
      );
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
      }
      targetData.graphic.setFillStyle(color, 1);

      const alpha = Math.max(timeRemaining, 0);
      targetData.graphic.setAlpha(alpha);
      targetData.sprite.setAlpha(alpha);

      if (progress >= 1) {
        this.removeTarget(targetData);
      }
    });

    this.targets = this.targets.filter((t) => !t.hit || t.sprite.active);
  }

  private createProjectile(): void {
    if (this.projectileCount <= 0) {
      return;
    }

    // Create projectile texture if not exists
    if (!this.textures.exists('projectile')) {
      const graphics = this.add.graphics();
      graphics.fillStyle(COLORS.PROJECTILE, 1);
      graphics.fillCircle(15, 15, 15);
      graphics.lineStyle(2, COLORS.WHITE, 0.5);
      graphics.strokeCircle(15, 15, 15);
      graphics.generateTexture('projectile', 30, 30);
      graphics.destroy();
    }

    this.currentProjectile = this.physics.add.sprite(
      this.slingshotX,
      this.slingshotY - 30,
      'projectile'
    );
    
    const body = this.currentProjectile.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);
    body.setBounce(0.5);
    body.setCircle(15);
    body.setMass(0.5);
    body.setAllowGravity(false);

    this.currentProjectile.setInteractive({ draggable: true });
  }

  private setupInput(): void {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (gameObject === this.currentProjectile && !this.isDragging) {
        this.isDragging = true;
      }
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, _dragX: number, _dragY: number) => {
      if (gameObject === this.currentProjectile && this.isDragging) {
        const distance = distanceBetween(this.slingshotX, this.slingshotY - 30, pointer.x, pointer.y);
        
        if (distance <= INPUT_THRESHOLDS.DRAG_MAX_DISTANCE) {
          this.currentProjectile!.setPosition(pointer.x, pointer.y);
        } else {
          const angle = Math.atan2(pointer.y - (this.slingshotY - 30), pointer.x - this.slingshotX);
          const clampedX = this.slingshotX + Math.cos(angle) * INPUT_THRESHOLDS.DRAG_MAX_DISTANCE;
          const clampedY = (this.slingshotY - 30) + Math.sin(angle) * INPUT_THRESHOLDS.DRAG_MAX_DISTANCE;
          this.currentProjectile!.setPosition(clampedX, clampedY);
        }

        this.drawDragLine();
        this.drawSlingshot(this.currentProjectile!.x, this.currentProjectile!.y);
      }
    });

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (gameObject === this.currentProjectile && this.isDragging) {
        this.launchProjectile();
        this.isDragging = false;
      }
    });
  }

  private drawDragLine(): void {
    if (!this.currentProjectile) return;

    this.dragLine.clear();
    this.dragLine.lineStyle(2, COLORS.WHITE, 0.8);
    this.dragLine.beginPath();
    this.dragLine.moveTo(this.slingshotX, this.slingshotY - 30);
    this.dragLine.lineTo(this.currentProjectile.x, this.currentProjectile.y);
    this.dragLine.strokePath();

    // Draw trajectory preview
    const velocityX = (this.slingshotX - this.currentProjectile.x) * INPUT_THRESHOLDS.VELOCITY_MULTIPLIER;
    const velocityY = ((this.slingshotY - 30) - this.currentProjectile.y) * INPUT_THRESHOLDS.VELOCITY_MULTIPLIER;

    this.dragLine.lineStyle(2, COLORS.WARNING, 0.4);

    for (let t = 0; t < 1; t += 0.05) {
      const x = this.currentProjectile.x + velocityX * t * 10;
      const y = this.currentProjectile.y + velocityY * t * 10 + 0.5 * 300 * (t * 10) * (t * 10);
      
      this.dragLine.lineTo(x, y);

      if (x < 0 || x > this.scale.width || y > this.scale.height) break;
    }
    this.dragLine.strokePath();
  }

  private launchProjectile(): void {
    if (!this.currentProjectile) return;

    const velocityX = (this.slingshotX - this.currentProjectile.x) * INPUT_THRESHOLDS.VELOCITY_MULTIPLIER;
    const velocityY = ((this.slingshotY - 30) - this.currentProjectile.y) * INPUT_THRESHOLDS.VELOCITY_MULTIPLIER;

    const distance = distanceBetween(
      this.slingshotX,
      this.slingshotY - 30,
      this.currentProjectile.x,
      this.currentProjectile.y
    );

    if (distance < INPUT_THRESHOLDS.DRAG_MIN_DISTANCE) {
      this.currentProjectile.setPosition(this.slingshotX, this.slingshotY - 30);
      this.dragLine.clear();
      this.drawSlingshot();
      return;
    }

    const body = this.currentProjectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(velocityX, velocityY);

    this.launchedProjectiles.push(this.currentProjectile);

    this.physics.add.collider(this.currentProjectile, this.ground);
    
    this.targets.forEach((targetData) => {
      this.physics.add.overlap(this.currentProjectile!, targetData.sprite, () => {
        this.handleTargetHit(targetData);
      });
    });

    this.projectileCount--;
    this.updateProjectileCountText();

    this.currentProjectile = undefined;

    this.dragLine.clear();
    this.drawSlingshot();
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
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => scorePopup.destroy(),
    });

    this.removeTarget(targetData);
    this.updateScore();
  }

  private removeTarget(targetData: TargetData): void {
    targetData.sprite.destroy();
    targetData.graphic.destroy();
    this.targets = this.targets.filter((t) => t !== targetData);
  }

  private prepareNextShot(): void {
    if (this.currentProjectile) {
      this.currentProjectile.disableInteractive();
      this.currentProjectile = undefined;
    }

    if (this.projectileCount > 0 && this.targetsRemaining > 0) {
      this.createProjectile();
    }
  }

  private createUI(): void {
    const width = this.scale.width;

    // Score/Targets remaining text
    this.scoreText = this.add.text(
      20,
      20,
      `Targets: ${this.targetsRemaining}`,
      createTextStyle('24px', '#ffffff')
    );
    this.scoreText.setOrigin(0);

    // Projectile count text
    this.projectileCountText = this.add.text(
      width - 20,
      20,
      `Projectiles: ${this.projectileCount}`,
      createTextStyle('24px', '#ffffff')
    );
    this.projectileCountText.setOrigin(1, 0);

    // Instructions text
    this.instructionsText = this.add.text(
      width / 2,
      20,
      'Drag and release to launch',
      createTextStyle('20px', '#ffffff')
    );
    this.instructionsText.setOrigin(0.5, 0);

    // All UI elements should have higher depth
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
    // Prevent multiple calls
    if (this.scene.isPaused()) return;
    this.scene.pause();

    const width = this.scale.width;
    const height = this.scale.height;

    // Semi-transparent overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, COLORS.BLACK, 0.7);
    overlay.setDepth(200);

    // Game over text
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

    // Stats text
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

    // Restart button
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

    // Menu button
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

    // Add pulsing animation
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
