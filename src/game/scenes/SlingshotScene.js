/**
 * SlingshotScene - Main game scene managing the slingshot mechanic
 * Coordinates between SlingshotController and Projectile system
 */
class SlingshotScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SlingshotScene' });
        
        // Game components
        this.slingshotController = null;
        this.projectiles = [];
        
        // Configuration
        this.config = null;
    }
    
    preload() {
        // No assets needed for this implementation
        // All graphics are created programmatically
    }
    
    create() {
        // Load configuration
        this.config = window.GameConfig;
        
        // Create background elements
        this.createBackground();
        
        // Create ground
        this.createGround();
        
        // Create slingshot
        this.createSlingshot();
        
        // Setup UI
        this.createUI();
        
        // Initialize projectile management
        this.projectiles = [];
        
        console.log('SlingshotScene created successfully');
    }
    
    createBackground() {
        // Create gradient background effect
        const { width, height } = this.game.config;
        
        // Sky gradient
        const skyGradient = this.add.graphics();
        skyGradient.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x98FB98, 0x98FB98, 0.4, 0.4, 0.4, 0.4);
        skyGradient.fillRect(0, 0, width, height * 0.7);
        
        // Add some clouds for visual interest
        for (let i = 0; i < 3; i++) {
            const cloudX = 100 + i * 250;
            const cloudY = 50 + i * 30;
            this.createCloud(cloudX, cloudY);
        }
    }
    
    createCloud(x, y) {
        const cloud = this.add.graphics();
        cloud.fillStyle(0xFFFFFF, 0.8);
        
        // Create cloud shape with multiple circles
        cloud.fillCircle(x, y, 25);
        cloud.fillCircle(x + 20, y, 30);
        cloud.fillCircle(x + 40, y, 25);
        cloud.fillCircle(x + 15, y - 15, 20);
        cloud.fillCircle(x + 25, y - 15, 20);
        
        // Add subtle animation
        this.tweens.add({
            targets: cloud,
            x: 20,
            duration: 8000 + Phaser.Math.Between(0, 4000),
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }
    
    createGround() {
        const { width, height } = this.game.config;
        const groundHeight = 100;
        
        // Create ground rectangle
        const ground = this.add.rectangle(
            width / 2, height - groundHeight / 2,
            width, groundHeight,
            0x8B7355
        );
        
        // Add grass on top
        const grass = this.add.rectangle(
            width / 2, height - groundHeight,
            width, 10,
            0x228B22
        );
        
        // Set ground as static physics body for collisions
        this.physics.add.existing(ground, true);
        ground.body.setImmovable(true);
        
        // Store ground reference for collision detection
        this.ground = ground;
    }
    
    createSlingshot() {
        const { slingshot } = this.config;
        
        // Create slingshot controller
        this.slingshotController = new SlingshotController(
            this,
            slingshot.x,
            slingshot.y,
            slingshot
        );
        
        // Setup projectile launching
        this.setupProjectileLaunching();
    }
    
    setupProjectileLaunching() {
        // Listen for slingshot release
        this.input.on('pointerup', (pointer) => {
            if (this.slingshotController.getIsDragging()) {
                const launchData = this.slingshotController.endDrag();
                if (launchData) {
                    this.launchProjectile(launchData);
                }
            }
        });
    }
    
    launchProjectile(launchData) {
        const { projectile } = this.config;
        
        // Create new projectile
        const newProjectile = new Projectile(
            this,
            launchData.x,
            launchData.y,
            launchData.vx,
            launchData.vy,
            projectile
        );
        
        // Add collision with ground
        this.physics.add.collider(newProjectile.body, this.ground);
        
        // Add to active projectiles list
        this.projectiles.push(newProjectile);
        
        // Setup cleanup when projectile is destroyed
        newProjectile.body.on('destroy', () => {
            this.removeProjectile(newProjectile);
        });
        
        console.log('Projectile launched:', launchData);
    }
    
    removeProjectile(projectile) {
        const index = this.projectiles.indexOf(projectile);
        if (index > -1) {
            this.projectiles.splice(index, 1);
        }
    }
    
    createUI() {
        const { width } = this.game.config;
        
        // Title
        const title = this.add.text(width / 2, 30, 'Slingshot Game', {
            fontSize: '32px',
            color: '#333333',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Instructions
        const instructions = this.add.text(width / 2, 70, 'Click and drag the slingshot to launch projectiles!', {
            fontSize: '16px',
            color: '#555555',
            fontFamily: 'Arial, sans-serif',
            align: 'center'
        }).setOrigin(0.5);
        
        // Projectile counter
        this.projectileCountText = this.add.text(20, 20, 'Active Projectiles: 0', {
            fontSize: '14px',
            color: '#333333',
            fontFamily: 'Arial, sans-serif'
        });
    }
    
    update() {
        // Update projectile counter
        this.updateProjectileCount();
        
        // Clean up inactive projectiles
        this.cleanupProjectiles();
    }
    
    updateProjectileCount() {
        const activeCount = this.projectiles.filter(p => p.getIsActive()).length;
        this.projectileCountText.setText(`Active Projectiles: ${activeCount}`);
    }
    
    cleanupProjectiles() {
        // Remove any destroyed projectiles from the list
        this.projectiles = this.projectiles.filter(projectile => {
            return projectile.getIsActive();
        });
    }
    
    // Public methods for external access
    getSlingshotController() {
        return this.slingshotController;
    }
    
    getActiveProjectiles() {
        return this.projectiles.filter(p => p.getIsActive());
    }
    
    // Scene shutdown cleanup
    shutdown() {
        // Destroy slingshot controller
        if (this.slingshotController) {
            this.slingshotController.destroy();
        }
        
        // Destroy all projectiles
        this.projectiles.forEach(projectile => {
            projectile.destroy();
        });
        this.projectiles = [];
        
        console.log('SlingshotScene shutdown complete');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlingshotScene;
} else {
    window.SlingshotScene = SlingshotScene;
}