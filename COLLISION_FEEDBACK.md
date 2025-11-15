# Collision Feedback System

## Overview

The collision feedback system provides comprehensive hit detection, visual feedback, and scoring for the slingshot game. It integrates with the existing target shrinking system to create a complete gameplay loop.

## Architecture

### Components

#### 1. **Projectile** (`src/game/components/Projectile.ts`)
- Manages individual projectiles fired from the slingshot
- Handles physics simulation with velocity, bounce, and world bounds
- Maintains a trail of particles for visual feedback during flight
- Automatically deactivates when out of bounds or stopped

#### 2. **SlingshotController** (`src/game/components/SlingshotController.ts`)
- Handles user input for aiming and firing projectiles
- Provides visual feedback:
  - Draggable carriage that shows pull-back position
  - Rubber band animation that stretches with drag
  - Trajectory preview line with power indicator
- Difficulty-aware power scaling:
  - EASY: 1.2x multiplier
  - NORMAL: 1.0x multiplier
  - HARD: 0.8x multiplier
  - EXPERT: 0.6x multiplier

#### 3. **CollisionFeedbackManager** (`src/game/managers/CollisionFeedbackManager.ts`)
- Detects collisions between projectiles and target
- Calculates hit tier based on target radius at impact
- Manages particle effects and visual feedback
- Tracks total score and last hit result
- Provides event system for hit/miss notifications

#### 4. **ProjectileManager** (`src/game/managers/ProjectileManager.ts`)
- Manages lifecycle of all projectiles in the game
- Coordinates collision detection with target
- Handles game state transitions between shots
- Manages reset delays and ready state

### Configuration

#### **scoringConfig.ts**
Defines hit tier system:
- **PERFECT**: Target at 0-20% of original radius → 100 base points
- **GOOD**: Target at 20-50% of original radius → 50 base points
- **BASIC**: Target larger than 50% → 25 base points
- **MISS**: Projectile leaves screen or stops → 0 points

Scoring multipliers by difficulty:
- EASY: 0.5x
- NORMAL: 1.0x
- HARD: 1.5x
- EXPERT: 2.0x

#### **difficultyConfig.ts**
Integrates difficulty settings across target and slingshot systems:
- Defines target spawn size, shrink duration, and respawn delay
- Scales slingshot power based on difficulty
- Applies score multipliers

## Hit Detection

The collision system determines hit quality based on the target's current state:

```
// Calculate hit tier
const radiusPercentage = currentRadius / startRadius;
if (radiusPercentage <= 0.2) tier = 'PERFECT';
else if (radiusPercentage <= 0.5) tier = 'GOOD';
else tier = 'BASIC';

// Calculate score
score = baseScore * difficultyMultiplier * (1 + phaseBonus * 0.5);
```

## Visual Feedback

### Hit Effects
- **Text Popup**: Displays hit tier text (PERFECT, GOOD, BASIC, MISS) with color-coded feedback
- **Particle Effects**:
  - PERFECT: 20 purple particles with large spread
  - GOOD: 12 yellow particles with medium spread
  - BASIC: 8 orange particles with small spread
- **Target Flash**: Brief alpha fade on hit
- **Score Display**: Updated score shown in top-right corner

### Projectile Trail
- Circles left behind projectile as it travels
- Fades out as projectile loses velocity
- Provides visual indication of trajectory

## Game Flow

1. **Fire** → Player drags slingshot carriage and releases
2. **Trajectory** → Projectile flies with physics simulation, leaving trail
3. **Collision Detection** → Each frame checks distance between projectile and target
4. **Hit Processing**:
   - Calculate hit tier based on target radius
   - Calculate score based on tier + difficulty
   - Display feedback (text + particles)
   - Flash target
   - Reset game after delay
5. **Miss Handling** → If projectile leaves bounds without hitting:
   - Display MISS feedback
   - Reset game after delay
6. **Reset** → Ready for next shot

## Integration with Main Scene

The `MainScene` orchestrates all systems:

```typescript
// Create managers
this.targetManager = new TargetManager(this);
this.collisionFeedback = new CollisionFeedbackManager(this, this.targetManager);
this.projectileManager = new ProjectileManager(this, this.targetManager, this.collisionFeedback);

// Create slingshot
this.slingshotController = new SlingshotController(this, config);
this.slingshotController.setProjectileManager(this.projectileManager);

// Update loop
update(time) {
  this.targetManager.update();
  this.projectileManager.update(time); // Handles collisions and particles
}
```

## Configuration via Difficulty

Difficulty can be changed via:
- UI buttons (EASY, NORMAL, HARD, EXPERT)
- Keyboard shortcuts (1, 2, 3, 4)

When difficulty changes:
- Target respawns with new settings
- Slingshot power multiplier updates
- Score multiplier adjusts for future hits

## Acceptance Criteria Status

✅ **Collisions register accurately** - Arcade physics overlap detection between projectile and target

✅ **Hit tiers differentiate based on target state** - PERFECT (0-20%), GOOD (20-50%), BASIC (50%+) of original radius

✅ **Visual feedback displayed** - Text popups, particle effects, and target flash on hit

✅ **Projectile trail visible** - Trail of circles left behind as projectile flies

✅ **Miss scenarios handled** - Graceful miss detection when projectile leaves bounds or stops

✅ **Difficulty configurable** - Easy toggle via buttons/keyboard, affects target spawn and slingshot power

✅ **Game resets cleanly** - Ready for next shot after configurable delay (500ms)

## Event System

The system uses Phaser EventEmitters for loose coupling:

```typescript
// Collision feedback events
collisionFeedback.on('hit', (data) => { /* tier, score, position */ });
collisionFeedback.on('miss', (data) => { /* position */ });
collisionFeedback.on('score-updated', (data) => { /* totalScore */ });

// Projectile events
projectileManager.on('projectile-fired', (data) => { /* projectile */ });
projectileManager.on('projectile-hit', (data) => { /* projectile, tier */ });
projectileManager.on('projectile-missed', (data) => { /* projectile */ });
```

## Future Enhancements

- Audio feedback for hits and misses
- Combo system for consecutive hits
- Leaderboard tracking
- Advanced particle effects using Phaser's particle emitter
- Hit sound variations based on tier
- Screen shake on perfect hits
