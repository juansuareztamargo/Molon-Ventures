# Molon-Ventures Target System

A Phaser 3 + TypeScript implementation of a shrinking, color-changing target mechanic with configurable timing and difficulty parameters.

## 🎯 Target System Features

- **Smooth Shrinking Animation**: Target smoothly shrinks from configurable start size to minimum radius
- **Color Transitions**: Dynamic color changes based on remaining time (Red → Orange → Green → Purple)  
- **Configurable Difficulty**: Four difficulty levels (Easy, Normal, Hard, Expert) with different parameters
- **Automatic Respawn**: Target respawns at randomized positions after shrinking completes
- **Event System**: Comprehensive event system for integration with scoring, sound, and other game mechanics
- **Interactive UI**: Visual indicators for current timing phase and difficulty level

## 🚀 Technology Stack

- **Phaser 3** - Modern 2D game framework
- **TypeScript** - Type-safe development
- **Vite** - Fast development server and build tool
- **ESLint & Prettier** - Code quality and formatting
- **Sass** - CSS preprocessing support
- **Path aliases** - Clean imports with `@/` prefix
- **Hot module replacement** - Fast development workflow

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd phaser3-typescript-vite-scaffold

# Install dependencies
npm install
```

## 🛠️ Development

```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

The development server will automatically open at `http://localhost:3000`.

## 🎮 Controls

- **Click Target**: Reset and restart animation
- **Keys 1-4**: Change difficulty level (1=EASY, 2=NORMAL, 3=HARD, 4=EXPERT)
- **Key T**: Run system tests
- **Difficulty Buttons**: Click to change difficulty

## 🎯 Target System Details

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

### Acceptance Criteria Met

✅ **Target Animation**: Target appears when gameplay starts, shrinks smoothly to minimum size, and loops/resets after each attempt

✅ **Color Transitions**: Target colors change at configured timing thresholds without jitter or incorrect ordering

✅ **Configurable Parameters**: Config values allow adjusting start size and shrink duration for difficulty control

✅ **Event System**: Comprehensive event emission for color changes, size thresholds, completion, and respawn for future integration

✅ **UI Indicators**: Simple UI overlay showing current timing phase, difficulty level, and remaining time

## 🏗️ Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

The production build will be output to the `dist/` directory.

## 📁 Project Structure

```
src/
├── assets/                 # Game assets
│   ├── images/            # Image files
│   ├── audio/             # Sound files
│   └── data/              # JSON data files
├── config/                # Configuration files
│   ├── gameConfig.ts      # Phaser game configuration
│   └── constants.ts       # Game constants
├── game/                  # Game logic
│   ├── managers/          # Game managers (e.g., GameManager)
│   ├── scenes/            # Phaser scenes
│   └── types/             # TypeScript type definitions
└── main.ts                # Application entry point
```

## 🎮 Getting Started

### Creating a New Scene

```typescript
import { Scene } from 'phaser';

export class MyScene extends Scene {
  constructor() {
    super({ key: 'MyScene' });
  }

  preload(): void {
    // Load assets
    this.load.image('player', 'assets/images/player.png');
  }

  create(): void {
    // Create game objects
    const player = this.add.sprite(400, 300, 'player');
  }

  update(): void {
    // Game loop logic
  }
}
```

### Adding Scenes to Game Config

Update `src/config/gameConfig.ts`:

```typescript
import { MainScene } from '@/game/scenes/MainScene';
import { MyScene } from '@/game/scenes/MyScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  // ... other config
  scene: [MainScene, MyScene],
};
```

### Using Path Aliases

Instead of relative imports:
```typescript
// Instead of this
import { GameManager } from '../../managers/GameManager';

// Use this
import { GameManager } from '@/game/managers/GameManager';
```

## 🎯 Game Development Tips

### Asset Management

- Place images in `src/assets/images/`
- Place audio files in `src/assets/audio/`
- Place JSON data in `src/assets/data/`
- Use Vite's asset import system for optimal loading

### Scene Management

- Each scene should have a unique key
- Use `this.scene.start('SceneKey')` to transition between scenes
- Implement proper cleanup in scene's `shutdown()` method

### Performance

- Use object pools for frequently created/destroyed objects
- Optimize sprite sheets and texture sizes
- Use Phaser's built-in physics systems efficiently

## 🔧 Configuration

### TypeScript

TypeScript is configured with strict mode enabled. Modify `tsconfig.json` to adjust compiler options.

### ESLint

ESLint rules are defined in `.eslintrc.cjs`. Customize rules based on your team's preferences.

### Prettier

Code formatting rules are in `.prettierrc`. Adjust formatting preferences as needed.

### Vite

Vite configuration is in `vite.config.ts`. Modify for custom build requirements or plugins.

## 📚 Resources

- [Phaser 3 Documentation](https://phaser.io/docs/3.60.0/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.