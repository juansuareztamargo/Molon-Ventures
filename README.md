# Molon Ventures - Slingshot Game with Target System

A physics-based slingshot game built with Phaser 3 and TypeScript. This demo showcases game bootstrap, scene management, and modular architecture suitable for future 3D migration.

## 🎯 Features

### Core Game Mechanics
- **Physics-based Slingshot**: Drag and release mechanics with trajectory preview
- **Target System**: Dynamic shrinking targets with color transitions and scoring
- **Scene Management**: Boot, Main Menu, and Gameplay scenes with smooth transitions
- **Modular Architecture**: Separated config, scenes, and utilities for easy extension
- **Responsive Design**: Automatic scaling and centering across different screen sizes
- **Interactive UI**: Score tracking, projectile count, and game over states

### Target System Features
- **Smooth Shrinking Animation**: Target smoothly shrinks from configurable start size to minimum radius
- **Color Transitions**: Dynamic color changes based on remaining time (Red → Orange → Green → Purple)  
- **Configurable Difficulty**: Four difficulty levels (Easy, Normal, Hard, Expert) with different parameters
- **Automatic Respawn**: Target respawns at randomized positions after shrinking completes
- **Event System**: Comprehensive event system for integration with scoring, sound, and other game mechanics
- **Visual Feedback**: Hit detection, scoring, and collision feedback with difficulty configuration

## 🚀 Technology Stack

- **Phaser 3** - Modern 2D game framework with physics engine
- **TypeScript** - Type-safe development
- **Vite** - Fast development server and build tool
- **ESLint & Prettier** - Code quality and formatting
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

# Build for production
npm run build

# Preview production build
npm run preview
```

The game will open automatically in your default browser at `http://localhost:3000`.

## 🎮 How to Play

1. Click "START GAME" from the main menu
2. Drag the projectile backwards from the slingshot to aim
3. Release to launch the projectile
4. Hit all targets with the available projectiles to win!
5. Use keys 1-4 to change difficulty levels
6. Press T to run target system tests

## 🏗️ Project Structure

```
src/
├── assets/
│   ├── audio/           # Sound effects and music
│   ├── data/            # Game data and configuration
│   └── images/          # Game assets and sprites
├── config/
│   ├── constants.ts     # Game constants
│   ├── gameConfig.ts    # Game configuration and scene keys
│   └── targetConfig.ts  # Target system configuration
├── game/
│   ├── managers/
│   │   ├── GameManager.ts      # Game state management
│   │   └── TargetManager.ts    # Target system logic
│   ├── scenes/
│   │   ├── BootScene.ts        # Asset loading and initialization
│   │   ├── MainMenuScene.ts    # Main menu with start button
│   │   ├── SlingshotScene.ts   # Core gameplay scene
│   │   └── MainScene.ts        # Target system demo scene
│   ├── test/
│   │   └── TargetSystemTest.ts # Automated testing
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── utils/
│   ├── constants.ts    # Shared constants (colors, thresholds)
│   ├── helpers.ts      # Utility functions
│   └── index.ts        # Utility exports
└── main.ts             # Game initialization
```

## 🎯 Target System Configuration

The target system supports four difficulty levels:

- **EASY**: Slower shrink rate, larger minimum size, longer duration
- **NORMAL**: Balanced gameplay parameters
- **HARD**: Faster shrink rate, smaller minimum size, shorter duration
- **EXPERT**: Maximum difficulty with tight timing requirements

## 🧪 Testing

The game includes automated testing for the target system:

- **Color transition tests**: Verify smooth color changes
- **Size threshold tests**: Check size reduction accuracy
- **Event system tests**: Validate event emission
- **Difficulty tests**: Ensure difficulty parameter application

Press `T` during gameplay to run all tests and see results on screen.

## 🚀 Build

```bash
npm run build
```

The production build will be created in the `dist/` directory.

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔮 Future Enhancements

- Asset loading (sprites, sounds, music)
- Level progression system
- 3D graphics migration (Three.js/Babylon.js)
- Power-ups and special projectiles
- Score persistence and leaderboards
- Multiplayer support
- Mobile touch controls optimization