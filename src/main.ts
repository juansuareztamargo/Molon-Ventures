import Phaser from 'phaser';
import { GameConfig } from '@/config/gameConfig';

// Initialize the game
const game = new Phaser.Game(GameConfig);

// Export the game instance for potential external access
export default game;
