/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}

export enum GameState {
  TITLE = 'TITLE',
  BOSS_INTRO = 'BOSS_INTRO',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  VICTORY = 'VICTORY',
  RANKING = 'RANKING',
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isEnemy: boolean;
  damage: number;
  type?: 'normal' | 'star' | 'laser_part' | 'homing' | 'heavy';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface ScoreRecord {
  id: string;
  name: string;
  score: number;
  difficulty: Difficulty;
  stageReached: number;
  isCleared: boolean;
  date: string;
}

export interface Boss {
  name: string;
  title: string;
  maxHp: number;
  hp: number;
  phase: number;
  maxPhases: number;
  color: string;
  introLines: string[];
}

export interface StageConfig {
  id: number;
  bossName: string;
  bossTitle: string;
  bossMaxHp: number;
  bossColor: string;
  introLines: string[];
}
