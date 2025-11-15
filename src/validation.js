/**
 * Simple validation script to check if all game components are properly defined
 * This can be run in the browser console to verify the game setup
 */

function validateGameSetup() {
    console.log('🎮 Validating Slingshot Game Setup...');
    
    const checks = [
        {
            name: 'GameConfig',
            check: () => typeof window.GameConfig !== 'undefined',
            required: true
        },
        {
            name: 'SlingshotController',
            check: () => typeof window.SlingshotController !== 'undefined',
            required: true
        },
        {
            name: 'Projectile',
            check: () => typeof window.Projectile !== 'undefined',
            required: true
        },
        {
            name: 'SlingshotScene',
            check: () => typeof window.SlingshotScene !== 'undefined',
            required: true
        },
        {
            name: 'Phaser',
            check: () => typeof Phaser !== 'undefined',
            required: true
        },
        {
            name: 'Game Instance',
            check: () => typeof window.game !== 'undefined',
            required: false
        },
        {
            name: 'Game Helpers',
            check: () => typeof window.gameHelpers !== 'undefined',
            required: false
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    checks.forEach(({ name, check, required }) => {
        try {
            const result = check();
            if (result) {
                console.log(`✅ ${name}: Available`);
                passed++;
            } else {
                console.log(`${required ? '❌' : '⚠️'} ${name}: ${required ? 'Missing' : 'Not loaded yet'}`);
                if (required) failed++;
            }
        } catch (error) {
            console.log(`❌ ${name}: Error - ${error.message}`);
            if (required) failed++;
        }
    });
    
    console.log(`\n📊 Validation Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All required components are loaded successfully!');
        return true;
    } else {
        console.log('⚠️ Some required components are missing. Check the console for errors.');
        return false;
    }
}

// Auto-run validation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(validateGameSetup, 1000); // Wait a moment for everything to load
    });
} else {
    setTimeout(validateGameSetup, 1000);
}

// Make available globally for manual testing
window.validateGameSetup = validateGameSetup;