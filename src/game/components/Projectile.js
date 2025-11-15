/**
 * Projectile - Represents a projectile with physics and visual properties
 * Handles projectile creation, physics, and lifecycle
 */
class Projectile {
    constructor(scene, x, y, vx, vy, config) {
        this.scene = scene;
        this.config = config;
        
        // Create physics body as a sprite
        this.body = scene.physics.add.sprite(x, y, null);
        this.body.setCircle(config.radius);
        this.body.setTint(config.color);
        this.body.setMass(config.mass);
        this.body.setBounce(config.bounce);
        
        // Set initial velocity
        this.body.setVelocity(vx, vy);
        
        // Clamp velocity to max
        this.clampVelocity();
        
        // Trail effect
        this.trail = [];
        this.maxTrailLength = 10;
        
        // State
        this.isActive = true;
        this.lifetime = 5000; // 5 seconds lifetime
        
        // Setup collision and bounds
        this.setupPhysics();
        
        // Start cleanup timer
        this.startCleanupTimer();
    }
    
    setupPhysics() {
        // Set world bounds collision
        this.body.setCollideWorldBounds(true);
        
        // Add collision detection with ground (optional)
        // this.scene.physics.add.collider(this.body, this.groundLayer);
        
        // Velocity clamping on update
        this.scene.events.on('update', this.update, this);
    }
    
    update() {
        if (!this.isActive) return;
        
        // Clamp velocity
        this.clampVelocity();
        
        // Update trail
        this.updateTrail();
        
        // Check if projectile is out of bounds or stopped
        if (this.isOutOfBounds() || this.isStopped()) {
            this.deactivate();
        }
    }
    
    clampVelocity() {
        const { maxVelocity } = this.config;
        const velocity = this.body.body.velocity;
        
        // Calculate current speed
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        if (speed > maxVelocity) {
            const ratio = maxVelocity / speed;
            this.body.setVelocity(velocity.x * ratio, velocity.y * ratio);
        }
    }
    
    updateTrail() {
        if (!this.config.trailColor) return;
        
        // Add current position to trail
        const trailPoint = this.scene.add.circle(
            this.body.x, this.body.y, 
            this.config.radius * 0.5, 
            this.config.trailColor, 
            this.config.trailAlpha || 0.5
        );
        
        this.trail.push(trailPoint);
        
        // Remove old trail points
        if (this.trail.length > this.maxTrailLength) {
            const oldPoint = this.trail.shift();
            oldPoint.destroy();
        }
    }
    
    isOutOfBounds() {
        const { width, height } = this.scene.game.config;
        const margin = 100;
        
        return (
            this.body.x < -margin ||
            this.body.x > width + margin ||
            this.body.y < -margin ||
            this.body.y > height + margin
        );
    }
    
    isStopped() {
        const velocity = this.body.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        return speed < 10; // Nearly stopped
    }
    
    startCleanupTimer() {
        this.scene.time.delayedCall(this.lifetime, () => {
            this.deactivate();
        });
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.scene.events.off('update', this.update, this);
        
        // Fade out and destroy
        this.scene.tweens.add({
            targets: [this.body, ...this.trail],
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.destroy();
            }
        });
    }
    
    destroy() {
        // Clear trail
        this.trail.forEach(point => point.destroy());
        this.trail = [];
        
        // Destroy main body
        if (this.body) {
            this.body.destroy();
        }
        
        // Remove from scene
        this.isActive = false;
    }
    
    // Getters for state access
    getPosition() {
        return { x: this.body.x, y: this.body.y };
    }
    
    getVelocity() {
        const velocity = this.body.body.velocity;
        return { x: velocity.x, y: velocity.y };
    }
    
    getIsActive() {
        return this.isActive;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Projectile;
} else {
    window.Projectile = Projectile;
}