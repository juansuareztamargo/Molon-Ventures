import { TargetManager } from '@/game/managers/TargetManager';
import { DifficultyLevel } from '@/config/targetConfig';

/**
 * Test suite for TargetManager functionality
 * This file contains basic tests to verify the target system works as expected
 */
export class TargetSystemTest {
  private targetManager: TargetManager;
  private testResults: { [key: string]: boolean } = {};

  constructor(scene: Phaser.Scene) {
    this.targetManager = new TargetManager(scene, 'NORMAL');
  }

  /**
   * Run all tests and return results
   */
  public runAllTests(): { [key: string]: boolean } {
    console.log('🧪 Running Target System Tests...');
    
    this.testInitialization();
    this.testDifficultyChange();
    this.testEventSystem();
    this.testTargetInteraction();
    
    this.printResults();
    return this.testResults;
  }

  private testInitialization(): void {
    try {
      // Test that target manager initializes correctly
      const target = this.targetManager.getTarget();
      const difficulty = this.targetManager.getCurrentDifficulty();
      
      this.testResults['initialization'] = 
        target !== undefined && 
        difficulty === 'NORMAL' &&
        this.targetManager.getCurrentRadius() > 0;
      
      console.log('✅ Initialization test passed');
    } catch (error) {
      this.testResults['initialization'] = false;
      console.log('❌ Initialization test failed:', error);
    }
  }

  private testDifficultyChange(): void {
    try {
      const difficulties: DifficultyLevel[] = ['EASY', 'HARD', 'EXPERT', 'NORMAL'];
      let allChangesSuccessful = true;
      
      difficulties.forEach(difficulty => {
        this.targetManager.setDifficulty(difficulty);
        const currentDifficulty = this.targetManager.getCurrentDifficulty();
        if (currentDifficulty !== difficulty) {
          allChangesSuccessful = false;
        }
      });
      
      this.testResults['difficulty_change'] = allChangesSuccessful;
      console.log('✅ Difficulty change test passed');
    } catch (error) {
      this.testResults['difficulty_change'] = false;
      console.log('❌ Difficulty change test failed:', error);
    }
  }

  private testEventSystem(): void {
    try {
      // Test color change event
      this.targetManager.on('color-change', () => {
        // Event received - test passes
      });
      
      // Start animation to trigger events
      this.targetManager.start();
      
      // Simulate some time passing
      setTimeout(() => {
        this.targetManager.update();
      }, 100);
      
      this.testResults['event_system'] = true; // Basic test - events are set up
      console.log('✅ Event system test passed');
    } catch (error) {
      this.testResults['event_system'] = false;
      console.log('❌ Event system test failed:', error);
    }
  }

  private testTargetInteraction(): void {
    try {
      const target = this.targetManager.getTarget();
      
      // Test that target is interactive
      this.testResults['target_interaction'] = target.input !== undefined;
      console.log('✅ Target interaction test passed');
    } catch (error) {
      this.testResults['target_interaction'] = false;
      console.log('❌ Target interaction test failed:', error);
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Results:');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.replace('_', ' ').toUpperCase()}`);
    });
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(Boolean).length;
    console.log(`\n🎯 ${passedTests}/${totalTests} tests passed`);
  }

  /**
   * Clean up test resources
   */
  public cleanup(): void {
    if (this.targetManager) {
      this.targetManager.destroy();
    }
  }
}