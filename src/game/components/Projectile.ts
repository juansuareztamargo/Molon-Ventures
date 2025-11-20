import { Scene } from 'phaser';

export interface ProjectileConfig {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius?: number;
  fillColor?: number;
  trailColor?: number;
}

export class Projectile {
  private scene: Scene;
  private body!: Phaser.Physics.Arcade.Sprite;
  private trail: Phaser.GameObjects.Arc[] = [];
  private maxTrailLength: number = 20;
  private isActive: boolean = true;
  private lifetime: number = 10000; // 10 seconds lifetime
  private config: Required<ProjectileConfig>;
  private lastTrailTime: number = 0;
  private trailInterval: number = 50; // ms between trail points

  constructor(scene: Scene, config: ProjectileConfig) {
    this.scene = scene;
    this.config = {
      radius: config.radius || 8,
      fillColor: config.fillColor || 0xff6b6b,
      trailColor: config.trailColor || 0xcccccc,
      ...config,
    };

    this.createProjectile();
    this.setupPhysics();
  }

  private createProjectile(): void {
    // Create a circle graphic for the projectile
    const graphics = this.scene.make.graphics({
      x: 0,
      y: 0,
    } as Phaser.Types.GameObjects.Graphics.Options);
    graphics.fillStyle(this.config.fillColor);
    graphics.fillCircle(
      this.config.radius,
      this.config.radius,
      this.config.radius
    );

    graphics.generateTexture(
      'projectile',
      this.config.radius * 2,
      this.config.radius * 2
    );
    graphics.destroy();

    // Create physics sprite with the generated texture
    this.body = this.scene.physics.add.sprite(
      this.config.x,
      this.config.y,
      'projectile'
    );

    this.body.setScale(1);
    this.body.setVelocity(this.config.velocityX, this.config.velocityY);
    this.body.setBounce(0.8);
    this.body.setCollideWorldBounds(true);
    this.body.setData('isActive', true);
  }

  private setupPhysics(): void {
    // Set up collision detection will be done by manager
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    this.scene.time.delayedCall(this.lifetime, () => {
      this.deactivate();
    });
  }

  public update(currentTime: number): void {
    if (!this.isActive || !this.body.active) return;

    // Add trail points
    if (currentTime - this.lastTrailTime > this.trailInterval) {
      this.addTrailPoint();
      this.lastTrailTime = currentTime;
    }

    // Check if projectile is out of bounds or stopped
    if (this.isOutOfBounds() || this.isStopped()) {
      this.deactivate();
    }
  }

  private addTrailPoint(): void {
    if (!this.config.trailColor) return;

    const trailPoint = this.scene.add.circle(
      this.body.x,
      this.body.y,
      this.config.radius * 0.5,
      this.config.trailColor,
      0.5
    );
    this.trail.push(trailPoint);

    // Remove old trail points
    if (this.trail.length > this.maxTrailLength) {
      const oldPoint = this.trail.shift();
      if (oldPoint) {
        oldPoint.destroy();
      }
    }
  }

  private isOutOfBounds(): boolean {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const margin = 100;

    return (
      this.body.x < -margin ||
      this.body.x > width + margin ||
      this.body.y < -margin ||
      this.body.y > height + margin
    );
  }

  private isStopped(): boolean {
    const velocity = this.body.body as Phaser.Physics.Arcade.Body;
    const speedX = Math.abs(velocity.velocity.x);
    const speedY = Math.abs(velocity.velocity.y);
    const speed = Math.sqrt(speedX * speedX + speedY * speedY);
    return speed < 10; // Nearly stopped
  }

  public deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.body.setActive(false);
    this.body.setData('isActive', false);

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this.body,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.destroy();
      },
    });
  }

  public destroy(): void {
    // Clear trail
    this.trail.forEach((point) => {
      if (point) {
        point.destroy();
      }
    });
    this.trail = [];

    // Destroy main body
    if (this.body) {
      this.body.destroy();
    }

    this.isActive = false;
  }

  public getBody(): Phaser.Physics.Arcade.Sprite {
    return this.body;
  }

  public isCurrentlyActive(): boolean {
    return this.isActive && this.body.active;
  }

  public getTrail(): Phaser.GameObjects.Arc[] {
    return this.trail;
  }
}
