import Phaser from 'phaser';
import { SCENES } from '@/config/gameConfig';
import { COLORS, INPUT_THRESHOLDS, GAME_SETTINGS } from '@/utils/constants';
import { createButton, createTextStyle, distanceBetween } from '@/utils/helpers';

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

  private targets: Phaser.Physics.Arcade.Sprite[] = [];
  private ground!: Phaser.GameObjects.Rectangle;

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

    // Create targets
    this.createTargets();

    // Create UI overlay
    this.createUI();

    // Create the first projectile
    this.createProjectile();

    // Create drag line graphics
    this.dragLine = this.add.graphics();

    // Set up input
    this.setupInput();
  }

  update(): void {
    // Check if projectile is off screen or has settled
    if (this.currentProjectile && !this.isDragging) {
      const sprite = this.currentProjectile;
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      
      if (
        sprite.x < -50 ||
        sprite.x > this.scale.width + 50 ||
        sprite.y > this.scale.height + 50 ||
        (Math.abs(body.velocity.x) < 1 && Math.abs(body.velocity.y) < 1 && sprite.y > this.slingshotY - 10)
      ) {
        // Projectile has settled, prepare next shot
        this.time.delayedCall(500, () => {
          if (!this.isDragging) {
            this.prepareNextShot();
          }
        });
      }
    }

    // Check for win/lose conditions
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

  private createTargets(): void {
    const targetPositions = [
      { x: 700, y: 550 },
      { x: 850, y: 500 },
      { x: 900, y: 600 },
    ];

    targetPositions.forEach((pos) => {
      const target = this.physics.add.sprite(pos.x, pos.y, '');
      target.setDisplaySize(40, 40);
      
      // Create target graphic
      const graphics = this.add.graphics();
      graphics.fillStyle(COLORS.TARGET, 1);
      graphics.fillRect(0, 0, 40, 40);
      graphics.lineStyle(3, COLORS.WHITE, 1);
      graphics.strokeRect(0, 0, 40, 40);
      graphics.generateTexture('target', 40, 40);
      graphics.destroy();
      
      target.setTexture('target');
      
      const body = target.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(0.3);
      body.setMass(1);

      this.targets.push(target);
    });
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
      // Not dragged enough, reset
      this.currentProjectile.setPosition(this.slingshotX, this.slingshotY - 30);
      this.dragLine.clear();
      this.drawSlingshot();
      return;
    }

    const body = this.currentProjectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(velocityX, velocityY);

    this.launchedProjectiles.push(this.currentProjectile);

    // Set up collisions
    this.physics.add.collider(this.currentProjectile, this.ground);
    this.targets.forEach((target) => {
      this.physics.add.collider(this.currentProjectile!, target, () => {
        this.handleTargetHit(target);
      });
    });

    this.projectileCount--;
    this.updateProjectileCountText();

    this.currentProjectile = undefined;

    this.dragLine.clear();
    this.drawSlingshot();
  }

  private handleTargetHit(target: Phaser.Physics.Arcade.Sprite): void {
    if (!this.targets.includes(target)) return;

    // Remove target
    this.targets = this.targets.filter((t) => t !== target);
    this.targetsRemaining--;

    // Create destruction effect
    for (let i = 0; i < 8; i++) {
      const particle = this.add.circle(target.x, target.y, 5, COLORS.TARGET);
      const angle = (Math.PI * 2 * i) / 8;
      
      this.tweens.add({
        targets: particle,
        x: target.x + Math.cos(angle) * 50,
        y: target.y + Math.sin(angle) * 50,
        alpha: 0,
        duration: 500,
        onComplete: () => particle.destroy(),
      });
    }

    target.destroy();
    this.updateScore();
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
