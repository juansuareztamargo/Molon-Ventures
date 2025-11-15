/**
 * SlingshotController - Manages slingshot graphics, state, and interaction
 * Handles input processing, physics calculations, and rendering
 */
class SlingshotController {
    constructor(scene, x, y, config) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.config = config;
        
        // State management
        this.isDragging = false;
        this.isReady = true;
        this.dragStartPos = { x: 0, y: 0 };
        this.currentDragPos = { x: 0, y: 0 };
        this.dragVector = { x: 0, y: 0 };
        
        // Visual elements
        this.leftRail = null;
        this.rightRail = null;
        this.leftBand = null;
        this.rightBand = null;
        this.carriage = null;
        
        // Trajectory preview
        this.trajectoryPoints = [];
        
        this.createGraphics();
        this.setupInput();
    }
    
    createGraphics() {
        const { width, height, railColor, bandColor, bandWidth, carriageRadius } = this.config;
        
        // Create rails (vertical posts)
        this.leftRail = this.scene.add.rectangle(
            this.x - width/2, this.y - height/2, 
            8, height, railColor
        ).setOrigin(0.5, 0);
        
        this.rightRail = this.scene.add.rectangle(
            this.x + width/2, this.y - height/2, 
            8, height, railColor
        ).setOrigin(0.5, 0);
        
        // Create bands (rubber bands)
        this.leftBand = this.scene.add.line(
            0, 0,
            this.x - width/2, this.y - height,
            this.x, this.y,
            bandColor
        ).setLineWidth(bandWidth);
        
        this.rightBand = this.scene.add.line(
            0, 0,
            this.x + width/2, this.y - height,
            this.x, this.y,
            bandColor
        ).setLineWidth(bandWidth);
        
        // Create carriage (the part you pull back)
        this.carriage = this.scene.add.circle(
            this.x, this.y, carriageRadius, 0x8B4513
        ).setStrokeStyle(2, 0x654321);
        
        // Add visual feedback
        this.carriage.setInteractive({ 
            useHandCursor: true,
            draggable: true 
        });
    }
    
    setupInput() {
        // Mouse input
        this.carriage.on('pointerdown', (pointer) => {
            this.startDrag(pointer.x, pointer.y);
        });
        
        this.scene.input.on('pointermove', (pointer) => {
            if (this.isDragging) {
                this.updateDrag(pointer.x, pointer.y);
            }
        });
        
        this.scene.input.on('pointerup', (pointer) => {
            if (this.isDragging) {
                this.endDrag();
            }
        });
        
        // Touch input support
        this.scene.input.on('gameobjectdown', (pointer, gameObject) => {
            if (gameObject === this.carriage && this.isReady) {
                this.startDrag(pointer.x, pointer.y);
            }
        });
    }
    
    startDrag(x, y) {
        if (!this.isReady) return;
        
        this.isDragging = true;
        this.dragStartPos = { x: this.x, y: this.y };
        this.currentDragPos = { x, y };
        
        // Visual feedback
        this.carriage.setFillStyle(0xA0522D);
        this.updateBands();
    }
    
    updateDrag(x, y) {
        if (!this.isDragging) return;
        
        // Calculate drag vector with constraints
        const dx = x - this.x;
        const dy = y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Clamp to max drag distance
        const maxDistance = this.config.maxDragDistance;
        if (distance > maxDistance) {
            const ratio = maxDistance / distance;
            this.currentDragPos.x = this.x + dx * ratio;
            this.currentDragPos.y = this.y + dy * ratio;
        } else {
            this.currentDragPos.x = x;
            this.currentDragPos.y = y;
        }
        
        // Calculate drag vector for physics
        this.dragVector.x = this.x - this.currentDragPos.x;
        this.dragVector.y = this.y - this.currentDragPos.y;
        
        // Update visual elements
        this.carriage.setPosition(this.currentDragPos.x, this.currentDragPos.y);
        this.updateBands();
        this.updateTrajectoryPreview();
    }
    
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Calculate launch velocity
        const velocity = this.calculateLaunchVelocity();
        
        // Reset visual state
        this.carriage.setFillStyle(0x8B4513);
        this.carriage.setPosition(this.x, this.y);
        this.updateBands();
        this.clearTrajectoryPreview();
        
        // Set cooldown
        this.setCooldown();
        
        // Return launch data for projectile creation
        return {
            x: this.x,
            y: this.y,
            vx: velocity.x,
            vy: velocity.y
        };
    }
    
    calculateLaunchVelocity() {
        const { powerMultiplier } = this.config;
        
        return {
            x: this.dragVector.x * powerMultiplier,
            y: this.dragVector.y * powerMultiplier
        };
    }
    
    updateBands() {
        const { width, height } = this.config;
        
        // Update left band
        this.leftBand.setTo(
            0, 0,
            this.x - width/2, this.y - height,
            this.currentDragPos.x, this.currentDragPos.y
        );
        
        // Update right band
        this.rightBand.setTo(
            0, 0,
            this.x + width/2, this.y - height,
            this.currentDragPos.x, this.currentDragPos.y
        );
    }
    
    updateTrajectoryPreview() {
        if (!this.config.trajectory?.enabled) return;
        
        this.clearTrajectoryPreview();
        
        const velocity = this.calculateLaunchVelocity();
        const { pointCount, pointSpacing, pointColor, pointAlpha, pointRadius } = this.config.trajectory;
        
        // Get gravity from the scene's physics config
        const gravity = this.scene.physics.world.gravity.y;
        
        for (let i = 0; i < pointCount; i++) {
            const t = i * pointSpacing / 60; // Convert to seconds (assuming 60fps)
            
            // Calculate position using physics equations
            const px = this.x + velocity.x * t;
            const py = this.y + velocity.y * t + 0.5 * gravity * t * t;
            
            const point = this.scene.add.circle(px, py, pointRadius, pointColor, pointAlpha);
            this.trajectoryPoints.push(point);
        }
    }
    
    clearTrajectoryPreview() {
        this.trajectoryPoints.forEach(point => point.destroy());
        this.trajectoryPoints = [];
    }
    
    setCooldown() {
        this.isReady = false;
        this.carriage.setTint(0x808080);
        
        this.scene.time.delayedCall(this.config.cooldownTime, () => {
            this.isReady = true;
            this.carriage.clearTint();
        });
    }
    
    // Getters for state access
    getIsDragging() { return this.isDragging; }
    getIsReady() { return this.isReady; }
    getDragVector() { return { ...this.dragVector }; }
    getCurrentPosition() { return { x: this.currentDragPos.x, y: this.currentDragPos.y }; }
    
    // Cleanup method
    destroy() {
        this.leftRail.destroy();
        this.rightRail.destroy();
        this.leftBand.destroy();
        this.rightBand.destroy();
        this.carriage.destroy();
        this.clearTrajectoryPreview();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlingshotController;
} else {
    window.SlingshotController = SlingshotController;
}