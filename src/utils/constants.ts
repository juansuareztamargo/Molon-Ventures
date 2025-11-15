export const COLORS = {
  PRIMARY: 0x4a90e2,
  SECONDARY: 0x50c878,
  DANGER: 0xe74c3c,
  WARNING: 0xf39c12,
  WHITE: 0xffffff,
  BLACK: 0x000000,
  GRAY: 0x95a5a6,
  BACKGROUND: 0x87ceeb,
  GROUND: 0x8b4513,
  TARGET: 0xff6b6b,
  PROJECTILE: 0x333333,
  SLINGSHOT: 0x654321,
} as const;

export const INPUT_THRESHOLDS = {
  DRAG_MIN_DISTANCE: 10,
  DRAG_MAX_DISTANCE: 150,
  VELOCITY_MULTIPLIER: 3,
} as const;

export const UI_STYLES = {
  FONT_FAMILY: 'Arial, sans-serif',
  TITLE_SIZE: '48px',
  SUBTITLE_SIZE: '24px',
  BODY_SIZE: '18px',
  SMALL_SIZE: '14px',
} as const;

export const GAME_SETTINGS = {
  INITIAL_PROJECTILES: 15,
  GROUND_HEIGHT: 100,
  STAGE_PROJECTILES_MULTIPLIER: 3,
} as const;

export const TARGET_COLORS = {
  RED: 0xe74c3c,
  ORANGE: 0xf39c12,
  GREEN: 0x2ecc71,
  PURPLE: 0x9b59b6,
} as const;
