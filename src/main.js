/**
 * Main entry point for the Slingshot Game
 * Initializes Phaser and starts the game
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if GameConfig is available
    if (typeof window.GameConfig === 'undefined') {
        console.error('GameConfig not found. Make sure GameConfig.js is loaded first.');
        return;
    }
    
    // Check if required classes are available
    if (typeof window.SlingshotScene === 'undefined') {
        console.error('SlingshotScene not found. Make sure SlingshotScene.js is loaded.');
        return;
    }
    
    // Configure the game
    const gameConfig = { ...window.GameConfig.game };
    gameConfig.scene = [window.SlingshotScene];
    
    // Create and start the game
    const game = new Phaser.Game(gameConfig);
    
    // Global game reference (useful for debugging)
    window.game = game;
    
    // Game initialization complete
    console.log('Slingshot Game initialized successfully!');
    console.log('Game configuration:', gameConfig);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        // Optional: Handle responsive resizing
        if (game && game.scale) {
            // game.scale.resize(window.innerWidth, window.innerHeight);
        }
    });
    
    // Error handling
    window.addEventListener('error', (event) => {
        console.error('Game error:', event.error);
    });
    
    // Development helpers (remove in production)
    if (typeof window !== 'undefined') {
        window.gameHelpers = {
            getGame: () => game,
            getScene: () => game.scene.getScene('SlingshotScene'),
            getSlingshotController: () => {
                const scene = game.scene.getScene('SlingshotScene');
                return scene ? scene.getSlingshotController() : null;
            },
            getProjectiles: () => {
                const scene = game.scene.getScene('SlingshotScene');
                return scene ? scene.getActiveProjectiles() : [];
            }
        };
        
        console.log('Game helpers available at window.gameHelpers');
    }
});