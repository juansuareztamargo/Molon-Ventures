import Phaser from 'phaser';

export class ParticleManager {
  private scene: Phaser.Scene;
  
  // Constants
  private readonly TRAIL_TEXTURE = 'particle_trail';
  private readonly EXPLOSION_TEXTURE = 'particle_explosion';
  private readonly STAR_TEXTURE = 'particle_star';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createTextures();
  }

  private createTextures(): void {
    // 1. Soft glow for the trail (blurred circle)
    if (!this.scene.textures.exists(this.TRAIL_TEXTURE)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(4, 4, 4); // 8x8 circle
      graphics.generateTexture(this.TRAIL_TEXTURE, 8, 8);
      graphics.destroy();
    }

    // 2. Sharp spark for explosions
    if (!this.scene.textures.exists(this.EXPLOSION_TEXTURE)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(6, 6, 6); // 12x12 circle
      graphics.generateTexture(this.EXPLOSION_TEXTURE, 12, 12);
      graphics.destroy();
    }

    // 3. Star shape for bonus/perfect hits
    if (!this.scene.textures.exists(this.STAR_TEXTURE)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffff00, 1);
      // Draw a simple 4-point star or diamond
      graphics.beginPath();
      graphics.moveTo(0, -6);
      graphics.lineTo(2, -2);
      graphics.lineTo(6, 0);
      graphics.lineTo(2, 2);
      graphics.lineTo(0, 6);
      graphics.lineTo(-2, 2);
      graphics.lineTo(-6, 0);
      graphics.lineTo(-2, -2);
      graphics.closePath();
      graphics.fill();
      graphics.generateTexture(this.STAR_TEXTURE, 12, 12);
      graphics.destroy();
    }
  }

  /* 
   * NEW: Enhanced Projectile Trail 
   * - Longer lifespan
   * - Fire colors (Yellow -> Orange -> Red)
   * - Randomness in position/speed for "smoke" look
   */
  public createProjectileTrail(projectileSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, this.TRAIL_TEXTURE, {
      lifespan: { min: 400, max: 700 }, // Longer duration
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      // Interpolate colors: White -> Yellow -> Orange -> Red -> Grey
      tint: [ 0xffffaa, 0xffcc00, 0xff4400, 0x555555 ], 
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 }, // Slight random expansion
      quantity: 2, // More particles per frame
      frequency: 15, // Higher emission rate
      blendMode: 'ADD',
      emitting: false
    });
    
    // Ensure trail is behind the projectile but visible
    emitter.setDepth(10); 
    
    emitter.startFollow(projectileSprite);
    emitter.start();
    
    return emitter;
  }

  public stopTrail(emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
    if (emitter) {
      emitter.stop();
      emitter.stopFollow();
      // Auto-destroy after particles fade
      this.scene.time.delayedCall(1500, () => {
        emitter.destroy();
      });
    }
  }

  /* 
   * NEW: Ground Explosion (Dirt/Dust/Impact)
   * - More particles
   * - "Earthy" colors + Orange sparks
   * - SCALED UP for visibility
   */
  public emitExplosion(x: number, y: number): void {
    // 1. Dust/Smoke Cloud - HUGE SCALE
    // Reverting offset: Impact logic is fixed, so we can spawn at actual ground level again
    const emitY = y;
    
    const dustEmitter = this.scene.add.particles(x, emitY, this.TRAIL_TEXTURE, {
      lifespan: { min: 800, max: 1200 },
      speed: { min: 100, max: 250 },
      angle: { min: 200, max: 340 }, // Upwards cone
      scale: { start: 1.25, end: 0 }, // Reduced from 2.5 per user request
      alpha: { start: 1.0, end: 0 }, // Full opacity start
      tint: 0xffffff, // WHITE dust for max visibility
      gravityY: -50,
      quantity: 40, // More particles
      blendMode: 'NORMAL',
      emitting: false
    });
    dustEmitter.setDepth(9999); // ABSOLUTE MAX DEPTH
    dustEmitter.explode(30);

    // 2. Impact Sparks - SCALED UP
    const sparkEmitter = this.scene.add.particles(x, emitY, this.EXPLOSION_TEXTURE, {
      lifespan: { min: 400, max: 800 },
      speed: { min: 300, max: 500 },
      angle: { min: 180, max: 360 }, // Upwards
      scale: { start: 1.5, end: 0 }, // Started at 0.5, now 1.5
      tint: 0xffaa00,
      gravityY: 500,
      quantity: 30,
      blendMode: 'ADD',
      emitting: false
    });
    sparkEmitter.setDepth(10000); // Even higher for sparks
    sparkEmitter.explode(30);

    // Cleanup
    this.scene.time.delayedCall(1500, () => {
      dustEmitter.destroy();
      sparkEmitter.destroy();
    });
  }

  /*
   * NEW: Firework Explosion for Target Hits
   * - Tiered effects (NOT BAD, NICE, AWESOME, PERFECT)
   * - Sczled to x2 (down from x3)
   * - Correct palette for NICE (Orange)
   */
  public createFirework(x: number, y: number, tier: string): void {
    // Colors based on tier
    let primaryColor = 0xffffff;
    let secondaryColor = 0xffff00;
    
    // Config based on tier - x2 sizing
    let count = 40; 
    let speedMin = 150;
    let speedMax = 300;
    let life = 800;
    let scaleStart = 1.2; 
    
    if (tier === 'PERFECT') {
      primaryColor = 0xff00ff; // Purple/Pink
      secondaryColor = 0x00ffff; // Cyan
      count = 100; // Still impressive but less chaotic
      speedMin = 300;
      speedMax = 600;
      life = 1500;
      scaleStart = 2.0; // x2 size
    } else if (tier === 'AWESOME') { // Green (+3)
      primaryColor = 0x00ff00; // Green
      secondaryColor = 0xffff00; // Yellow
      count = 70;
      speedMin = 250;
      speedMax = 500;
      life = 1200;
      scaleStart = 1.6;
    } else if (tier === 'NICE') { // Orange (+2)
      primaryColor = 0xffaa00; // Orange - FIXED PALETTE
      secondaryColor = 0xffdd00; // Gold
      count = 50;
      speedMin = 200;
      speedMax = 400;
      life = 1000;
      scaleStart = 1.4;
    } else {
       // NOT BAD (Red +1)
       primaryColor = 0xff0000; // Red
       secondaryColor = 0xffaaaa; // Pinkish white
       count = 30;
       scaleStart = 1.2;
    }

    // Main Burst
    const burstParams = {
      lifespan: { min: life * 0.5, max: life },
      speed: { min: speedMin, max: speedMax },
      scale: { start: scaleStart, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [primaryColor, secondaryColor],
      gravityY: 150,
      quantity: count,
      blendMode: 'ADD',
      emitting: false
    };

    const emitter = this.scene.add.particles(x, y, this.EXPLOSION_TEXTURE, burstParams);
    emitter.setDepth(200); // High visibility
    emitter.explode(count);

    // Secondary "Sparkle" for Perfect hits
    if (tier === 'PERFECT') {
      const starEmitter = this.scene.add.particles(x, y, this.STAR_TEXTURE, {
        lifespan: { min: 800, max: 1500 },
        speed: { min: speedMin * 0.2, max: speedMax * 0.8 },
        scale: { start: 1.5, end: 0 }, // Scaled down slightly
        rotate: { min: 0, max: 360 },
        tint: 0xffffff,
        gravityY: 200,
        quantity: 25,
        blendMode: 'ADD',
        emitting: false
      });
      starEmitter.setDepth(201);
      starEmitter.explode(25);
      
      this.scene.time.delayedCall(2000, () => {
        starEmitter.destroy();
      });
    }

    this.scene.time.delayedCall(2000, () => {
      emitter.destroy();
    });
  }
}
