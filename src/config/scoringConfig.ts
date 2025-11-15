import { DifficultyLevel } from '@/config/targetConfig';

export type HitTier = 'MISS' | 'BASIC' | 'GOOD' | 'PERFECT';

export interface HitResult {
  tier: HitTier;
  score: number;
  color: number;
  feedback: string;
}

export interface ScoreMultiplier {
  difficulty: DifficultyLevel;
  multiplier: number;
}

export const SCORING_CONFIG = {
  // Hit tier definitions based on target state (radius percentage)
  // Perfect: when target is at its smallest (0-20% of original radius)
  // Good: medium-small (20-50% of original radius)
  // Basic: larger than good (50%+ of original radius)
  HIT_TIERS: {
    PERFECT: {
      radiusThreshold: 0.2, // 20% or less of original radius
      baseScore: 100,
      color: 0x9b59b6, // Purple
      feedback: 'PERFECT HIT!',
    },
    GOOD: {
      radiusThreshold: 0.5, // 50% or less
      baseScore: 50,
      color: 0x2ecc71, // Green
      feedback: 'GOOD HIT!',
    },
    BASIC: {
      radiusThreshold: 1.0, // Any hit larger than good
      baseScore: 25,
      color: 0xf39c12, // Orange
      feedback: 'HIT!',
    },
  },

  // Difficulty multipliers
  DIFFICULTY_MULTIPLIERS: {
    EASY: 0.5,
    NORMAL: 1.0,
    HARD: 1.5,
    EXPERT: 2.0,
  },

  // Particle effects configuration
  PARTICLES: {
    EXPLOSION: {
      color: 0xffff00,
      emitCount: 12,
      lifespan: 400,
      speed: { min: 50, max: 150 },
      scale: { start: 1, end: 0.5 },
    },
    PERFECT_BURST: {
      color: 0x9b59b6,
      emitCount: 20,
      lifespan: 600,
      speed: { min: 100, max: 200 },
      scale: { start: 1.5, end: 0 },
    },
    TRAIL: {
      color: 0xcccccc,
      alpha: 0.5,
      size: 3,
    },
  },

  // Visual feedback display duration
  FEEDBACK_DISPLAY_DURATION: 1500, // ms

  // Miss feedback display duration
  MISS_DISPLAY_DURATION: 1200, // ms

  // Reset delay after hit/miss
  RESET_DELAY: 500, // ms
} as const;

export function calculateScore(
  tier: HitTier,
  difficulty: DifficultyLevel,
  colorPhaseProgress: number
): number {
  if (tier === 'MISS') return 0;

  const tierConfig = SCORING_CONFIG.HIT_TIERS[tier];
  const difficultyMultiplier = SCORING_CONFIG.DIFFICULTY_MULTIPLIERS[difficulty];
  const phaseBonus = colorPhaseProgress; // Bonus for hitting in later phases (more difficult)

  return Math.round(tierConfig.baseScore * difficultyMultiplier * (1 + phaseBonus * 0.5));
}

export function getHitResult(
  tier: HitTier,
  difficulty: DifficultyLevel,
  colorPhaseProgress: number
): HitResult {
  if (tier === 'MISS') {
    return {
      tier: 'MISS',
      score: 0,
      color: 0x95a5a6,
      feedback: 'MISS',
    };
  }

  const tierConfig = SCORING_CONFIG.HIT_TIERS[tier];
  const score = calculateScore(tier, difficulty, colorPhaseProgress);

  return {
    tier,
    score,
    color: tierConfig.color,
    feedback: tierConfig.feedback,
  };
}
