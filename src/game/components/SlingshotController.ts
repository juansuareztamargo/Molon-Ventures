import { Scene } from 'phaser';
import { DifficultyLevel } from '@/config/targetConfig';
import { ProjectileManager } from '@/game/managers/ProjectileManager';

export interface SlingshotConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  maxPower: number;
  powerMultiplierPerDifficulty: Record<DifficultyLevel, number>;
}

export class SlingshotController {
  private scene: Scene;
  private position: { x: number; y: number };
  private config: SlingshotConfig;
  private isDragging: boolean = false;
  private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private currentDragPos: { x: number; y: number } = { x: 0, y: 0 };

  // Visual components
  private leftRail?: Phaser.GameObjects.Rectangle;
  private rightRail?: Phaser.GameObjects.Rectangle;
  private leftBand?: Phaser.GameObjects.Line;
  private rightBand?: Phaser.GameObjects.Line;
  private carriage?: Phaser.GameObjects.Graphics;
  private trajectoryGraphics?: Phaser.GameObjects.Graphics;

  private projectileManager?: ProjectileManager;
  private currentDifficulty: DifficultyLevel = 'NORMAL';

  constructor(scene: Scene, config: SlingshotConfig) {
    this.scene = scene;
    this.position = { x: config.x, y: config.y };
    this.config = config;

    this.createGraphics();
    this.setupInput();
  }

  private createGraphics(): void {
    const { width, height } = this.config;
    const railColor = 0x8b7355;
    const bandColor = 0xcc0000;
    const bandWidth = 4;
    const carriageRadius = 12;

    // Create rails (vertical posts)
    this.leftRail = this.scene.add.rectangle(
      this.position.x - width / 2,
      this.position.y - height / 2,
      8,
      height,
      railColor
    );
    this.leftRail.setOrigin(0.5, 0);

    this.rightRail = this.scene.add.rectangle(
      this.position.x + width / 2,
      this.position.y - height / 2,
      8,
      height,
      railColor
    );
    this.rightRail.setOrigin(0.5, 0);

    // Create bands (rubber bands)
    this.leftBand = this.scene.add.line(
      0,
      0,
      this.position.x - width / 2,
      this.position.y - height,
      this.position.x,
      this.position.y,
      bandColor
    );
    this.leftBand.setLineWidth(bandWidth);

    this.rightBand = this.scene.add.line(
      0,
      0,
      this.position.x + width / 2,
      this.position.y - height,
      this.position.x,
      this.position.y,
      bandColor
    );
    this.rightBand.setLineWidth(bandWidth);

    // Create carriage (the part you pull back) using graphics
    this.carriage = this.scene.make.graphics({
      x: this.position.x,
      y: this.position.y,
    } as Phaser.Types.GameObjects.Graphics.Options);
    this.carriage.fillStyle(0x8b4513);
    this.carriage.fillCircle(0, 0, carriageRadius);
    this.carriage.lineStyle(2, 0x654321);
    this.carriage.strokeCircle(0, 0, carriageRadius);
    this.scene.add.existing(this.carriage);
    this.carriage.setInteractive(new Phaser.Geom.Circle(0, 0, carriageRadius), Phaser.Geom.Circle.Contains);
    (this.carriage as unknown as { input: { useHandCursor: boolean } }).input.useHandCursor = true;

    // Create trajectory graphics
    this.trajectoryGraphics = this.scene.make.graphics({
      x: 0,
      y: 0,
    } as Phaser.Types.GameObjects.Graphics.Options);
    this.scene.add.existing(this.trajectoryGraphics);
    this.trajectoryGraphics.setDepth(10);
  }

