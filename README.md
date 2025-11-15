# Slingshot Game

An interactive slingshot game built with Phaser.js featuring physics-based projectile mechanics and drag-and-drop controls.

## Features

- **Interactive Slingshot**: Click and drag to aim, release to launch projectiles
- **Physics-Based Motion**: Realistic projectile trajectories with gravity
- **Visual Feedback**: Trajectory preview while aiming, projectile trails
- **Responsive Design**: Works with both mouse and touch input
- **Modular Architecture**: Clean separation of components for easy extension

## Quick Start

### Option 1: Using a Local Server (Recommended)

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:8080`

### Option 2: Direct File Access

Simply open `index.html` in your web browser. Note that some browsers may have restrictions on loading local files, so using a local server is recommended.

## How to Play

1. Click and hold on the slingshot carriage (the circular part)
2. Drag downward to aim and build tension
3. Release to launch the projectile
4. Watch the projectile follow a realistic arc trajectory
5. Wait for the cooldown before firing again

## Game Controls

- **Mouse**: Click and drag to aim, release to fire
- **Touch**: Tap and drag to aim, release to fire
- **Trajectory Preview**: White dots show predicted path while aiming

## Architecture

The game is built with a modular architecture to support future enhancements:

### Core Components

- **`SlingshotController`**: Manages slingshot graphics, input handling, and physics calculations
- **`Projectile`**: Handles projectile physics, lifecycle, and visual effects
- **`SlingshotScene`**: Main game scene coordinating all components

### Configuration

All game parameters are centralized in `src/config/GameConfig.js`:

- Slingshot dimensions and physics
- Projectile properties
- Visual settings
- Trajectory preview options

### File Structure

```
├── src/
│   ├── config/
│   │   └── GameConfig.js          # Centralized configuration
│   ├── game/
│   │   ├── components/
│   │   │   ├── SlingshotController.js  # Slingshot logic
│   │   │   └── Projectile.js            # Projectile system
│   │   └── scenes/
│   │       └── SlingshotScene.js        # Main game scene
│   └── main.js                     # Game entry point
├── index.html                      # Main HTML file
└── package.json                    # Project configuration
```

## Customization

### Adjusting Game Physics

Edit `src/config/GameConfig.js` to modify:

- **Slingshot power**: `slingshot.powerMultiplier`
- **Gravity**: Game physics gravity setting
- **Projectile properties**: Size, mass, bounce, etc.
- **Visual settings**: Colors, sizes, effects

### Adding New Features

The modular architecture makes it easy to extend:

1. **New projectile types**: Extend the `Projectile` class
2. **Different slingshots**: Create new controller classes
3. **Additional scenes**: Add new scene classes to the game config
4. **Enhanced physics**: Modify the physics configuration

## Development

### Built With

- **Phaser.js 3.70.0**: Game framework and physics engine
- **Vanilla JavaScript**: No build process required
- **HTML5 Canvas**: Rendering and graphics

### Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Future Enhancements

The architecture supports easy addition of:

- Multiple projectile types
- Targets and scoring system
- Power-ups and special abilities
- Sound effects and music
- Particle effects
- Multiple levels
- Save/load game state
- Multiplayer support

## License

MIT License - feel free to use this code for your own projects!