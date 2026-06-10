/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Heart, Zap, Crosshair, HelpCircle } from 'lucide-react';
import { Difficulty, GameState, Bullet, Particle, Boss, ScoreRecord } from '../types';
import {
  playShoot,
  playHit,
  playBossHit,
  playGraze,
  playWarning,
  playDefeat,
  playVictory,
  playGameOver,
  playSelect,
  getMuteState,
  toggleMute
} from '../utils/audio';

interface GameCanvasProps {
  difficulty: Difficulty;
  playerName: string;
  onFinishGame: (finalScore: number, isCleared: boolean, stageReached: number) => void;
  onExit: () => void;
}

// Fixed internal resolution for consistent gameplay physics
const GAME_WIDTH = 480;
const GAME_HEIGHT = 640;

const STAGES = [
  {
    id: 1,
    bossName: '漆黒の騎士「デュラハン」',
    bossTitle: '第一の試練・魔王軍先鋒',
    bossMaxHp: 800,
    bossColor: '#ec4899', // Pink
    introLines: [
      '「魔王陛下に謁見するなど万死に値する！我が魔剣の錆にしてくれよう！」'
    ]
  },
  {
    id: 2,
    bossName: '邪眼の魔術師「バロル」',
    bossTitle: '第二 of 試練・魔王軍参謀',
    bossMaxHp: 1200,
    bossColor: '#a855f7', // Purple
    introLines: [
      '「私の邪眼の幾何学から逃れる術はない。絶望と共にかき消えよ！」'
    ]
  },
  {
    id: 3,
    bossName: '大魔王「魔王ルシファー」',
    bossTitle: '最終決戦・終焉をもたらす者',
    bossMaxHp: 1800,
    bossColor: '#ef4444', // Red
    introLines: [
      '「世界を無に還す。勇者の魂の輝き、尽きるまで見せてみよ！」'
    ]
  }
];

