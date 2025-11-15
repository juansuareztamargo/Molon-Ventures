const GameConfig = {
    // Phaser game configuration
    game: {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: 'game-container',
        backgroundColor: '#87CEEB',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 300 }, // Gravity for projectiles
                debug: false
            }
        },
        scene: []
    },
    
    // Slingshot configuration
    slingshot: {
        // Position and dimensions
        x: 150,
        y: 400,
        width: 40,
        height: 80,
        
        // Physics and behavior
        maxDragDistance: 150,
        powerMultiplier: 3.5,
        cooldownTime: 500, // milliseconds
        
        // Visual settings
        railColor: 0x8B4513,
        bandColor: 0x654321,
        bandWidth: 3,
        
        // Interaction settings
        dragThreshold: 5, // Minimum distance to start drag
        carriageRadius: 15 // Touch area for dragging
    },
    
    // Projectile configuration
    projectile: {
        radius: 8,
        color: 0xFF6B6B,
        mass: 1,
        bounce: 0.3,
        maxVelocity: 800,
        
        // Visual
        trailColor: 0xFF6B6B,
        trailAlpha: 0.5
    },
    
    // Trajectory preview
    trajectory: {
        enabled: true,
        pointCount: 15,
        pointSpacing: 20,
        pointColor: 0xFFFFFF,
        pointAlpha: 0.7,
        pointRadius: 3
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameConfig;
} else {
    window.GameConfig = GameConfig;
}