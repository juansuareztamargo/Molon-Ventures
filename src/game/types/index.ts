export interface Position {
  x: number;
  y: number;
}

export interface TargetState {
  radius: number;
  color: string;
  position: Position;
  isShrinking: boolean;
  timeRemaining: number;
}

export interface DifficultySettings {
  startRadius: number;
  minRadius: number;
  shrinkDuration: number;
  respawnDelay: number;
}
