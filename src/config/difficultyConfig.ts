import { DifficultyLevel } from '@/config/targetConfig';

export interface DifficultyBalanceSettings {
  difficulty: DifficultyLevel;
  // Target settings
  targetStartRadius: number;
  targetMinRadius: number;
  targetShrinkDuration: number;
  targetRespawnDelay: number;
  // Slingshot settings
  slingshotPowerMultiplier: number;
  slingshotMaxPower: number;
  // Scoring multiplier
  scoreMultiplier: number;
}

export const DIFFICULTY_BALANCE_CONFIG: Record<DifficultyLevel, DifficultyBalanceSettings> = {
  EASY: {
    difficulty: 'EASY',
    // Target: Slower, larger, more forgiving
    targetStartRadius: 100,
    targetMinRadius: 20,
    targetShrinkDuration: 7000,
    targetRespawnDelay: 1500,
    // Slingshot: More powerful, easier to hit
    slingshotPowerMultiplier: 1.2,
    slingshotMaxPower: 120,
    scoreMultiplier: 0.5,
  },
  NORMAL: {
    difficulty: 'NORMAL',
    // Target: Balanced
    targetStartRadius: 80,
    targetMinRadius: 10,
    targetShrinkDuration: 5000,
    targetRespawnDelay: 1000,
    // Slingshot: Standard power
    slingshotPowerMultiplier: 1.0,
    slingshotMaxPower: 100,
    scoreMultiplier: 1.0,
  },
  HARD: {
    difficulty: 'HARD',
    // Target: Faster, smaller, harder to hit
    targetStartRadius: 60,
    targetMinRadius: 8,
    targetShrinkDuration: 3000,
    targetRespawnDelay: 500,
    // Slingshot: Less powerful, requires precision
    slingshotPowerMultiplier: 0.8,
    slingshotMaxPower: 85,
    scoreMultiplier: 1.5,
  },
  EXPERT: {
    difficulty: 'EXPERT',
    // Target: Very fast, very small, extreme
    targetStartRadius: 40,
    targetMinRadius: 5,
    targetShrinkDuration: 2000,
    targetRespawnDelay: 300,
    // Slingshot: Significantly reduced power, precision required
    slingshotPowerMultiplier: 0.6,
    slingshotMaxPower: 70,
    scoreMultiplier: 2.0,
  },
} as const;

export function getDifficultyBalanceSettings(
  difficulty: DifficultyLevel
): DifficultyBalanceSettings {
  return DIFFICULTY_BALANCE_CONFIG[difficulty];
}