  private setupInput(): void {
    if (!this.carriage) return;

    this.carriage.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startDrag(pointer.x, pointer.y);
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.updateDrag(pointer.x, pointer.y);
      }
    });

    this.scene.input.on('pointerup', () => {
      if (this.isDragging) {
        this.endDrag();
      }
    });
  }

  private startDrag(x: number, y: number): void {
    if (this.projectileManager && !this.projectileManager.isReady()) {
      return; // Can't drag if projectile is active
    }

    this.isDragging = true;
    this.dragStartPos = { x, y };
    this.currentDragPos = { x, y };

    if (this.carriage) {
      this.carriage.clear();
      this.carriage.fillStyle(0x654321);
      this.carriage.fillCircle(0, 0, 12);
    }
  }

  private updateDrag(x: number, y: number): void {
    this.currentDragPos = { x, y };

    // Calculate drag displacement
    const dx = this.dragStartPos.x - x;
    const dy = this.dragStartPos.y - y;

    // Limit drag distance (max pull)
    const maxDragDistance = 150;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);
    const limitedDragDistance = Math.min(dragDistance, maxDragDistance);

    if (dragDistance > 0) {
      const ratio = limitedDragDistance / dragDistance;
      this.currentDragPos.x = this.dragStartPos.x - dx * ratio;
      this.currentDragPos.y = this.dragStartPos.y - dy * ratio;
    }

    // Update carriage position
    if (this.carriage) {
      this.carriage.setPosition(this.currentDragPos.x, this.currentDragPos.y);
    }

    // Update band visuals
    this.updateBandVisuals();

    // Draw trajectory preview
    this.drawTrajectoryPreview(dx, dy, limitedDragDistance, dragDistance);
  }

  private updateBandVisuals(): void {
    if (!this.leftBand || !this.rightBand || !this.carriage) return;

    const { width, height } = this.config;

    this.leftBand.setTo(
      this.position.x - width / 2,
      this.position.y - height,
      this.carriage.x,
      this.carriage.y
    );

    this.rightBand.setTo(
      this.position.x + width / 2,
      this.position.y - height,
      this.carriage.x,
      this.carriage.y
    );
  }

  private drawTrajectoryPreview(dx: number, dy: number, limited: number, actual: number): void {
    if (!this.trajectoryGraphics || !this.carriage) return;

    this.trajectoryGraphics.clear();

    // Draw trajectory line
    if (actual > 0) {
      const trajectoryLength = 200;
      const ratio = trajectoryLength / actual;

      this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.6);
      this.trajectoryGraphics.lineBetween(
        this.carriage.x,
        this.carriage.y,
        this.carriage.x + dx * ratio,
        this.carriage.y + dy * ratio
      );

      // Draw power indicator
      const powerPercent = limited / 150;
      const color = powerPercent > 0.7 ? 0xff0000 : powerPercent > 0.4 ? 0xffff00 : 0x00ff00;
      this.trajectoryGraphics.fillStyle(color, 0.5);
      this.trajectoryGraphics.fillCircle(this.carriage.x, this.carriage.y, 5 + powerPercent * 10);
    }
  }

  private endDrag(): void {
    if (!this.isDragging || !this.projectileManager) return;

    this.isDragging = false;

    // Calculate velocity
    const dx = this.dragStartPos.x - this.currentDragPos.x;
    const dy = this.dragStartPos.y - this.currentDragPos.y;

    // Apply power multiplier based on difficulty
    const powerMultiplier = this.config.powerMultiplierPerDifficulty[this.currentDifficulty] || 1;
    const velocityMultiplier = powerMultiplier * (this.config.maxPower / 100);

    const velocityX = dx * velocityMultiplier;
    const velocityY = dy * velocityMultiplier;

    // Fire projectile if there's enough power
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      this.fireProjectile(velocityX, velocityY);
    }

    // Reset carriage position
    this.resetCarriage();
  }

  private fireProjectile(velocityX: number, velocityY: number): void {
    if (!this.projectileManager) return;

    this.projectileManager.fireProjectile(
      {
        x: this.position.x,
        y: this.position.y,
        velocityX,
        velocityY,
        radius: 8,
        fillColor: 0xff6b6b,
        trailColor: 0xcccccc,
      },
      this.currentDifficulty
    );
  }

  private resetCarriage(): void {
    if (!this.carriage || !this.leftBand || !this.rightBand) return;

    this.carriage.setPosition(this.position.x, this.position.y);
    this.carriage.clear();
    this.carriage.fillStyle(0x8b4513);
    this.carriage.fillCircle(0, 0, 12);
    this.carriage.lineStyle(2, 0x654321);
    this.carriage.strokeCircle(0, 0, 12);

    this.updateBandVisuals();

    // Clear trajectory graphics
    if (this.trajectoryGraphics) {
      this.trajectoryGraphics.clear();
    }
  }

  public setProjectileManager(manager: ProjectileManager): void {
    this.projectileManager = manager;
  }

  public setDifficulty(difficulty: DifficultyLevel): void {
    this.currentDifficulty = difficulty;
  }

  public destroy(): void {
    if (this.leftRail) this.leftRail.destroy();
    if (this.rightRail) this.rightRail.destroy();
    if (this.leftBand) this.leftBand.destroy();
    if (this.rightBand) this.rightBand.destroy();
    if (this.carriage) this.carriage.destroy();
    if (this.trajectoryGraphics) {
      this.trajectoryGraphics.destroy();
    }
  }
}