export default function GameCanvas({ difficulty, playerName, onFinishGame, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Safe timeout tracking to avoid unmounted component state updates / crashes
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const safeSetTimeout = (handler: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      handler();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  // Sound toggle
  const [muted, setMuted] = useState(getMuteState());

  // Compact sizing check for short viewports (iframe compatibility)
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleViewportCheck = () => {
      setIsCompact(window.innerHeight < 780 || window.innerWidth < 1024);
    };
    handleViewportCheck();
    window.addEventListener('resize', handleViewportCheck);
    return () => window.removeEventListener('resize', handleViewportCheck);
  }, []);

  // Game UI States
  const [gameState, setGameUiState] = useState<GameState>(GameState.BOSS_INTRO);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [dialogueIdx, setDialogueIdx] = useState(0);
  const [diagText, setDiagText] = useState('');
  
  // HUD states mirrored for React rendering
  const [playerHp, setPlayerHp] = useState(5);
  const [maxPlayerHp, setMaxPlayerHp] = useState(5);
  const [bossHp, setBossHp] = useState(0);
  const [bossMaxHp, setBossMaxHp] = useState(1);
  const [bossPhase, setBossPhase] = useState(1);
  const [bossMaxPhases, setBossMaxPhases] = useState(3);
  const [bossName, setBossName] = useState('');
  const [bossTitle, setBossTitle] = useState('');
  const [score, setScore] = useState(0);
  const [grazeCount, setGrazeCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [fps, setFps] = useState(60);

  // Ref structures to avoid closure stale state in the game loop
  const stateRef = useRef({
    gameState: GameState.BOSS_INTRO,
    currentStageIdx: 0,
    score: 0,
    grazeCount: 0,
    difficulty,
    
    // Player values
    px: GAME_WIDTH / 2,
    py: GAME_HEIGHT * 0.8,
    playerRadius: 2, // Precise small hitbox for players (adjusted to make dodging easier)
    playerVisualRadius: 18,
    playerHp: 5,
    maxPlayerHp: 5,
    invincibilityFrames: 0,
    slowMode: false,
    shootCooldown: 0,

    // Controls
    keys: {} as Record<string, boolean>,
    touchActive: false,
    touchX: GAME_WIDTH / 2,
    touchY: GAME_HEIGHT / 2,

    // Entities
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    bulletIdCounter: 0,
    particleIdCounter: 0,

    // Boss State
    bx: GAME_WIDTH / 2,
    by: -100, // Spawn offscreen and glide down
    bossRadius: 36,
    bossHp: 1000,
    bossMaxHp: 1000,
    bossPhase: 1,
    bossMaxPhases: 3,
    bossTime: 0,
    bossInvulnerable: 120, // Invulnerable during entry

    // Visual effect states
    isLoadingNextStage: false,
    screenShake: 0,
    currentWarningFlash: 0,
    warningAnimationTime: 0,
    stars: [] as { x: number; y: number; speed: number; size: number }[],
    frameCount: 0
  });

  const toggleSound = () => {
    const isNowMuted = toggleMute();
    setMuted(isNowMuted);
    playSelect();
  };

  // Setup stars background and initialize game stats based on difficulty level
  useEffect(() => {
    const state = stateRef.current;
    
    // Configure player starting hitpoints
    let hp = 5;
    if (difficulty === Difficulty.EASY) hp = 6;
    if (difficulty === Difficulty.HARD) hp = 3;
    state.playerHp = hp;
    state.maxPlayerHp = hp;
    setPlayerHp(hp);
    setMaxPlayerHp(hp);

    // Build stars list for backgrounds scroll
    const starArr = [];
    for (let i = 0; i < 40; i++) {
      starArr.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        speed: Math.random() * 2 + 0.5,
        size: Math.random() * 2 + 0.5
      });
    }
    state.stars = starArr;

    // Trigger warning on mount
    setShowWarning(true);
    playWarning();
    state.warningAnimationTime = 120; // 2 seconds

    // Set first stage values
    loadStage(0);

    // Resize canvas listeners to track layout scaling
    const handleResize = () => {
      // Scale canvas CSS accordingly if needed
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [difficulty]);

  // Load a stage definition safely
  const loadStage = (stageIdx: number) => {
    const state = stateRef.current;
    const stage = STAGES[stageIdx];
    if (!stage) return;

    state.currentStageIdx = stageIdx;
    setCurrentStageIdx(stageIdx);
    state.isLoadingNextStage = false;

    state.bossHp = stage.bossMaxHp;
    state.bossMaxHp = stage.bossMaxHp;
    state.bossMaxPhases = stageIdx === 2 ? 3 : stageIdx === 1 ? 2 : 1; // Stage 1 (1 phase), 2 (2 phases), 3 (3 phases)
    state.bossPhase = 1;
    state.bossTime = 0;
    state.bossInvulnerable = 120;
    state.bx = GAME_WIDTH / 2;
    state.by = -100; // glide in from up top

    // Clear bullets
    state.bullets = [];

    // React reflections
    setBossHp(stage.bossMaxHp);
    setBossMaxHp(stage.bossMaxHp);
    setBossPhase(1);
    setBossMaxPhases(state.bossMaxPhases);
    setBossName(stage.bossName);
    setBossTitle(stage.bossTitle);

    setGameUiState(GameState.BOSS_INTRO);
    state.gameState = GameState.BOSS_INTRO;
    setDialogueIdx(0);
    setDiagText('');
  };

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      const k = e.key.toLowerCase();
      state.keys[e.key] = true;
      state.keys[k] = true;

      // Prevent scrolling when pressing arrow keys or space inside the frame
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) {
        e.preventDefault();
      }

      if (e.key === 'Shift') {
        state.slowMode = true;
        setIsSlowMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      const k = e.key.toLowerCase();
      state.keys[e.key] = false;
      state.keys[k] = false;

      if (e.key === 'Shift') {
        state.slowMode = false;
        setIsSlowMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Dialogue Typist
  useEffect(() => {
    if (gameState !== GameState.BOSS_INTRO) return;
    const stage = STAGES[currentStageIdx];
    if (!stage) return;
    const line = stage.introLines[dialogueIdx];
    if (!line) return;

    setDiagText('');
    let currentText = '';
    let i = 0;
    const interval = setInterval(() => {
      if (i < line.length) {
        currentText += line[i];
        setDiagText(currentText);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [gameState, currentStageIdx, dialogueIdx]);

  const handleNextDialogue = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const state = stateRef.current;
    if (state.isLoadingNextStage) return;

    playSelect();
    const stage = STAGES[currentStageIdx];
    if (!stage) return;
    
    if (dialogueIdx < stage.introLines.length - 1) {
      setDialogueIdx(prev => prev + 1);
    } else {
      // Transition dialog into active play mode
      const state = stateRef.current;
      setGameUiState(GameState.PLAYING);
      state.gameState = GameState.PLAYING;
      state.bossInvulnerable = 60; // short buffer
    }
  };

  // Spawn enemy bullet patterns
  const spawnEnemyBullets = (state: typeof stateRef.current) => {
    const stage = STAGES[state.currentStageIdx];
    const diff = state.difficulty;
    const t = state.bossTime;

    // Difficulty scaling factor for barrage frequencies
    let rateMult = 1; // Normal
    let speedMult = 1;
    if (diff === Difficulty.EASY) {
      rateMult = 1.4; // 40% slower fire cycle
      speedMult = 0.72; // 30% slower bullets
    } else if (diff === Difficulty.HARD) {
      rateMult = 0.75; // 25% faster fire cycle
      speedMult = 1.25; // 25% faster bullets
    }

    const fireBullet = (x: number, y: number, vx: number, vy: number, radius: number, color: string, damage: number = 1, type: Bullet['type'] = 'normal') => {
      state.bulletIdCounter++;
      state.bullets.push({
        id: state.bulletIdCounter,
        x,
        y,
        vx,
        vy,
        radius,
        color,
        isEnemy: true,
        damage,
        type
      });
    };

    // STAGE 1: Dullahan - The Dark Knight
    if (state.currentStageIdx === 0) {
      // Pattern 1: Spiral Wave
      const cycleTime = Math.floor(60 * rateMult);
      if (t % Math.floor(10 * rateMult) === 0 && t % cycleTime < Math.floor(35 * rateMult)) {
        const numArms = 4;
        const angleOffset = (t * 0.05);
        for (let i = 0; i < numArms; i++) {
          const angle = angleOffset + (i * Math.PI * 2) / numArms;
          const speed = 2.4 * speedMult;
          fireBullet(state.bx, state.by, Math.cos(angle) * speed, Math.sin(angle) * speed, 6, '#f472b6', 1);
        }
      }

      // Pattern 2: Aimed Ring Burst
      if (t % Math.floor(90 * rateMult) === 0) {
        const dx = state.px - state.bx;
        const dy = state.py - state.by;
        const angleToPlayer = Math.atan2(dy, dx);
        const ringCount = 8;
        for (let i = 0; i < ringCount; i++) {
          const angle = angleToPlayer + ((i - (ringCount - 1) / 2) * 0.15);
          const speed = 3.2 * speedMult;
          fireBullet(state.bx, state.by, Math.cos(angle) * speed, Math.sin(angle) * speed, 8, '#ec4899', 1, 'heavy');
        }
      }
    }

    // STAGE 2: Balor - Evil-Eyed Mage
    if (state.currentStageIdx === 1) {
      if (state.bossPhase === 1) {
        // Geometric expanding stars
        if (t % Math.floor(16 * rateMult) === 0) {
          const rings = 6;
          const angleOffset = Math.sin(t * 0.02) * Math.PI;
          for (let i = 0; i < rings; i++) {
            const angle = angleOffset + (i * Math.PI * 2) / rings;
            const speed = (2.2 + Math.cos(t * 0.05) * 0.6) * speedMult;
            fireBullet(state.bx, state.by, Math.cos(angle) * speed, Math.sin(angle) * speed, 5, '#c084fc', 1, 'star');
          }
        }
        // Spray lines side to side
        if (t % Math.floor(45 * rateMult) === 0) {
          const lines = 5;
          for (let i = 0; i < lines; i++) {
            const angle = Math.PI * 0.1 + (i * Math.PI * 0.8) / (lines - 1);
            fireBullet(state.bx, state.by, Math.cos(angle) * 1.8 * speedMult, Math.sin(angle) * 1.8 * speedMult, 8, '#a855f7', 1);
          }
        }
      } else {
        // Phase 2: Beautiful Criss Cross Waves + Tracking Laser Indicator
        if (t % Math.floor(120 * rateMult) === 0) {
          // Play indicator line (handled below)
        }

        // Crisscross waves emitting from sides
        if (t % Math.floor(8 * rateMult) === 0) {
          const leftX = 40;
          const rightX = GAME_WIDTH - 40;
          const sY = state.by + 50;
          
          const angleL = Math.PI * 0.25 + Math.sin(t * 0.08) * 0.5;
          const angleR = Math.PI * 0.75 - Math.sin(t * 0.08) * 0.5;

          fireBullet(leftX, sY, Math.cos(angleL) * 2.8 * speedMult, Math.sin(angleL) * 2.8 * speedMult, 6, '#818cf8', 1);
          fireBullet(rightX, sY, Math.cos(angleR) * 2.8 * speedMult, Math.sin(angleR) * 2.8 * speedMult, 6, '#818cf8', 1);
        }

        // Concentrated aimed burst direct from the third eye
        if (t % Math.floor(40 * rateMult) === 0) {
          const dx = state.px - state.bx;
          const dy = state.py - state.by;
          const baseAngle = Math.atan2(dy, dx);
          fireBullet(state.bx, state.by, Math.cos(baseAngle) * 4.5 * speedMult, Math.sin(baseAngle) * 4.5 * speedMult, 6, '#fb7185', 1, 'homing');
          fireBullet(state.bx, state.by, Math.cos(baseAngle - 0.1) * 4.2 * speedMult, Math.sin(baseAngle - 0.1) * 4.2 * speedMult, 5, '#fb7185', 1);
          fireBullet(state.bx, state.by, Math.cos(baseAngle + 0.1) * 4.2 * speedMult, Math.sin(baseAngle + 0.1) * 4.2 * speedMult, 5, '#fb7185', 1);
        }
      }
    }

    // STAGE 3: Lucifer - The Great Demon King
    if (state.currentStageIdx === 2) {
      if (state.bossPhase === 1) {
        // Red & violet heavy spiral fan blades
        if (t % Math.floor(6 * rateMult) === 0) {
          const arms = 5;
          const rotationAngle = (t * 0.04);
          for (let i = 0; i < arms; i++) {
            const angle = rotationAngle + (i * Math.PI * 2) / arms;
            fireBullet(state.bx, state.by, Math.cos(angle) * 2.5 * speedMult, Math.sin(angle) * 2.5 * speedMult, 6, '#ef4444', 1);
            // Reverse rotation spiral nested inside
            const revAngle = -rotationAngle * 1.5 + (i * Math.PI * 2) / arms;
            fireBullet(state.bx, state.by, Math.cos(revAngle) * 2.0 * speedMult, Math.sin(revAngle) * 2.0 * speedMult, 5, '#9333ea', 1);
          }
        }
      } else if (state.bossPhase === 2) {
        // Giant Meteors that split apart
        if (t % Math.floor(80 * rateMult) === 0) {
          const randomX = Math.random() * (GAME_WIDTH - 120) + 60;
          fireBullet(randomX, state.by, 0, 2.2 * speedMult, 14, '#f59e0b', 1, 'heavy'); // Yellow giant meteor
        }

        // Circular expansion of stars
        if (t % Math.floor(35 * rateMult) === 0) {
          const starsCount = 14;
          for (let i = 0; i < starsCount; i++) {
            const angle = (i * Math.PI * 2) / starsCount + (t * 0.02);
            fireBullet(state.bx, state.by, Math.cos(angle) * 3.0 * speedMult, Math.sin(angle) * 3.0 * speedMult, 6, '#fb7185', 1, 'star');
          }
        }
      } else {
        // Final Desperation Phase - Complete Bullet Hell Showdown!
        // Radial flower blooms
        if (t % Math.floor(12 * rateMult) === 0) {
          const blooms = 12;
          const shift = Math.sin(t * 0.1) * 0.5;
          for (let i = 0; i < blooms; i++) {
            const angle = (i * Math.PI * 2) / blooms + shift;
            fireBullet(state.bx, state.by, Math.cos(angle) * 2.6 * speedMult, Math.sin(angle) * 2.6 * speedMult, 5, '#ec4899', 1);
          }
        }

        // Slow tracking bullet curtain from ceiling
        if (t % Math.floor(18 * rateMult) === 0) {
          const gridCount = 6;
          for (let i = 0; i < gridCount; i++) {
            const x = (i * GAME_WIDTH) / (gridCount - 1) + Math.sin(t * 0.05) * 20;
            fireBullet(x, 40, 0, 1.4 * speedMult, 7, '#ef4444', 1);
          }
        }

        // Rotating ring gates centered at player coordinates but spawning relative to boss
        if (t % Math.floor(65 * rateMult) === 0) {
          const dx = state.px - state.bx;
          const dy = state.py - state.by;
          const angleToP = Math.atan2(dy, dx);
          
          const ringCount = 10;
          for (let i = 0; i < ringCount; i++) {
            const angle = angleToP + ((i - (ringCount - 1)/2) * 0.12);
            fireBullet(state.bx, state.by, Math.cos(angle) * 3.8 * speedMult, Math.sin(angle) * 3.8 * speedMult, 5, '#e11d48', 1);
          }
        }
      }
    }
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameTimes: number[] = [];

    const coreLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(coreLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(coreLoop);
        return;
      }

      const state = stateRef.current;
      const now = performance.now();
      
      // Calculate FPS
      const delta = now - lastTime;
      lastTime = now;
      frameTimes.push(delta);
      if (frameTimes.length > 30) {
        frameTimes.shift();
      }
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      setFps(Math.round(1000 / avgFrameTime));

      // ----------------------------------------------------
      // GAME STATUS: UPDATE CALCULATIONS (ONLY IF ACTIVE)
      // ----------------------------------------------------
      if (state.gameState === GameState.PLAYING) {
        state.frameCount++;
        state.bossTime++;

        // Decrease invincibility countdowns
        if (state.invincibilityFrames > 0) {
          state.invincibilityFrames--;
        }

        // Screen Shake Decay
        if (state.screenShake > 0) {
          state.screenShake -= 0.5;
        }

        // Boss Spawn / Entry movement glide down
        if (state.by < 150) {
          state.by += (150 - state.by) * 0.05;
        }

        // Invulnerable period decay
        if (state.bossInvulnerable > 0) {
          state.bossInvulnerable--;
        }

        // Player Firing logic (Fire straight up continuous)
        if (state.shootCooldown > 0) {
          state.shootCooldown--;
        }

        if (state.shootCooldown <= 0) {
          // Play synth bullet audio on fire
          playShoot();
          
          // Spawn bullets based on focus speed mode (standard fire vs compact fire)
          state.bulletIdCounter++;
          const bulletDmg = state.slowMode ? 4 : 5; // concentrated slightly lower per bullet but closer together
          
          if (state.slowMode) {
            // Triple concentrated vertical stream
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px - 6,
              y: state.py - 12,
              vx: 0,
              vy: -14,
              radius: 4,
              color: '#38bdf8',
              isEnemy: false,
              damage: bulletDmg
            });
            state.bulletIdCounter++;
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px,
              y: state.py - 16,
              vx: 0,
              vy: -15,
              radius: 5,
              color: '#60a5fa',
              isEnemy: false,
              damage: bulletDmg + 2
            });
            state.bulletIdCounter++;
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px + 6,
              y: state.py - 12,
              vx: 0,
              vy: -14,
              radius: 4,
              color: '#38bdf8',
              isEnemy: false,
              damage: bulletDmg
            });
          } else {
            // Wide fan stream of bullets
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px - 14,
              y: state.py - 10,
              vx: -1.5,
              vy: -12,
              radius: 4,
              color: '#60a5fa',
              isEnemy: false,
              damage: bulletDmg
            });
            state.bulletIdCounter++;
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px,
              y: state.py - 16,
              vx: 0,
              vy: -13,
              radius: 5,
              color: '#60a5fa',
              isEnemy: false,
              damage: bulletDmg + 3
            });
            state.bulletIdCounter++;
            state.bullets.push({
              id: state.bulletIdCounter,
              x: state.px + 14,
              y: state.py - 10,
              vx: 1.5,
              vy: -12,
              radius: 4,
              color: '#60a5fa',
              isEnemy: false,
              damage: bulletDmg
            });
          }
          state.shootCooldown = 5; // High speed firing sequence (every 5 frames, i.e. 12 shots per second)
        }

        // Apply Player Keyboard Movement Physics
        let speed = state.slowMode ? 2.2 : 5.0;
        let dx = 0;
        let dy = 0;

        if (state.keys['ArrowUp'] || state.keys['w'] || state.keys['W']) dy -= 1;
        if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) dy += 1;
        if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) dx -= 1;
        if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) dx += 1;

        // Diagonal unit vector normalization
        if (dx !== 0 && dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx /= length;
          dy /= length;
        }

        state.px += dx * speed;
        state.py += dy * speed;

        // Apply Mouse/Touch control fallback
        if (state.touchActive) {
          // Direct interpolative tracking so finger position aligns with player but feels organic
          const targetX = state.touchX;
          const targetY = state.touchY - 30; // offset slightly above touch so player's fingers don't block the screen!
          // Glide player towards the destination coord
          state.px += (targetX - state.px) * 0.22;
          state.py += (targetY - state.py) * 0.22;
        }

        // Border enforcement
        state.px = Math.max(state.playerVisualRadius, Math.min(GAME_WIDTH - state.playerVisualRadius, state.px));
        state.py = Math.max(state.playerVisualRadius, Math.min(GAME_HEIGHT - state.playerVisualRadius, state.py));

        // Background scrolling starfield update
        state.stars.forEach((star) => {
          star.y += star.speed;
          if (star.y > GAME_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * GAME_WIDTH;
          }
        });

        // Spawn Boss bullets based on level configurations
        spawnEnemyBullets(state);

        // Update active bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          if (!b) continue;
          if ((b as any).pendingDelete) {
            state.bullets.splice(i, 1);
            continue;
          }
          b.x += b.vx;
          b.y += b.vy;

          // Garbage collect offscreen bullets
          const margin = 30;
          if (b.x < -margin || b.x > GAME_WIDTH + margin || b.y < -margin || b.y > GAME_HEIGHT + margin) {
            state.bullets.splice(i, 1);
            continue;
          }

          // Collisions - Enemy bullet vs Player Hitbox (precise)
          if (b.isEnemy) {
            const dist = Math.hypot(b.x - state.px, b.y - state.py);

            // GRAZE DETECTION: If player hovers close to bullet border but doesn't get hit
            // Graze zone: player_hitbox + 16px buffer
            const grazeLimit = state.playerRadius + 14;
            if (dist <= grazeLimit && dist > state.playerRadius) {
              const bExtended = b as any;
              if (!bExtended.hasGrazeTriggered) {
                bExtended.hasGrazeTriggered = true;
                state.grazeCount++;
                state.score += 250; // High reward for high risk behavior!
                playGraze();

                // Spawn short shining graze gold sparks
                for (let k = 0; k < 3; k++) {
                  state.particleIdCounter++;
                  state.particles.push({
                    id: state.particleIdCounter,
                    x: state.px + (Math.random() * 20 - 10),
                    y: state.py + (Math.random() * 20 - 10),
                    vx: Math.random() * 2 - 1,
                    vy: Math.random() * 2 - 1,
                    radius: 2,
                    color: '#facc15', // Bright Yellow sparks
                    alpha: 1,
                    decay: 0.04
                  });
                }
              }
            }

            // HIT DETECTION
            if (dist <= state.playerRadius + b.radius) {
              // Delete bullet instantly
              state.bullets.splice(i, 1);

              if (state.invincibilityFrames <= 0) {
                state.playerHp = Math.max(0, state.playerHp - b.damage);
                state.invincibilityFrames = 90; // 1.5 seconds of protection frames
                state.screenShake = 15;
                playHit();

                // Clear ongoing bullet field to give players breathing room
                state.bullets = state.bullets.filter((bl) => {
                  if (bl.isEnemy) {
                    // Turn existing enemy bullets into clean sparkling points of green dust
                    state.particleIdCounter++;
                    state.particles.push({
                      id: state.particleIdCounter,
                      x: bl.x,
                      y: bl.y,
                      vx: Math.random() * 1.5 - 0.75,
                      vy: Math.random() * 1.5 - 0.75,
                      radius: 2,
                      color: '#4ade80',
                      alpha: 0.8,
                      decay: 0.05
                    });
                    return false;
                  }
                  return true;
                });

                // Spurt ring of sparks from player
                for (let k = 0; k < 25; k++) {
                  const angle = Math.random() * Math.PI * 2;
                  const force = Math.random() * 4 + 1;
                  state.particleIdCounter++;
                  state.particles.push({
                    id: state.particleIdCounter,
                    x: state.px,
                    y: state.py,
                    vx: Math.cos(angle) * force,
                    vy: Math.sin(angle) * force,
                    radius: 3,
                    color: '#ef4444',
                    alpha: 1,
                    decay: 0.03
                  });
                }

                // Check Game Over Condition
                if (state.playerHp <= 0) {
                  playGameOver();
                  setGameUiState(GameState.GAMEOVER);
                  state.gameState = GameState.GAMEOVER;
                  
                  // Submit metrics to callback
                  const stageNum = STAGES[state.currentStageIdx].id;
                  safeSetTimeout(() => {
                    onFinishGame(state.score, false, stageNum);
                  }, 1800);
                  break;
                }
              }
              continue;
            }
          } else {
            // Collisions - Player bullet vs Boss
            const bossWidthRadius = state.bossRadius + 28; // 魔王の絵全体（翼や肩当てを含む）を包む広い当たり判定に拡張
            const distToBoss = Math.hypot(b.x - state.bx, b.y - state.by);

            if (distToBoss <= bossWidthRadius && b.y < state.by + state.bossRadius + 20) {
              // Delete hero bullet
              state.bullets.splice(i, 1);

              if (state.bossInvulnerable <= 0) {
                // Damage boss
                state.bossHp = Math.max(0, state.bossHp - b.damage);
                state.score += 10;

                // Play metallic tick sound periodically
                if (state.frameCount % 4 === 0) {
                  playBossHit();
                }

                // Spawn dark shield collision particles
                state.particleIdCounter++;
                state.particles.push({
                  id: state.particleIdCounter,
                  x: b.x,
                  y: b.y,
                  vx: Math.random() * 4 - 2,
                  vy: -Math.random() * 2,
                  radius: Math.random() * 2 + 1,
                  color: STAGES[state.currentStageIdx].bossColor,
                  alpha: 0.9,
                  decay: 0.06
                });

                // Screen slight shake on impact if hard damage
                if (b.damage > 5) {
                  state.screenShake = Math.max(state.screenShake, 2);
                }

                // ----------------------------------------------------
                // BOSS HP REACHED ZERO (PHASE CLEAR OR DEFEAT)
                // ----------------------------------------------------
                if (state.bossHp <= 0) {
                  state.screenShake = 22;
                  
                  // Phase progression vs total stage defeat
                  if (state.bossPhase < state.bossMaxPhases) {
                    playDefeat();
                    
                    // Increment phase
                    state.bossPhase++;
                    
                    // Healing flare effect for boss transition
                    const stage = STAGES[state.currentStageIdx];
                    state.bossHp = stage.bossMaxHp;
                    state.bossInvulnerable = 150; // Invincible phase shield transition for 2.5s
                    state.bossTime = 0; // reset phase clock

                    // Convert all existing enemy bullets on stage to score points
                    state.bullets.forEach((bl) => {
                      if (bl.isEnemy) {
                        state.score += 50;
                        state.particleIdCounter++;
                        state.particles.push({
                          id: state.particleIdCounter,
                          x: bl.x,
                          y: bl.y,
                          vx: 0,
                          vy: -1,
                          radius: 3,
                          color: '#facc15', // Gold
                          alpha: 1,
                          decay: 0.04
                        });
                        (bl as any).pendingDelete = true;
                      }
                    });

                    // Giant circular burst particle cascade
                    for (let pCount = 0; pCount < 60; pCount++) {
                      const angle = (pCount * Math.PI * 2) / 60;
                      const fSpeed = Math.random() * 4 + 3;
                      state.particleIdCounter++;
                      state.particles.push({
                        id: state.particleIdCounter,
                        x: state.bx,
                        y: state.by,
                        vx: Math.cos(angle) * fSpeed,
                        vy: Math.sin(angle) * fSpeed,
                        radius: 4,
                        color: stage.bossColor,
                        alpha: 1,
                        decay: 0.02
                      });
                    }
                  } else {
                    // COMPLETE STAGE CLEAR!
                    playDefeat();

                    // Gold stars burst
                    for (let pCount = 0; pCount < 100; pCount++) {
                      const angle = Math.random() * Math.PI * 2;
                      const fSpeed = Math.random() * 6 + 2;
                      state.particleIdCounter++;
                      state.particles.push({
                        id: state.particleIdCounter,
                        x: state.bx,
                        y: state.by,
                        vx: Math.cos(angle) * fSpeed,
                        vy: Math.sin(angle) * fSpeed,
                        radius: Math.random() * 4 + 2,
                        color: STAGES[state.currentStageIdx].bossColor,
                        alpha: 1,
                        decay: 0.015
                      });
                    }

                    // Score calculation with difficulty factor
                    let diffMult = 1.0;
                    if (state.difficulty === Difficulty.EASY) diffMult = 0.5;
                    if (state.difficulty === Difficulty.HARD) diffMult = 1.8;

                    const clearBonus = 30000 * (state.currentStageIdx + 1) * diffMult;
                    const hpBonus = state.playerHp * 5000 * diffMult;
                    const stageScoreGrant = Math.round(clearBonus + hpBonus);
                    
                    state.score += stageScoreGrant;
                    setScore(state.score);

                    // Check if there are more stages remaining
                    if (state.currentStageIdx < STAGES.length - 1) {
                      // Transition to next stage sequence
                      const nextStageIdx = state.currentStageIdx + 1;
                      state.isLoadingNextStage = true;
                      setGameUiState(GameState.BOSS_INTRO);
                      state.gameState = GameState.BOSS_INTRO;
                      
                      safeSetTimeout(() => {
                        loadStage(nextStageIdx);
                      }, 1200);
                    } else {
                      // FINAL CONFLAGRATION WON! COMPLETE STORY VICTORY
                      playVictory();
                      setGameUiState(GameState.VICTORY);
                      state.gameState = GameState.VICTORY;

                      safeSetTimeout(() => {
                        onFinishGame(state.score, true, 3);
                      }, 3000);
                    }
                  }
                }
              }
            }
          }
        }

        // Split star meteor bursts in Stage 3 Phase 2 (satisfying game mechanic)
        state.bullets.forEach((b) => {
          if (b.isEnemy && b.type === 'heavy' && b.y > GAME_HEIGHT * 0.4 && state.currentStageIdx === 2 && state.bossPhase === 2) {
            const bExtended = b as any;
            if (!bExtended.hasSplit) {
              bExtended.hasSplit = true;
              
              // Remove meteor soon, burst into circular fragments
              b.vx = 0; b.vy = 0; // stop moving
              safeSetTimeout(() => {
                const idx = state.bullets.indexOf(b);
                if (idx !== -1) {
                  state.bullets.splice(idx, 1);
                  playHit();
                  
                  // Expand radial shards
                  const shardCount = 12;
                  for (let sc = 0; sc < shardCount; sc++) {
                    const angle = (sc * Math.PI * 2) / shardCount;
                    state.bulletIdCounter++;
                    state.bullets.push({
                      id: state.bulletIdCounter,
                      x: b.x,
                      y: b.y,
                      vx: Math.cos(angle) * 3.4,
                      vy: Math.sin(angle) * 3.4,
                      radius: 5,
                      color: '#f59e0b',
                      isEnemy: true,
                      damage: 1
                    });
                  }
                }
              }, 120);
            }
          }
        });

        // Decay particles list
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            state.particles.splice(i, 1);
          }
        }
      }

      // ----------------------------------------------------
      // GRAPHICS RENDER ENGINE (CANVAS CONTEXT)
      // ----------------------------------------------------
      ctx.save();
      
      // Screen shake modifier
      if (state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake;
        const shakeY = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // Draw starry galaxy dark sky background
      ctx.fillStyle = '#020617'; // slate-950 deep space void
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw scrolling sky points
      ctx.fillStyle = '#fef08a'; // faint glowing amber stars
      state.stars.forEach((star) => {
        ctx.globalAlpha = 0.3 + (star.speed / 2.5) * 0.5;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1.0;

      // Draw faint guidelines or border boundaries
      ctx.strokeStyle = '#f59e0b1e'; // translucent gold mesh border lines
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, GAME_WIDTH - 20, GAME_HEIGHT - 20);

      // Render Active Particles
      state.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Render Active Bullets
      state.bullets.forEach((b) => {
        ctx.save();
        ctx.fillStyle = b.color;
        
        if (!b.isEnemy) {
          // Hero swords / arrows: elongated sleek glowing capsules
          ctx.shadowBlur = 8;
          ctx.shadowColor = b.color;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - b.radius);
          ctx.lineTo(b.x - b.radius / 1.5, b.y + b.radius);
          ctx.lineTo(b.x + b.radius / 1.5, b.y + b.radius);
          ctx.closePath();
          ctx.fill();
        } else {
          // Enemy bullets: render beautiful custom items
          ctx.shadowBlur = b.type === 'heavy' ? 12 : 5;
          ctx.shadowColor = b.color;
          
          if (b.type === 'star') {
            // Draw a cute sharp cross/star bullet
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
              const angle = (i * Math.PI) / 2;
              ctx.lineTo(b.x + Math.cos(angle) * b.radius * 1.8, b.y + Math.sin(angle) * b.radius * 1.8);
              ctx.lineTo(b.x + Math.cos(angle + Math.PI/4) * b.radius * 0.6, b.y + Math.sin(angle + Math.PI/4) * b.radius * 0.6);
            }
            ctx.closePath();
            ctx.fill();
          } else if (b.type === 'heavy') {
            // Giant glowing core spheres with white inner cores for extreme danger!
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Standard rounded spheres with nice radial centers
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });

      // Render boss if present in this stage
      if (state.gameState === GameState.PLAYING || state.gameState === GameState.BOSS_INTRO) {
        const stage = STAGES[state.currentStageIdx];
        if (stage) {
          ctx.save();
          // Pulsing scale factor based on stage frame counting
          const pulse = Math.sin(Date.now() * 0.003) * 0.07 + 1.0;
          
          // --- DEMON LORD'S BEAUTIFUL COHESIVE ARTWORK (魔王の絵) ---
          
          // 1. Huge Menacing Demon Wings (左右に広がる巨大な悪魔の翼)
          const wingColor = stage.bossColor;
          ctx.fillStyle = wingColor + '1e';
          ctx.strokeStyle = wingColor;
          ctx.lineWidth = 3.5;
          
          // Left Wing
          ctx.beginPath();
          ctx.moveTo(state.bx - 15, state.by + 10);
          ctx.bezierCurveTo(
            state.bx - 145 * pulse, state.by - 75 * pulse,
            state.bx - 185 * pulse, state.by + 45 * pulse,
            state.bx - 30, state.by + 52
          );
          ctx.lineTo(state.bx - 15, state.by + 10);
          ctx.fill();
          ctx.stroke();

          // Right Wing
          ctx.beginPath();
          ctx.moveTo(state.bx + 15, state.by + 10);
          ctx.bezierCurveTo(
            state.bx + 145 * pulse, state.by - 75 * pulse,
            state.bx + 185 * pulse, state.by + 45 * pulse,
            state.bx + 30, state.by + 52
          );
          ctx.lineTo(state.bx + 15, state.by + 10);
          ctx.fill();
          ctx.stroke();

          // 2. Rising Evil Aura (ダークな揺らめくオーラ)
          const auraGrad = ctx.createRadialGradient(state.bx, state.by, state.bossRadius * 0.4, state.bx, state.by, state.bossRadius * 1.9 * pulse);
          auraGrad.addColorStop(0, stage.bossColor + '60');
          auraGrad.addColorStop(0.5, stage.bossColor + '20');
          auraGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(state.bx, state.by, state.bossRadius * 1.9 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // 3. Dark Cloak of Shadow (暗黒のマント、内側は不気味なトーン)
          ctx.fillStyle = '#090d16'; // Deep space black
          ctx.strokeStyle = stage.bossColor + '99';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(state.bx - 24, state.by - 5);
          ctx.bezierCurveTo(state.bx - 46, state.by + 42, state.bx - 36, state.by + 70, state.bx - 8, state.by + 60);
          ctx.lineTo(state.bx + 8, state.by + 60);
          ctx.bezierCurveTo(state.bx + 36, state.by + 70, state.bx + 46, state.by + 42, state.bx + 24, state.by - 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 4. Dark Pauldrons/Armors with Spikes (肩当てと棘のパーツ)
          ctx.fillStyle = '#1e293b'; 
          ctx.strokeStyle = stage.bossColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Left Spike
          ctx.moveTo(state.bx - 18, state.by - 12);
          ctx.lineTo(state.bx - 36, state.by - 28);
          ctx.lineTo(state.bx - 20, state.by + 6);
          // Right Spike
          ctx.moveTo(state.bx + 18, state.by - 12);
          ctx.lineTo(state.bx + 36, state.by - 28);
          ctx.lineTo(state.bx + 20, state.by + 6);
          ctx.stroke();
          ctx.fill();

          // 5. Demonic Horns (赤黒く燃え盛る巨大な角)
          ctx.fillStyle = '#7f1d1d'; // Crimson horn back
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          // Left Horn
          ctx.beginPath();
          ctx.moveTo(state.bx - 10, state.by - 18);
          ctx.quadraticCurveTo(state.bx - 34, state.by - 44, state.bx - 30, state.by - 54);
          ctx.quadraticCurveTo(state.bx - 18, state.by - 32, state.bx - 4, state.by - 22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Right Horn
          ctx.beginPath();
          ctx.moveTo(state.bx + 10, state.by - 18);
          ctx.quadraticCurveTo(state.bx + 34, state.by - 44, state.bx + 30, state.by - 54);
          ctx.quadraticCurveTo(state.bx + 18, state.by - 32, state.bx + 4, state.by - 22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 6. Demonic Skull Face/Mask
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = stage.bossColor;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(state.bx, state.by - 9, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 7. Golden Sovereign Crown (威を放つ黄金の王冠)
          ctx.fillStyle = '#fbbf24'; // Bright gold
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(state.bx - 12, state.by - 24);
          ctx.lineTo(state.bx - 15, state.by - 34);
          ctx.lineTo(state.bx - 6, state.by - 28);
          ctx.lineTo(state.bx, state.by - 38); // Centered crown tip
          ctx.lineTo(state.bx + 6, state.by - 28);
          ctx.lineTo(state.bx + 15, state.by - 34);
          ctx.lineTo(state.bx + 12, state.by - 24);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Crown jewel (王冠には妖しい魔法を放つアメジストの輝き)
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(state.bx, state.by - 28, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // 8. Sinister Twin Crimson Eyes (邪悪に輝く眼光)
          ctx.fillStyle = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ef4444';
          ctx.beginPath();
          ctx.arc(state.bx - 6, state.by - 11, 3, 0, Math.PI * 2);
          ctx.arc(state.bx + 6, state.by - 11, 3, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowBlur = 0; // Reset shadow
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(state.bx - 7, state.by - 12, 1.5, 1.5);
          ctx.fillRect(state.bx + 5, state.by - 12, 1.5, 1.5);

          // Dark shader overall layer (立体感を追加)
          const shadowGrad = ctx.createRadialGradient(state.bx, state.by, 5, state.bx, state.by, state.bossRadius + 15);
          shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
          shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
          shadowGrad.addColorStop(1, stage.bossColor + '30');
          ctx.fillStyle = shadowGrad;
          ctx.beginPath();
          ctx.arc(state.bx, state.by, state.bossRadius + 15, 0, Math.PI * 2);
          ctx.fill();

          // Invulnerable / Boss transition barrier
          if (state.bossInvulnerable > 0) {
            // Flicker high-tech barrier
            if (state.frameCount % 6 < 3) {
              ctx.globalAlpha = 0.45;
            }
            ctx.strokeStyle = '#ffffffbb';
            ctx.shadowBlur = 12;
            ctx.shadowColor = stage.bossColor;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(state.bx, state.by, state.bossRadius * 1.45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          ctx.restore();
        }
      }

      // Render Player (Hero, 勇者)
      ctx.save();
      
      // If invincible, flash player visually
      if (state.invincibilityFrames > 0 && state.frameCount % 8 < 4) {
        ctx.globalAlpha = 0.25;
      }

      // --- HERO (BRAVE WARRIOR) ARTWORK (勇者の絵) ---
      
      // 1. Sleek Flowing Royal Cape (背後になびく鮮やかな青マント)
      ctx.fillStyle = '#1d4ed8'; // Royal dark blue
      ctx.strokeStyle = '#60a5fa'; // Highlight border
      ctx.lineWidth = 1;
      ctx.beginPath();
      const capeSwing = Math.sin(state.frameCount * 0.1) * 3.5;
      // Left side back-cape
      ctx.moveTo(state.px - 6, state.py + 4);
      ctx.bezierCurveTo(state.px - 17, state.py + 11 + capeSwing, state.px - 15, state.py + 25, state.px - 3, state.py + 19);
      // Right side back-cape
      ctx.moveTo(state.px + 6, state.py + 4);
      ctx.bezierCurveTo(state.px + 17, state.py + 11 - capeSwing, state.px + 15, state.py + 25, state.px + 3, state.py + 19);
      ctx.fill();
      ctx.stroke();

      // 2. Silver Knight Armour (戦意に満ちた白銀の胸当てとゴールドの装飾)
      ctx.fillStyle = '#f1f5f9'; // Silver
      ctx.strokeStyle = '#f59e0b'; // Gold trim
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(state.px - 8, state.py + 5);
      ctx.lineTo(state.px + 8, state.py + 5);
      ctx.lineTo(state.px + 5, state.py + 15);
      ctx.lineTo(state.px - 5, state.py + 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3. Spiky Golden Hair (勇烈に輝く金髪)
      ctx.fillStyle = '#fbbf24'; // Golden hair
      ctx.beginPath();
      ctx.moveTo(state.px - 7, state.py - 6);
      ctx.lineTo(state.px - 11, state.py - 12); // Spikey hair left
      ctx.lineTo(state.px - 4, state.py - 9);
      ctx.lineTo(state.px, state.py - 15); // Top blade spike
      ctx.lineTo(state.px + 4, state.py - 9);
      ctx.lineTo(state.px + 11, state.py - 12); // Spikey hair right
      ctx.lineTo(state.px + 7, state.py - 6);
      ctx.closePath();
      ctx.fill();

      // 4. Face (勇者の素顔)
      ctx.fillStyle = '#ffedd5'; // Skin color
      ctx.beginPath();
      ctx.arc(state.px, state.py - 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // Energetic Brave Blue Eyes
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(state.px - 3, state.py - 5, 1.5, 2);
      ctx.fillRect(state.px + 1.5, state.py - 5, 1.5, 2);

      // 5. Holding Sacred Laser Sword in Right Hand (光剣を常に右手に引っ提げている)
      ctx.save();
      ctx.translate(state.px + 11, state.py + 3);
      ctx.rotate(-Math.PI / 4 + Math.sin(state.frameCount * 0.06) * 0.1);
      
      // Glowing Sacred Blade
      const bladeGrad = ctx.createLinearGradient(0, 0, 0, -22);
      bladeGrad.addColorStop(0, '#38bdf8');
      bladeGrad.addColorStop(0.7, '#60a5fa');
      bladeGrad.addColorStop(1, '#ffffff');
      ctx.strokeStyle = bladeGrad;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 9;
      ctx.shadowColor = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -22);
      ctx.stroke();
      
      // Hilt (剣の柄)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 4);
      ctx.stroke();
      ctx.restore();

      // 6. GLOWING HEAVENLY CORE INDICATOR (勇者の真ん中にある、絶対的な中心核・当たり判定インジケータ)
      // This translucent crimson/white orb is ALWAYS visible, representing the precise hitbox center.
      const crystalGrad = ctx.createRadialGradient(state.px, state.py, 1, state.px, state.py, 6.5);
      crystalGrad.addColorStop(0, '#ffffff'); // pure white hot core
      crystalGrad.addColorStop(0.4, '#ef4444'); // glowing red crystal boundaries
      crystalGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = crystalGrad;
      ctx.beginPath();
      ctx.arc(state.px, state.py, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Precise center dot matching player hit boundary
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(state.px, state.py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // In SLOW MODE, project further precision targeting grids
      if (state.slowMode) {
        ctx.strokeStyle = '#ef4444cc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(state.px, state.py, state.playerRadius + 12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(state.px, state.py, state.playerRadius + 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      ctx.restore(); // Restore screen shake

      // Sync stateRef values to React UI state gracefully at the end of the frame
      // This decouples physics collision and high frequency updates from the React rendering scheduler
      if (state.frameCount % 2 === 0) {
        setScore(state.score);
        setPlayerHp(state.playerHp);
        setGrazeCount(state.grazeCount);
        setBossHp(state.bossHp);
        setBossPhase(state.bossPhase);
      }

      animId = requestAnimationFrame(coreLoop);
    };

    animId = requestAnimationFrame(coreLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gameState, currentStageIdx]);

  return (
    <div className={`flex flex-col xl:flex-row items-center xl:items-stretch justify-center bg-slate-950 rounded-2xl border-4 border-amber-950/70 shadow-2xl relative w-full max-w-5xl mx-auto overflow-hidden transition-all duration-300 ${
      isCompact ? 'p-2 sm:p-3 gap-3' : 'p-3 sm:p-5 gap-6'
    }`}>
      
      {/* Cinematic Siren Frame Flash */}
      <AnimatePresence>
        {gameState === GameState.PLAYING && showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8 }}
            onAnimationComplete={() => setShowWarning(false)}
            className="absolute inset-0 bg-red-600/30 pointer-events-none z-10"
          />
        )}
      </AnimatePresence>

      {/* GAME ZONE */}
      <div 
        ref={containerRef}
        className="flex-1 max-w-[480px] w-full mx-auto flex flex-col items-center justify-center bg-slate-900 border border-amber-500/25 rounded-xl shadow-lg relative p-0 overflow-hidden select-none"
        style={{
          maxHeight: isCompact ? 'min(640px, calc(100vh - 120px))' : '640px',
          aspectRatio: '3/4'
        }}
      >
        {/* GAME CANVAS */}
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="max-w-full max-h-full w-auto h-auto aspect-[3/4] block cursor-crosshair bg-slate-950"
          onTouchStart={(e) => {
            const state = stateRef.current;
            if (state.gameState !== GameState.PLAYING) return;
            state.touchActive = true;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect && e.touches[0]) {
              const xRatio = GAME_WIDTH / rect.width;
              const yRatio = GAME_HEIGHT / rect.height;
              state.touchX = (e.touches[0].clientX - rect.left) * xRatio;
              state.touchY = (e.touches[0].clientY - rect.top) * yRatio;
            }
          }}
          onTouchMove={(e) => {
            const state = stateRef.current;
            if (state.gameState !== GameState.PLAYING) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect && e.touches[0]) {
              const xRatio = GAME_WIDTH / rect.width;
              const yRatio = GAME_HEIGHT / rect.height;
              state.touchX = (e.touches[0].clientX - rect.left) * xRatio;
              state.touchY = (e.touches[0].clientY - rect.top) * yRatio;
            }
          }}
          onTouchEnd={() => {
            stateRef.current.touchActive = false;
          }}
          onMouseDown={(e) => {
            const state = stateRef.current;
            if (state.gameState !== GameState.PLAYING) return;
            state.touchActive = true;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const xRatio = GAME_WIDTH / rect.width;
              const yRatio = GAME_HEIGHT / rect.height;
              state.touchX = (e.clientX - rect.left) * xRatio;
              state.touchY = (e.clientY - rect.top) * yRatio;
            }
          }}
          onMouseMove={(e) => {
            const state = stateRef.current;
            if (state.gameState !== GameState.PLAYING) return;
            if (state.touchActive) {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                const xRatio = GAME_WIDTH / rect.width;
                const yRatio = GAME_HEIGHT / rect.height;
                state.touchX = (e.clientX - rect.left) * xRatio;
                state.touchY = (e.clientY - rect.top) * yRatio;
              }
            }
          }}
          onMouseUp={() => {
            stateRef.current.touchActive = false;
          }}
          onMouseLeave={() => {
            stateRef.current.touchActive = false;
          }}
        />

        {/* BOSS SPARK WARNING OVERLAY */}
        {gameState === GameState.PLAYING && showWarning && (
          <div className="absolute top-[25%] left-0 right-0 py-4 bg-red-950/90 border-y-2 border-red-500 z-10 text-center pointer-events-none select-none tracking-widest animate-pulse shadow-2xl">
            <h3 className="text-red-500 font-extrabold text-2xl font-mono uppercase tracking-[0.2em] mb-1">
              ⚠️ WARNING
            </h3>
            <p className="text-red-300 text-xs font-semibold">
              強力な魔力を帯びた魔王軍幹部が急速接近中！
            </p>
          </div>
        )}

        {/* DIALOGUE POPUP INTERACTION SCREEN */}
        {gameState === GameState.BOSS_INTRO && (
          <div 
            onClick={handleNextDialogue}
            className="absolute inset-0 bg-slate-950/40 z-20 cursor-pointer flex flex-col justify-end p-4 hover:bg-slate-950/50 transition-colors"
          >
            <div 
              className="w-full p-4 bg-slate-950/95 border-2 border-amber-500/80 rounded-xl shadow-2xl flex flex-col gap-3 min-h-[140px] text-amber-100"
            >
              <div className="flex justify-between items-center border-b border-amber-500/30 pb-1.5">
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {bossTitle}
                </span>
                <span className="text-xs text-amber-500/80 font-semibold font-mono">
                  Stage {currentStageIdx + 1}
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <h4 className="text-sm font-bold text-red-400 mb-1">{bossName}</h4>
                <p className="text-sm leading-relaxed text-amber-100/90 tracking-wide font-medium min-h-[48px]">
                  {diagText || '...'}
                </p>
              </div>

              <div 
                className="w-full text-center py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 font-extrabold text-xs text-slate-950 rounded border border-amber-300 shadow-md transition-colors uppercase tracking-wider"
              >
                画面をタッチして戦闘開始 (TAP TO START)
              </div>
            </div>
          </div>
        )}

        {/* FLOATING SHIFT CONTROLLER GUIDE FOR IFRAME CONVENIENCE */}
        <div className="absolute bottom-1 right-2 z-10 pointer-events-none opacity-50 text-[10px] text-slate-500 font-mono">
          [Shift] 低速モード | WASD/ドラッグ移動
        </div>
      </div>

      {/* DASHBOARD / STATS PANEL - COHESIVE FANTASY METAL THEMING */}
      <div className={`w-full xl:w-80 flex flex-col justify-between bg-slate-900 border-2 border-amber-500/40 rounded-xl shadow-inner relative text-amber-100 transition-all duration-300 ${
        isCompact ? 'p-3 gap-3' : 'p-4 sm:p-5 gap-5'
      }`}>
        
        {/* TOP DECORATIVE LOGO */}
        <div className={`border-b-2 border-amber-500/35 transition-all duration-300 ${isCompact ? 'pb-2.5' : 'pb-4'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-amber-500/60 font-mono tracking-widest uppercase">
              BATTLE STATUS
            </span>
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/10 text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {fps} FPS
            </div>
          </div>
          
          <h2 className={`font-bold font-sans tracking-wide flex items-center gap-2 transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
              魔王軍 vs 勇者
            </span>
          </h2>
          <p className="text-[10px] text-amber-400/50 mt-1 font-semibold">
            難易度: <span className="text-amber-300 font-extrabold">{difficulty === Difficulty.EASY ? '極優 (EASY)' : difficulty === Difficulty.NORMAL ? '深極 (NORMAL)' : '奈落 (HARD)'}</span>
          </p>
        </div>

        {/* EPIC DYNAMIC HEALTH BARS */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isCompact ? 'gap-2.5 py-0.5' : 'gap-4 py-1'}`}>
          
          {/* BOSS LIFE MONITOR */}
          {gameState === GameState.PLAYING && (
            <div className={`bg-slate-950 rounded-lg border border-red-500/20 shadow-inner transition-all ${isCompact ? 'p-2' : 'p-3'}`}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-red-400 truncate max-w-[150px]">
                  {bossName}
                </span>
                <span className="text-[10px] font-bold text-red-500/80 bg-red-950/40 border border-red-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                  <Crosshair className="w-3 h-3 text-red-500 animate-spin" />
                  PHASE {bossPhase}/{bossMaxPhases}
                </span>
              </div>
              
              {/* Massive Health Gauge with color transition */}
              <div className="w-full bg-slate-900 border border-red-500/30 h-3 rounded overflow-hidden">
                <div
                  style={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
                  className="bg-gradient-to-r from-red-600 via-orange-500 to-red-400 h-full transition-all duration-75 relative"
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              
              <div className="flex justify-between items-center text-[10px] text-red-400/60 font-mono mt-1">
                <span>BOSS FORCE INTENSITY</span>
                <span>{Math.round(bossHp).toLocaleString()} / {bossMaxHp.toLocaleString()} HP</span>
              </div>
            </div>
          )}

          {/* PLAYER STATUS (LIVES / METRICS) */}
          <div className={`bg-slate-950 rounded-lg border border-sky-500/20 shadow-inner flex flex-col transition-all ${isCompact ? 'p-2 gap-1.5' : 'p-3 gap-2'}`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                勇者 <span className="text-amber-200">{playerName}</span>
              </span>
              <span className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-500/25 px-2 py-0.5 rounded font-bold font-mono">
                LIFE HP GAUGE
              </span>
            </div>
            
            {/* Heart Indicators */}
            <div className={`flex items-center bg-slate-900/60 rounded-md border border-slate-800 transition-all ${isCompact ? 'gap-1.5 p-1' : 'gap-2.5 p-1.5'}`}>
              {Array.from({ length: maxPlayerHp }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`transition-all duration-300 ${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${
                    idx < playerHp
                      ? 'text-red-500 fill-red-500 filter drop-shadow-[0_0_4px_rgba(239,68,68,0.5)] scale-110'
                      : 'text-slate-700 scale-90'
                  }`}
                />
              ))}
            </div>

            {/* Slow Speed Status */}
            <div className="flex justify-between items-center text-[10px] text-sky-400/70 font-mono">
              <span className="flex items-center gap-1">
                <Zap className={`w-3.5 h-3.5 ${isSlowMode ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
                精密回避モード (SHIFT)
              </span>
              <span className={`font-bold ${isSlowMode ? 'text-amber-400' : 'text-slate-500'}`}>
                {isSlowMode ? 'ACTIVE' : 'READY'}
              </span>
            </div>
          </div>

          {/* LIVE METRICS COUNTERS */}
          <div className={`grid grid-cols-2 transition-all ${isCompact ? 'gap-2' : 'gap-3'}`}>
            
            {/* SCORE DISPLAY */}
            <div className={`bg-slate-950 rounded-lg border border-amber-500/15 text-center transition-all ${isCompact ? 'p-1.5' : 'p-3'}`}>
              <span className="text-[10px] text-amber-500/50 block font-mono">SCORE</span>
              <span className={`font-extrabold font-mono text-green-400 tracking-wider transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>
                {score.toLocaleString()}
              </span>
            </div>

            {/* GRAZE DISPLAY */}
            <div className={`bg-slate-950 rounded-lg border border-amber-500/15 text-center relative group transition-all ${isCompact ? 'p-1.5' : 'p-3'}`}>
              <span className="text-[10px] text-amber-500/50 block font-mono flex items-center justify-center gap-0.5">
                GRAZE
                <HelpCircle className="w-3 h-3 text-amber-500/30 group-hover:text-amber-400 cursor-help" />
              </span>
              <span className={`font-extrabold font-mono text-amber-400 transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>
                {grazeCount}
              </span>
              
              {/* Graze Explainer Tooltip */}
              <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-950 border border-amber-400 p-2 text-[9px] text-amber-100 rounded shadow-xl leading-normal z-30">
                敵の弾にギリギリまで近づくことでグレイズが発生！高得点を手に入めます。
              </div>
            </div>

          </div>

          {/* SHORT RETRO INSTRUCTIONS COMPENDIUM */}
          {!isCompact && (
            <div className="bg-slate-950/40 border border-slate-800 p-2.5 rounded-lg text-slate-400 text-[10px] leading-relaxed flex flex-col gap-1">
              <span className="font-bold text-slate-300">🎮 操作方法:</span>
              <div className="flex justify-between"><span>[W][A][S][D] / 矢印キー</span> <span>勇者移動</span></div>
              <div className="flex justify-between"><span>[Shiftキー（長押し）]</span> <span className="text-amber-400 font-semibold">低速移動＆判定表示</span></div>
              <div className="flex justify-between"><span>[マウス / タッチドラッグ]</span> <span>追従移動（スマホ対応）</span></div>
              <p className="border-t border-slate-800/60 pt-1 text-slate-500 text-[9px]">
                ※ 勇者は常に正面へ光剣（弾）を連射し続けます。
              </p>
            </div>
          )}

        </div>

        {/* BOTTOM UTILITY / MUTE AUDIO TOGGLE */}
        <div className={`flex justify-between items-center border-t border-amber-500/20 gap-2 transition-all ${isCompact ? 'pt-2.5' : 'pt-4'}`}>
          <button
            onClick={toggleSound}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-950 hover:bg-slate-800 text-amber-300 hover:text-amber-150 border border-amber-500/20 hover:border-amber-500/40 rounded-lg text-xs transition-colors font-medium cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
            {muted ? '音量ミュート中' : 'サウンド有効'}
          </button>
          
          <button
            onClick={() => {
              playSelect();
              if (confirm('ゲームを中断してタイトル画面に戻りますか？')) {
                onExit();
              }
            }}
            className="px-3 py-2 bg-slate-950 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 border border-rose-500/10 hover:border-rose-500/30 rounded-lg text-xs transition-colors cursor-pointer"
          >
            撤退
          </button>
        </div>

      </div>

    </div>
  );
}
