import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig';
import { BootScene } from './game/scenes/BootScene';
import { MainMenuScene } from './game/scenes/MainMenuScene';
import { SlingshotScene } from './game/scenes/SlingshotScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.canvas.width,
  height: GAME_CONFIG.canvas.height,
  parent: 'game-container',
  backgroundColor: GAME_CONFIG.backgroundColor,
  scale: {
    mode: GAME_CONFIG.scaling.mode,
    autoCenter: GAME_CONFIG.scaling.autoCenter,
  },
  physics: {
    default: GAME_CONFIG.physics.default,
    arcade: GAME_CONFIG.physics.arcade,
  },
  scene: [BootScene, MainMenuScene, SlingshotScene],
};

// Create and start the game
const game = new Phaser.Game(config);

// Handle window resize for better responsiveness
window.addEventListener('resize', () => {
  game.scale.refresh();
});

// Export game instance for debugging purposes
export default game;
