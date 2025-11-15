# Target System Documentation

## Overview
The TargetManager class implements a shrinking, color-changing target mechanic with configurable timing and difficulty parameters.

## Features

### Core Functionality
- **Smooth Shrinking Animation**: Target shrinks from configurable start size to minimum size over a set duration
- **Color Transitions**: Changes color based on remaining time (Red → Orange → Green → Purple)
- **Configurable Difficulty**: Four difficulty levels (Easy, Normal, Hard, Expert) with different parameters
- **Automatic Respawn**: Target automatically respawns at a new position after shrinking completes
- **Event System**: Emits events for color changes, size thresholds, completion, and respawn

### UI Elements
- **Phase Indicator**: Shows current color phase and remaining time
- **Difficulty Display**: Shows current difficulty level
- **Interactive Controls**: Click target to reset, use buttons or keys 1-4 to change difficulty

## Configuration

### Difficulty Levels
- **EASY**: Start 100px → Min 20px, 7s duration, 1.5s respawn
- **NORMAL**: Start 80px → Min 10px, 5s duration, 1s respawn (default)
- **HARD**: Start 60px → Min 8px, 3s duration, 0.5s respawn
- **EXPERT**: Start 40px → Min 5px, 2s duration, 0.3s respawn

### Color Timing Thresholds
- **RED**: 75%+ time remaining
- **ORANGE**: 50%-75% time remaining
- **GREEN**: 25%-50% time remaining
- **PURPLE**: 0%-25% time remaining

## API Reference

### TargetManager Class

#### Constructor
```typescript
constructor(scene: Scene, difficulty: DifficultyLevel = 'NORMAL')
```

#### Methods
- `start()`: Start the shrinking animation
- `stop()`: Stop the shrinking animation
- `reset()`: Reset target to new position and initial state
- `update()`: Update animation (call in scene update loop)
- `setDifficulty(difficulty)`: Change difficulty level
- `getCurrentDifficulty()`: Get current difficulty level
- `getTarget()`: Get the Phaser target object
- `getCurrentRadius()`: Get current target radius
- `on(event, callback)`: Listen to events
- `off(event, callback)`: Remove event listener
- `destroy()`: Clean up resources

#### Events
- `color-change`: { color: TargetColor, timeRemaining: number }
- `size-threshold`: { radius: number, percentage: number }
- `target-complete`: { finalRadius: number }
- `target-respawn`: { position: { x, y } }
- `difficulty-changed`: { oldDifficulty, newDifficulty }

## Usage Example

```typescript
// Create target manager
const targetManager = new TargetManager(this.scene, 'NORMAL');

// Listen to events
targetManager.on('color-change', (data) => {
  console.log(`Color changed to ${data.color}`);
});

// Start animation
targetManager.start();

// Update in scene loop
update() {
  targetManager.update();
}
```

## Controls
- **Click Target**: Reset and restart animation
- **Keys 1-4**: Change difficulty (1=EASY, 2=NORMAL, 3=HARD, 4=EXPERT)
- **Difficulty Buttons**: Click to change difficulty

## File Structure
```
src/
├── config/
│   └── targetConfig.ts     # Configuration and difficulty settings
├── game/
│   ├── managers/
│   │   └── TargetManager.ts # Main target system class
│   ├── scenes/
│   │   └── MainScene.ts    # Scene integration and UI
│   └── types/
│       └── index.ts        # TypeScript type definitions
```

## Acceptance Criteria Met
✅ Target appears and shrinks smoothly to minimum size
✅ Target colors change at configured timing thresholds
✅ Configurable values for start size and shrink duration
✅ Target respawns with randomized positions
✅ Event system for future integration (scoring, sound)
✅ UI indicator for current timing phase
✅ Difficulty configuration system