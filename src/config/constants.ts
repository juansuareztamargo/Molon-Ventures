export const GAME_CONSTANTS = {
  // Game dimensions
  WIDTH: 800,
  HEIGHT: 600,

  // Colors
  COLORS: {
    PRIMARY: '#3498db',
    SECONDARY: '#2ecc71',
    DANGER: '#e74c3c',
    WARNING: '#f39c12',
    INFO: '#9b59b6',
    LIGHT: '#ecf0f1',
    DARK: '#2c3e50',
  },

  // Physics
  GRAVITY: 0,
  PLAYER_SPEED: 200,

  // Game states
  STATES: {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
  },
} as const;
