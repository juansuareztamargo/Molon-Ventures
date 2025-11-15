export interface GameObjectConfig {
  x: number;
  y: number;
  texture?: string;
  frame?: string | number;
}

export interface PlayerConfig extends GameObjectConfig {
  speed: number;
  health: number;
}

export interface EnemyConfig extends GameObjectConfig {
  health: number;
  damage: number;
  speed: number;
}

export interface GameEvent {
  type: string;
  data?: any;
}
