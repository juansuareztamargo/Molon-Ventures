# Molon Ventures - Slingshot Demo

A physics-based slingshot game built with Phaser 3 and TypeScript. This demo showcases game bootstrap, scene management, and modular architecture suitable for future 3D migration.

## Features

- **Scene Management**: Boot, Main Menu, and Gameplay scenes with smooth transitions
- **Physics Gameplay**: Arcade physics-based slingshot mechanics
- **Modular Architecture**: Separated config, scenes, and utilities for easy extension
- **Responsive Design**: Automatic scaling and centering across different screen sizes
- **Interactive UI**: Score tracking, projectile count, and game over states

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The game will open automatically in your default browser at `http://localhost:3000`.

### Build

```bash
npm run build
```

The production build will be created in the `dist/` directory.

## Project Structure

```
src/
├── config/
│   └── gameConfig.ts       # Game configuration and scene keys
├── game/
│   └── scenes/
│       ├── BootScene.ts    # Asset loading and initialization
│       ├── MainMenuScene.ts # Main menu with start button
│       └── SlingshotScene.ts # Core gameplay scene
├── utils/
│   ├── constants.ts        # Shared constants (colors, thresholds)
│   └── helpers.ts          # Utility functions
└── main.ts                 # Game initialization
```

## How to Play

1. Click "START GAME" from the main menu
2. Drag the projectile backwards from the slingshot
3. Release to launch
4. Hit all targets with the available projectiles to win!

## Tech Stack

- **Phaser 3**: Game framework
- **TypeScript**: Type-safe development
- **Vite**: Fast development server and build tool

## Future Enhancements

- Asset loading (sprites, sounds, music)
- Level progression system
- 3D graphics migration (Three.js/Babylon.js)
- Power-ups and special projectiles
- Score persistence
