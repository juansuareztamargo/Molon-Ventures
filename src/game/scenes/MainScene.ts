import { Scene } from 'phaser';
import { TargetManager } from '@/game/managers/TargetManager';
import { DifficultyLevel } from '@/config/targetConfig';
import { TargetSystemTest } from '@/game/test/TargetSystemTest';

export class MainScene extends Scene {
  private targetManager?: TargetManager;
  private instructions?: Phaser.GameObjects.Text;
  private testRunner?: TargetSystemTest;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    console.log('MainScene: Preloading assets');
  }

  create(): void {
    // Create TargetManager
    this.targetManager = new TargetManager(this);
    
    // Set up event listeners
    this.setupTargetEvents();
    
    // Create instructions
    this.createInstructions();
    
    // Start the target system
    this.targetManager.start();
    
    console.log('MainScene: Created with TargetManager');
  }

  private setupTargetEvents(): void {
    if (!this.targetManager) return;

    // Listen for color changes
    this.targetManager.on('color-change', (data) => {
      console.log(`Color changed to: ${data.color}, Time remaining: ${data.timeRemaining}ms`);
    });

    // Listen for size thresholds
    this.targetManager.on('size-threshold', (data) => {
      console.log(`Size threshold reached: ${data.radius}px (${data.percentage}%)`);
    });

    // Listen for target completion
    this.targetManager.on('target-complete', (data) => {
      console.log(`Target shrink complete: ${data.finalRadius}px`);
    });

    // Listen for respawn
    this.targetManager.on('target-respawn', (data) => {
      console.log(`Target respawned at: (${data.position.x}, ${data.position.y})`);
    });

    // Listen for difficulty changes
    this.targetManager.on('difficulty-changed', (data) => {
      console.log(`Difficulty changed from ${data.oldDifficulty} to ${data.newDifficulty}`);
    });
  }

  private createInstructions(): void {
    this.instructions = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 80,
      'Click the target to test interaction • Use keys 1-4 to change difficulty',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 15, y: 8 },
      }
    );
    this.instructions.setOrigin(0.5);
    this.instructions.setScrollFactor(0);

    // Create difficulty buttons
    this.createDifficultyButtons();

    // Add click interaction to target
    if (this.targetManager) {
      const target = this.targetManager.getTarget();
      target.on('pointerdown', () => {
        console.log('Target clicked!');
        // Reset and restart on click
        this.targetManager!.reset();
        this.targetManager!.start();
      });
    }
  }

  private createDifficultyButtons(): void {
    const difficulties: DifficultyLevel[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];
    const buttonWidth = 80;
    const buttonHeight = 30;
    const startX = this.cameras.main.width / 2 - (difficulties.length * buttonWidth) / 2;
    const y = this.cameras.main.height - 40;

    difficulties.forEach((difficulty, index) => {
      const x = startX + index * (buttonWidth + 10);
      
      // Create button background
      const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x3498db)
        .setOrigin(0.5)
        .setInteractive();
      
      // Create button text
      this.add.text(x, y, difficulty, {
        fontSize: '12px',
        color: '#ffffff',
      }).setOrigin(0.5);
      
      // Hover effects
      button.on('pointerover', () => {
        button.setFillStyle(0x2980b9);
      });
      
      button.on('pointerout', () => {
        button.setFillStyle(0x3498db);
      });

      // Click handler
      button.on('pointerdown', () => {
        if (this.targetManager) {
          this.targetManager.setDifficulty(difficulty);
          console.log(`Difficulty changed to: ${difficulty}`);
        }
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
    if (this.targetManager) {
      this.targetManager.setDifficulty(difficulty);
      console.log(`Difficulty changed to: ${difficulty}`);
    }
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

  update(_time: number, _delta: number): void {
    // Update TargetManager
    if (this.targetManager) {
      this.targetManager.update();
    }
  }
}
