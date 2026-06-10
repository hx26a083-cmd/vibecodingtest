/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Trophy,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Sword,
  Skull,
  User,
  ExternalLink
} from 'lucide-react';
import { Difficulty, GameState, ScoreRecord } from './types';
import GameCanvas from './components/GameCanvas';
import Ranking from './components/Ranking';
import { playSelect, toggleMute, getMuteState } from './utils/audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [playerName, setPlayerName] = useState('アキレス');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [muted, setMuted] = useState(getMuteState());

  // Post Game Results Mirror
  const [results, setResults] = useState<{
    score: number;
    isCleared: boolean;
    stageReached: number;
  } | null>(null);

  const toggleSound = () => {
    const isNowMuted = toggleMute();
    setMuted(isNowMuted);
    playSelect();
  };

  const handleStartGame = () => {
    if (!playerName.trim()) {
      alert('勇者の名前を入力してください。');
      return;
    }
    playSelect();
    setGameState(GameState.PLAYING);
  };

  const handleFinishGame = (finalScore: number, isCleared: boolean, stageReached: number) => {
    // Record current result
    setResults({
      score: finalScore,
      isCleared,
      stageReached
    });

    // Persistent storage integration
    try {
      const record: ScoreRecord = {
        id: Math.random().toString(36).substring(2, 9),
        name: playerName.trim() || '無名の勇者',
        score: finalScore,
        difficulty,
        stageReached,
        isCleared,
        date: new Date().toLocaleDateString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      const rawScores = localStorage.getItem('demon_hero_scores');
      const list = rawScores ? JSON.parse(rawScores) : [];
      list.push(record);
      // Persist list
      localStorage.setItem('demon_hero_scores', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to preserve score ranking details:', e);
    }

    // Move to post-game visual display panel
    if (isCleared) {
      setGameState(GameState.VICTORY);
    } else {
      setGameState(GameState.GAMEOVER);
    }
  };

  return (
    <div className={`bg-slate-950 text-slate-100 flex flex-col justify-between font-sans select-none relative transition-all duration-300 ${
      gameState === GameState.PLAYING ? 'h-screen max-h-screen overflow-hidden p-2 sm:p-4' : 'min-h-screen overflow-x-hidden pb-8'
    }`}>
      {/* Cinematic subtle dark gradient background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* GLOBAL HEADER */}
      <header className={`w-full max-w-5xl mx-auto px-4 flex justify-between items-center z-10 border-b border-slate-900 bg-slate-950/65 backdrop-blur-sm sticky top-0 transition-all ${
        gameState === GameState.PLAYING ? 'py-1.5' : 'py-4'
      }`}>
        <div 
          onClick={() => { if (gameState !== GameState.PLAYING) { playSelect(); setGameState(GameState.TITLE); } }} 
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="p-1 px-2.5 bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 rounded font-extrabold text-sm tracking-tighter">
            勇者
          </div>
          <span className="font-extrabold text-md tracking-wider bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent group-hover:to-amber-100 transition-all">
            DEMON SOUL HELL
          </span>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
          </button>
          
          {gameState === GameState.TITLE && (
            <button
              onClick={() => { playSelect(); setGameState(GameState.RANKING); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-400 text-amber-300 rounded-lg text-xs font-semibold cursor-pointer transition-all"
            >
              <Trophy className="w-3.5 h-3.5" />
              名誉の殿堂
            </button>
          )}
        </div>
      </header>

      {/* CORE CONTROLLER ZONE */}
      <main className={`flex-1 max-w-5xl w-full mx-auto px-4 flex items-center justify-center z-10 transition-all ${
        gameState === GameState.PLAYING ? 'py-1 sm:py-2' : 'py-6'
      }`}>
        <AnimatePresence mode="wait">
          
          {/* TITLE SCREEN */}
          {gameState === GameState.TITLE && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full max-w-lg p-6 bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl shadow-2xl relative overflow-hidden text-center flex flex-col gap-6"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-500/50"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-500/50"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-500/50"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-500/50"></div>

              {/* Game Logos / Title Illustration */}
              <div className="flex flex-col gap-1 items-center">
                <span className="text-xs font-bold text-amber-500 tracking-[0.25em] uppercase font-mono">
                  RETRO BULLET HELL SHOOTING
                </span>
                
                {/* Massive Styled Japanese Title */}
                <h1 className="text-3.5xl md:text-4xl font-black tracking-tighter leading-tight text-white py-1 relative">
                  <span className="bg-gradient-to-r from-red-500 via-amber-400 to-amber-200 bg-clip-text text-transparent filter drop-shadow-[0_4px_8px_rgba(239,68,68,0.25)]">
                    魔王と勇者の弾幕決戦
                  </span>
                </h1>
                
                <div className="flex items-center gap-1.5 text-xs text-amber-500/65 font-medium border-t border-b border-amber-500/10 py-1.5 px-6 mt-1.5">
                  <Sword className="w-3.5 h-3.5 text-blue-400 rotate-45" />
                  勇者となり、魔王ルシファーの放つ無双の弾幕を掻き潜れ！
                  <Skull className="w-3.5 h-3.5 text-red-500" />
                </div>
              </div>

              {/* INPUT: PLAYER HERO NAME */}
              <div className="flex flex-col gap-1.5 text-left bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  勇者として名を馳せる（プレイヤー名）
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="アキレス"
                  className="w-full px-4 py-2.5 text-sm bg-slate-900 border border-amber-500/25 rounded-lg text-amber-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors font-semibold"
                />
              </div>

              {/* DIFFICULTY SELECTOR */}
              <div className="flex flex-col gap-2 text-left">
                <span className="text-xs font-extrabold text-amber-400 font-mono tracking-wider">
                  難易度の選択
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: Difficulty.EASY, label: '優 (EASY)', color: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/5', activeColor: 'bg-emerald-950/80 border-emerald-500 text-emerald-300' },
                    { value: Difficulty.NORMAL, label: '極 (NORMAL)', color: 'border-sky-500/40 text-sky-400 hover:bg-sky-500/5', activeColor: 'bg-sky-950/80 border-sky-500 text-sky-300' },
                    { value: Difficulty.HARD, label: '冥 (HARD)', color: 'border-rose-500/40 text-rose-400 hover:bg-rose-500/5', activeColor: 'bg-rose-950/80 border-rose-500 text-rose-300' },
                  ].map((item) => {
                    const isSelected = difficulty === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => { playSelect(); setDifficulty(item.value); }}
                        className={`py-3 px-1 text-center font-bold text-xs rounded-lg transition-all border cursor-pointer ${
                          isSelected ? item.activeColor : `${item.color} bg-slate-950/20`
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                
                {/* Description details of selected level */}
                <p className="text-[10px] text-slate-400 font-medium px-1 bg-slate-950/30 py-1 rounded">
                  {difficulty === Difficulty.EASY && '💡 初心者向け：敵の攻撃弾速が遅く、初期HPは 6 生命（ダメージボーナス付）'}
                  {difficulty === Difficulty.NORMAL && '💡 標準難度：幾何学的な全方向弾幕パターンとの激闘（初期HP 5 生命）'}
                  {difficulty === Difficulty.HARD && '💡 絶望難度：超高速かつ極限濃度の混沌弾幕（初期HP 3 生命、得点倍率に 1.8倍 ボーナス！）'}
                </p>
              </div>

              {/* INITIAL ACTIONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => { playSelect(); setGameState(GameState.RANKING); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 border border-amber-500/30 hover:border-amber-400 bg-slate-950 text-amber-300 font-bold text-xs rounded-xl hover:bg-slate-900 transition-colors cursor-pointer uppercase tracking-wider"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  ランキング (名誉の殿堂)
                </button>
                
                <button
                  onClick={handleStartGame}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 hover:text-slate-900 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/10 cursor-pointer hover:shadow-amber-500/25 active:scale-95 transition-all text-center tracking-[0.1em]"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  魔王城へ征く (BATTLE START)
                </button>
              </div>

            </motion.div>
          )}

          {/* ACTIVE GAME CANVAS COMPONENT */}
          {gameState === GameState.PLAYING && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex items-center justify-center"
            >
              <GameCanvas
                difficulty={difficulty}
                playerName={playerName}
                onFinishGame={handleFinishGame}
                onExit={() => { setGameState(GameState.TITLE); }}
              />
            </motion.div>
          )}

          {/* RANKING SCREEN */}
          {gameState === GameState.RANKING && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full flex items-center justify-center"
            >
              <Ranking
                onBack={() => setGameState(GameState.TITLE)}
                currentDifficulty={difficulty}
              />
            </motion.div>
          )}

          {/* GAME RESULTS DISPLAY (VICTORY / GAMEOVER) */}
          {(gameState === GameState.VICTORY || gameState === GameState.GAMEOVER) && results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg p-6 bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl relative text-center flex flex-col gap-5 text-amber-100"
            >
              <div className="flex flex-col items-center">
                
                {/* Big Badge Graphics */}
                {results.isCleared ? (
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <span className="p-3 bg-amber-500/20 border border-amber-500 rounded-full animate-pulse">
                      <Sparkles className="w-10 h-10 text-amber-400" />
                    </span>
                    <h2 className="text-3xl font-black text-amber-400 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-300 bg-clip-text text-transparent tracking-widest uppercase">
                      魔王討伐完了！
                    </h2>
                    <p className="text-xs text-amber-300/80 mt-1 max-w-sm">
                      大魔王ルシファーの放つ絶対の障壁を掻き消し、世界に安寧がもたらされました。
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <span className="p-3 bg-red-950 border border-red-500/40 rounded-full">
                      <Skull className="w-10 h-10 text-red-500" />
                    </span>
                    <h2 className="text-3xl font-black text-rose-500 tracking-wider">
                      勇者 敗北...
                    </h2>
                    <p className="text-xs text-rose-300/70 mt-1">
                      大いなる闇の結界で力尽きました。しかし、意志は引き継がれます。
                    </p>
                  </div>
                )}
              </div>

              {/* Detailed scorecard statistics */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 font-medium text-sm text-left">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400">挑んだ勇者の名前:</span>
                  <span className="text-amber-300 font-extrabold">{playerName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400">到達ステージ:</span>
                  <span className="text-amber-200 font-mono font-bold">
                    {results.isCleared ? 'Stage 3 CLEAR' : `Stage ${results.stageReached}`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-400">選択難易度:</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-extrabold border ${
                    difficulty === Difficulty.HARD
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                      : difficulty === Difficulty.NORMAL
                      ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                      : 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  }`}>
                    {difficulty}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    獲得最終スコア:
                  </span>
                  <span className="text-2xl font-black font-mono text-green-400 tracking-wider">
                    {results.score.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Call to actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => { playSelect(); setGameState(GameState.RANKING); }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-amber-500/30 hover:border-amber-400 text-amber-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  スコアランキングを確認
                </button>
                
                <button
                  onClick={() => { playSelect(); setGameState(GameState.TITLE); }}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition-transform cursor-pointer"
                >
                  もう一度挑戦する
                </button>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* GLOBAL FOOTER */}
      {gameState !== GameState.PLAYING && (
        <footer className="w-full max-w-5xl mx-auto px-4 pt-4 border-t border-slate-900 text-center text-[10px] text-slate-600 font-mono flex flex-col md:flex-row justify-between items-center gap-2">
          <div>
            &copy; 2026 魔王と勇者の弾幕ゲーム / DEMON SOUL HELL Engine V1.1.0
          </div>
          <div className="flex items-center gap-3">
            <span>PC・スマートフォン(ドラッグ/タッチ)対応</span>
          </div>
        </footer>
      )}
    </div>
  );
}

