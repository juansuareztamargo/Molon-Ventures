# Molon Ventures

A Phaser 3 game built with TypeScript and Vite.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

Install dependencies:

```bash
npm install
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

The game will automatically open in your browser at `http://localhost:3000`.

### Building for Production

Create an optimized production build:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## 📁 Project Structure

```
molon-ventures/
├── src/
│   ├── main.ts              # Entry point
│   ├── config/
│   │   ├── gameConfig.ts    # Phaser game configuration
│   │   └── constants.ts     # Game constants
│   ├── game/
│   │   └── scenes/
│   │       └── MainScene.ts # Main game scene
│   └── assets/              # Game assets
│       ├── images/
│       ├── audio/
│       └── sprites/
├── index.html               # HTML template
├── package.json
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── .eslintrc.cjs            # ESLint configuration
├── .prettierrc              # Prettier configuration
└── .editorconfig            # Editor configuration
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## 🎮 Development Guide

### Adding New Scenes

1. Create a new scene file in `src/game/scenes/`:

```typescript
import Phaser from 'phaser';

export class MyNewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MyNewScene' });
  }

  preload(): void {
    // Load assets
  }

  create(): void {
    // Initialize scene
  }

  update(): void {
    // Game loop
  }
}
```

2. Register the scene in `src/config/gameConfig.ts`:

```typescript
import { MyNewScene } from '@/game/scenes/MyNewScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  // ...
  scene: [MainScene, MyNewScene],
};
```

### Adding Assets

Place your assets in the appropriate directory under `src/assets/`:

- Images: `src/assets/images/`
- Audio: `src/assets/audio/`
- Sprites: `src/assets/sprites/`

Load them in your scene's `preload()` method:

```typescript
preload(): void {
  this.load.image('player', '/src/assets/sprites/player.png');
  this.load.audio('music', '/src/assets/audio/music.mp3');
}
```

### Using Path Aliases

The project is configured with `@/` as an alias for the `src/` directory:

```typescript
import { MainScene } from '@/game/scenes/MainScene';
import { GAME_WIDTH } from '@/config/constants';
```

## 🔧 Technology Stack

- **Phaser 3** - Game framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting
- **Sass** - CSS preprocessing (optional)

## 📝 Code Style

This project uses ESLint and Prettier to maintain code quality and consistency. The configuration enforces:

- TypeScript strict mode
- Consistent code formatting
- No unused variables or parameters
- Proper type definitions

Run `npm run lint` and `npm run format` before committing your changes.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and formatting: `npm run lint:fix && npm run format`
4. Test your changes: `npm run dev`
5. Build to ensure no errors: `npm run build`
6. Commit and push your changes

## 📄 License

MIT
