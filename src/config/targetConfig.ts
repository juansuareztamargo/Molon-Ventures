import { DifficultySettings } from '@/game/types';

export const TARGET_CONFIG = {
  // Target size configuration
  START_RADIUS: 80,
  MIN_RADIUS: 10,

  // Timing configuration (in milliseconds)
  SHRINK_DURATION: 5000, // Total time to shrink from start to min size

  // Color transition timing thresholds (percentage of remaining time)
  COLOR_THRESHOLDS: {
    RED: 0.75, // 75%+ time remaining
    ORANGE: 0.5, // 50%-75% time remaining
    GREEN: 0.25, // 25%-50% time remaining
    PURPLE: 0, // 0%-25% time remaining
  },

  // Color values
  COLORS: {
    RED: '#e74c3c',
    ORANGE: '#f39c12',
    GREEN: '#2ecc71',
    PURPLE: '#9b59b6',
  },

  // Respawn configuration
  RESPAWN_DELAY: 1000, // Delay before respawning after reaching min size

  // Spawn position configuration (relative to game dimensions)
  SPAWN_MARGIN: 100, // Minimum distance from edges

  // Difficulty presets
  DIFFICULTY: {
    EASY: {
      startRadius: 100,
      minRadius: 20,
      shrinkDuration: 7000,
      respawnDelay: 1500,
    },
    NORMAL: {
      startRadius: 80,
      minRadius: 10,
      shrinkDuration: 5000,
      respawnDelay: 1000,
    },
    HARD: {
      startRadius: 60,
      minRadius: 8,
      shrinkDuration: 3000,
      respawnDelay: 500,
    },
    EXPERT: {
      startRadius: 40,
      minRadius: 5,
      shrinkDuration: 2000,
      respawnDelay: 300,
    },
  },
} as const;

export type TargetColor = keyof typeof TARGET_CONFIG.COLORS;
export type DifficultyLevel = keyof typeof TARGET_CONFIG.DIFFICULTY;

// Helper function to get current difficulty settings
export function getDifficultySettings(
  level: DifficultyLevel = 'NORMAL'
): DifficultySettings {
  return TARGET_CONFIG.DIFFICULTY[level];
}
