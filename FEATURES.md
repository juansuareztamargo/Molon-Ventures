# Slingshot Demo - Feature Documentation

## Implemented Features

### 1. Game Bootstrap & Configuration
- **GameConfig** (`src/config/gameConfig.ts`):
  - Canvas dimensions: 1024x768
  - Arcade Physics with gravity (y: 300)
  - Sky blue background (#87CEEB)
  - FIT scaling mode with auto-centering
  - Scene key constants for type safety

### 2. Scene Management
The game implements three core scenes with smooth transitions:

#### BootScene (`src/game/scenes/BootScene.ts`)
- Displays loading screen with progress bar
- Simulates asset preloading
- Automatically transitions to MainMenu when complete
- Ready for real asset loading in future

#### MainMenuScene (`src/game/scenes/MainMenuScene.ts`)
- Animated title text with pulsing effect
- Decorative floating particles
- Gradient background effect
- "START GAME" button with hover effects
- Game instructions display
- Transitions to SlingshotScene on click

#### SlingshotScene (`src/game/scenes/SlingshotScene.ts`)
- Core gameplay implementation
- Slingshot physics mechanics
- Target destruction system
- Win/lose conditions
- Game over overlay with statistics
- Restart and menu navigation

### 3. Gameplay Mechanics

#### Slingshot System
- Visual slingshot with elastic bands
- Drag-and-release controls
- Trajectory preview line
- Maximum drag distance limit (150px)
- Velocity multiplier for projectile launch (3x)

#### Physics
- Arcade physics for all game objects
- Gravity simulation (300 units)
- Collision detection between:
  - Projectiles and targets
  - Projectiles and ground
  - Targets and ground
- Bounce effects on impacts

#### Projectiles
- 5 projectiles per game
- Circular physics body (30px diameter)
- Launch velocity based on drag direction/distance
- Automatic cleanup when off-screen or settled

#### Targets
- 3 destructible targets per level
- Square shape (40x40px)
- Particle explosion effects on hit
- Physics-enabled with bounce

### 4. UI System

#### Heads-Up Display
- **Target Counter**: Shows remaining targets (top-left)
- **Projectile Counter**: Shows remaining shots (top-right)
- **Instructions**: Drag-and-release guidance (top-center)

#### Game Over Screen
- Victory message (green) or defeat message (red)
- Statistics display:
  - Targets destroyed count
  - Projectiles used count
- "RESTART" button - replay current level
- "MENU" button - return to main menu
- Semi-transparent overlay
- Animated text effects

### 5. Utilities & Constants

#### Constants (`src/utils/constants.ts`)
- **Color Palette**: All game colors defined in one place
- **Input Thresholds**: Drag distances and velocity multipliers
- **UI Styles**: Font sizes and families
- **Game Settings**: Projectile count, target count, ground height

#### Helper Functions (`src/utils/helpers.ts`)
- `createTextStyle()`: Consistent text styling
- `centerText()`: Text positioning utility
- `createButton()`: Interactive button creation with hover effects
- `distanceBetween()`: Distance calculation for drag mechanics
- `clamp()`: Value limiting utility

### 6. Asset Generation
All visual assets are generated procedurally using Phaser Graphics:
- **Slingshot**: Brown wooden structure with posts and bands
- **Projectiles**: Dark circular sprites with highlights
- **Targets**: Red square sprites with white borders
- **Particle Effects**: Colored circles for explosions
- **UI Elements**: Rectangles for buttons and overlays

### 7. Responsive Design
- Automatic scaling to fit any screen size
- Maintains aspect ratio
- Centers canvas in viewport
- Responsive to window resize events

## Input Controls
- **Mouse Drag**: Pull back projectile from slingshot
- **Mouse Release**: Launch projectile
- **Click**: Interact with buttons (Start, Restart, Menu)

## Game Flow
1. Boot Scene (loading) → Main Menu
2. Main Menu → Slingshot Scene (on click)
3. Slingshot Scene:
   - Launch projectiles to destroy targets
   - Win: Destroy all 3 targets
   - Lose: Run out of projectiles
4. Game Over → Restart or return to Menu

## Code Organization
- **Modular Structure**: Separated concerns for easy maintenance
- **Type Safety**: Full TypeScript with strict mode
- **Path Aliases**: `@/` prefix for clean imports
- **Reusable Components**: Buttons, text styles, utilities
- **Constants Extraction**: Easy configuration adjustments
- **Future-Proof**: Architecture supports 3D migration

## Performance Considerations
- Efficient particle effects (8 particles per explosion)
- Automatic cleanup of off-screen objects
- Optimized collision detection
- No external asset loading overhead
- Minimal memory footprint

## Extensibility
The codebase is structured for easy extension:
- Add new scenes by extending `Phaser.Scene`
- Add new utilities in `utils/` directory
- Modify game settings in `constants.ts`
- Replace procedural graphics with real assets
- Add sound effects and music
- Implement level progression
- Add power-ups and special projectiles
