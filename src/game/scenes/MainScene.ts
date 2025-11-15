import { Scene } from 'phaser';
import { TargetManager } from '@/game/managers/TargetManager';
import { CollisionFeedbackManager } from '@/game/managers/CollisionFeedbackManager';
import { ProjectileManager } from '@/game/managers/ProjectileManager';
import { SlingshotController } from '@/game/components/SlingshotController';
import { DifficultyLevel } from '@/config/targetConfig';
import { TargetSystemTest } from '@/game/test/TargetSystemTest';

export class MainScene extends Scene {
  private targetManager?: TargetManager;
  private collisionFeedback?: CollisionFeedbackManager;
  private projectileManager?: ProjectileManager;
  private slingshotController?: SlingshotController;
  private instructions?: Phaser.GameObjects.Text;
  private testRunner?: TargetSystemTest;
  private currentDifficulty: DifficultyLevel = 'NORMAL';

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    console.log('MainScene: Preloading assets');
  }

  create(): void {
    // Enable physics
    this.physics.world.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);

    // Create TargetManager
    this.targetManager = new TargetManager(this, this.currentDifficulty);

    // Create CollisionFeedbackManager
    this.collisionFeedback = new CollisionFeedbackManager(this, this.targetManager);

    // Create ProjectileManager
    this.projectileManager = new ProjectileManager(
      this,
      this.targetManager,
      this.collisionFeedback
    );

    // Create SlingshotController
    const slingshotX = this.cameras.main.width / 2;
    const slingshotY = this.cameras.main.height - 120;
    this.slingshotController = new SlingshotController(this, {
      x: slingshotX,
      y: slingshotY,
      width: 80,
      height: 100,
      maxPower: 100,
      powerMultiplierPerDifficulty: {
        EASY: 1.2,
        NORMAL: 1.0,
        HARD: 0.8,
        EXPERT: 0.6,
      },
    });
    this.slingshotController.setProjectileManager(this.projectileManager);

    // Set up event listeners
    this.setupTargetEvents();
    this.setupCollisionEvents();
    this.setupProjectileEvents();

    // Create UI
    this.createInstructions();

    // Start the target system
    this.targetManager.start();

    console.log('MainScene: Created with integrated collision feedback system');
  }

  private setupTargetEvents(): void {
    if (!this.targetManager) return;

    this.targetManager.on('color-change', (data) => {
      console.log(`Color changed to: ${data.color}, Time remaining: ${data.timeRemaining}ms`);
    });

    this.targetManager.on('size-threshold', (data) => {
      console.log(`Size threshold reached: ${data.radius}px (${data.percentage}%)`);
    });

    this.targetManager.on('target-complete', (data) => {
      console.log(`Target shrink complete: ${data.finalRadius}px`);
    });

    this.targetManager.on('target-respawn', (data) => {
      console.log(`Target respawned at: (${data.position.x}, ${data.position.y})`);
    });

    this.targetManager.on('difficulty-changed', (data) => {
      console.log(`Difficulty changed from ${data.oldDifficulty} to ${data.newDifficulty}`);
    });
  }

  private setupCollisionEvents(): void {
    if (!this.collisionFeedback) return;

    this.collisionFeedback.on('hit', (data) => {
      console.log(`Hit detected! Tier: ${data.tier}, Score: ${data.score}`);
    });

    this.collisionFeedback.on('miss', (data) => {
      console.log(`Miss detected at position (${data.position.x}, ${data.position.y})`);
    });

    this.collisionFeedback.on('score-updated', (data) => {
      console.log(`Score updated: ${data.totalScore}`);
    });
  }

  private setupProjectileEvents(): void {
    if (!this.projectileManager) return;

    this.projectileManager.on('projectile-fired', () => {
      console.log('Projectile fired!');
    });

    this.projectileManager.on('projectile-hit', (data) => {
      console.log(`Projectile hit target! Tier: ${data.tier}`);
    });

    this.projectileManager.on('projectile-missed', () => {
      console.log('Projectile missed target');
    });
  }

  private createInstructions(): void {
    this.instructions = this.add.text(
      this.cameras.main.width / 2,
      20,
      'Drag the slingshot carriage to aim and fire • Use keys 1-4 to change difficulty • Press T for tests',
      {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 15, y: 8 },
      }
    );
    this.instructions.setOrigin(0.5, 0);
    this.instructions.setScrollFactor(0);
    this.instructions.setDepth(1000);

    // Create difficulty buttons
    this.createDifficultyButtons();
  }

  private createDifficultyButtons(): void {
    const difficulties: DifficultyLevel[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
    const buttonWidth = 80;
    const buttonHeight = 30;
    const startX = this.cameras.main.width / 2 - (difficulties.length * buttonWidth) / 2;
    const y = this.cameras.main.height - 40;

    difficulties.forEach((difficulty, index) => {
      const x = startX + index * (buttonWidth + 10);

      const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x3498db)
        .setOrigin(0.5)
        .setInteractive();

      this.add.text(x, y, difficulty, {
        fontSize: '12px',
        color: '#ffffff',
      }).setOrigin(0.5);

      button.on('pointerover', () => {
        button.setFillStyle(0x2980b9);
      });

      button.on('pointerout', () => {
        button.setFillStyle(0x3498db);
      });

      button.on('pointerdown', () => {
        this.changeDifficulty(difficulty);
      });
    });

    // Add keyboard controls
    this.input.keyboard?.on('keydown-ONE', () => this.changeDifficulty('EASY'));
    this.input.keyboard?.on('keydown-TWO', () => this.changeDifficulty('NORMAL'));
    this.input.keyboard?.on('keydown-THREE', () => this.changeDifficulty('HARD'));
    this.input.keyboard?.on('keydown-FOUR', () => this.changeDifficulty('EXPERT'));

    // Add test runner (press T to run tests)
    this.input.keyboard?.on('keydown-T', () => this.runTests());
  }

  private changeDifficulty(difficulty: DifficultyLevel): void {
    this.currentDifficulty = difficulty;

    if (this.targetManager) {
      this.targetManager.setDifficulty(difficulty);
    }

    if (this.slingshotController) {
      this.slingshotController.setDifficulty(difficulty);
    }

    console.log(`Difficulty changed to: ${difficulty}`);
  }

  private runTests(): void {
    console.log('🧪 Running Target System Tests...');
    this.testRunner = new TargetSystemTest(this);
    const results = this.testRunner.runAllTests();
    
    // Display results on screen
    this.displayTestResults(results);
    
    // Clean up after tests
    setTimeout(() => {
      if (this.testRunner) {
        this.testRunner.cleanup();
        this.testRunner = undefined;
      }
    }, 5000);
  }

  private displayTestResults(results: { [key: string]: boolean }): void {
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    
    const resultText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `Test Results: ${passedTests}/${totalTests} passed\n\n` +
      Object.entries(results)
        .map(([test, passed]) => `${passed ? '✅' : '❌'} ${test.replace('_', ' ').toUpperCase()}`)
        .join('\n'),
      {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 20, y: 15 },
        align: 'center',
      }
    );
    
    resultText.setOrigin(0.5);
    resultText.setScrollFactor(0);
    resultText.setDepth(2000);
    
    // Remove text after 3 seconds
    this.time.delayedCall(3000, () => {
      resultText.destroy();
    });
  }

  update(time: number, _delta: number): void {
    if (this.targetManager) {
      this.targetManager.update();
    }

    if (this.projectileManager) {
      this.projectileManager.update(time);
    }
  }

  shutdown(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.slingshotController) {
      this.slingshotController.destroy();
    }

    if (this.projectileManager) {
      this.projectileManager.destroy();
    }

    if (this.collisionFeedback) {
      this.collisionFeedback.destroy();
    }

    if (this.targetManager) {
      this.targetManager.destroy();
    }
  }
}
