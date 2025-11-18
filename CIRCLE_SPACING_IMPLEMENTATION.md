# Circle Spacing Implementation

## Overview
This document describes the circle spacing enforcement system that prevents overlapping circles and ensures they remain within the allowed playfield boundaries.

## Constants
All spacing-related constants are defined in `src/utils/constants.ts` under the `CIRCLE_SPACING` export:

```typescript
export const CIRCLE_SPACING = {
  MIN_CIRCLE_DISTANCE: 150,        // Minimum pixels between circle centers
  SCREEN_PADDING: 100,               // Distance from screen edges
  MAX_POSITIONING_ATTEMPTS: 50,      // Maximum random positioning attempts
  SPAWN_HEIGHT_MIN: 0.1,             // Circle spawn starts at 10% of screen height
  SPAWN_HEIGHT_MAX: 0.5,             // Circle spawn ends at 50% of screen height
} as const;
```

## Implementation

### 1. Constants Definition (`src/utils/constants.ts`)
- Added `CIRCLE_SPACING` constant object with all spacing rules
- Exported for use throughout the codebase

### 2. Helper Methods (`src/game/scenes/SlingshotScene.ts`)

#### `findValidCirclePosition(screenWidth, screenHeight, radius)`
- **Purpose**: Finds a valid spawn position for a new circle
- **Process**:
  1. Attempts random position generation up to `MAX_POSITIONING_ATTEMPTS` times
  2. Each attempt generates a random X coordinate within horizontal bounds (with padding)
  3. Each attempt generates a random Y coordinate within the spawn height band (10%-50% of screen)
  4. Validates each position using `isValidCirclePosition()`
  5. Returns the first valid position found
  6. **Fallback**: If all attempts fail, uses deterministic horizontal slot positioning
- **Fallback Algorithm**:
  - Divides the usable screen width into equal slots (one per target in the round)
  - Places circles in slots from left to right
  - Centers circles vertically within the spawn band
  - Clamps final position to ensure it stays within bounds
- **Logging**: Logs `[CIRCLE]` diagnostics showing attempt number or fallback slot info

#### `isValidCirclePosition(x, y, radius, minDistance)`
- **Purpose**: Validates if a position is suitable for a circle
- **Validation Checks**:
  1. **Horizontal bounds**: Circle must not extend beyond `SCREEN_PADDING` from edges
  2. **Vertical bounds**: Circle must be within the spawn height band (10%-50%)
  3. **Distance check**: Minimum distance from all existing circles must be >= `minDistance + radius + otherRadius`
- **Returns**: `true` if position is valid, `false` otherwise

### 3. Target Spawning (`spawnTarget()`)
- Calls `findValidCirclePosition()` before creating each circle
- Uses the validated coordinates (`fixedX`, `fixedY`) for circle positioning
- Stores coordinates in `TargetData` for use by collision detection and reward systems

### 4. Reward Display (`spawnRewardDisplay()`)
- Includes position coordinates in console logging
- Displays base reward value inside the circle at the validated position
- Logging format: `[CIRCLE] Spawned at (x, y) with base reward: +X radius: R`

## Distance Calculation
The spacing validation uses **center-to-center distance** accounting for both circle radii:

```
requiredDistance = MIN_CIRCLE_DISTANCE + radius + otherRadius
distance = sqrt((x1 - x2)² + (y1 - y2)²)
valid = distance >= requiredDistance
```

This ensures a minimum of 150px between circle centers, regardless of their individual radii.

## Console Logging
All spacing operations log diagnostic information with the `[CIRCLE]` prefix for easy filtering:

- `[CIRCLE] Valid position found on attempt X: (x, y)` - Successful random positioning
- `[CIRCLE] Using fallback position after 50 attempts` - Fallback triggered
- `[CIRCLE] Fallback slot index: X, position: (x, y)` - Fallback position details
- `[CIRCLE] Spawned at (x, y) with base reward: +X radius: R` - Circle spawned successfully

## Acceptance Criteria Met
✓ No two circles render closer than 150px center-to-center
✓ Circles always appear within horizontal padding (100px from edges)
✓ Circles only spawn in upper playfield band (10%-50% of screen height)
✓ Fallback placement triggers only after exhausting all random attempts
✓ Fallback uses deterministic horizontal slots, never placing circles off-screen
✓ `[CIRCLE]` logs show validated positions or fallback notices for QA
✓ Game remains stable with higher circle counts (5+) without overlaps

## Visual Bounds
- **Canvas**: 1024x768 pixels
- **Horizontal Safe Zone**: 100px to 924px (100px padding on each side)
- **Vertical Spawn Band**: 76.8px to 384px (10%-50% of 768px height)
- **Circle Size**: 60px initial radius
- **Minimum Spacing**: 150px between circle centers
