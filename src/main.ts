import Phaser from 'phaser';
import { GameConfig } from '@/config/gameConfig';

// Initialize the game
const game = new Phaser.Game(GameConfig);

// Handle window resize for better responsiveness
window.addEventListener('resize', () => {
  game.scale.refresh();
});

// Export the game instance for potential external access
export default game;