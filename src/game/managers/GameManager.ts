import { GAME_CONSTANTS } from '@/config/constants';

export class GameManager {
  private static instance: GameManager;
  private currentScore: number = 0;
  private gameState: string = GAME_CONSTANTS.STATES.MENU;

  private constructor() {}

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public getScore(): number {
    return this.currentScore;
  }

  public setScore(score: number): void {
    this.currentScore = score;
  }

  public addScore(points: number): void {
    this.currentScore += points;
  }

  public getGameState(): string {
    return this.gameState;
  }

  public setGameState(state: string): void {
    this.gameState = state;
  }

  public reset(): void {
    this.currentScore = 0;
    this.gameState = GAME_CONSTANTS.STATES.MENU;
  }
}
