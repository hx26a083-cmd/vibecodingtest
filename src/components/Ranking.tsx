/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Search, Trash2, ArrowLeft, ShieldCheck, Flame, Star } from 'lucide-react';
import { ScoreRecord, Difficulty } from '../types';
import { playSelect } from '../utils/audio';

interface RankingProps {
  onBack: () => void;
  currentDifficulty?: Difficulty;
}

export default function Ranking({ onBack, currentDifficulty }: RankingProps) {
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [filterDifficulty, setFilterDifficulty] = useState<string>(currentDifficulty || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('demon_hero_scores');
      if (stored) {
        const parsed: ScoreRecord[] = JSON.parse(stored);
        // Sort descending by score, then date
        const sorted = parsed.sort((a, b) => b.score - a.score);
        setRecords(sorted);
      }
    } catch (e) {
      console.error('Failed to load rankings:', e);
    }
  }, []);

  const handleClear = () => {
    if (confirm('スコアランキングを本当に初期化しますか？ (この操作は取り消せません)')) {
      try {
        localStorage.removeItem('demon_hero_scores');
        setRecords([]);
        playSelect();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesDiff = filterDifficulty === 'ALL' || r.difficulty === filterDifficulty;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDiff && matchesSearch;
  });

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl shadow-black relative overflow-hidden text-amber-100">
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-400"></div>
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-400"></div>
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-400"></div>
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-400"></div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-amber-500/30 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-400 animate-bounce" id="ranking-trophy-icon" />
          <h2 className="text-2xl font-bold tracking-wider font-sans bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200 bg-clip-text text-transparent">
            勇者名誉の殿堂 (スコアランキング)
          </h2>
        </div>
        
        <button
          onClick={() => {
            playSelect();
            onBack();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-amber-500/50 hover:border-amber-400 rounded-lg text-sm transition-all shadow-md group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:-translate-x-1 transition-transform" />
          タイトルへ
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-amber-500/20">
          {['ALL', Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD].map((diff) => (
            <button
              key={diff}
              onClick={() => {
                playSelect();
                setFilterDifficulty(diff);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filterDifficulty === diff
                  ? 'bg-amber-500 text-slate-950 shadow-inner'
                  : 'text-amber-300/70 hover:text-amber-100 hover:bg-slate-800/50'
              }`}
            >
              {diff === 'ALL' ? '全て' : diff === 'EASY' ? '優 (EASY)' : diff === 'NORMAL' ? '極 (NORMAL)' : '冥 (HARD)'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-amber-500/50" />
          <input
            type="text"
            placeholder="勇者名を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-950 border border-amber-500/30 rounded-lg text-amber-100 placeholder-amber-500/40 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Record List */}
      <div className="bg-slate-950/80 rounded-xl border border-amber-500/20 max-h-96 overflow-y-auto mb-4 custom-scrollbar">
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-amber-500/40 text-sm flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 opacity-20" />
            まだ記録がありません。魔王を討伐し伝説を刻みましょう！
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-amber-500/20 bg-slate-900/60 text-amber-400 font-bold">
                <th className="py-3 px-4 w-16 text-center">順位</th>
                <th className="py-3 px-4">勇者名</th>
                <th className="py-3 px-4 text-center">難易度</th>
                <th className="py-3 px-4 text-center">到達</th>
                <th className="py-3 px-4 text-right">スコア</th>
                <th className="py-3 px-4 text-center">結果</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, index) => {
                const isTop3 = index < 3;
                const rowGlow = isTop3 ? 'bg-amber-500/5' : '';

                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-900 hover:bg-slate-900/40 transition-colors ${rowGlow}`}
                  >
                    <td className="py-3 px-4 text-center">
                      {index === 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20">
                          1
                        </span>
                      ) : index === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-extrabold text-xs">
                          2
                        </span>
                      ) : index === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-extrabold text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-amber-500/60 font-mono">{index + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-100 flex items-center gap-1.5 truncate max-w-[120px]">
                      {isTop3 && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400" />}
                      <span className="truncate">{r.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          r.difficulty === Difficulty.HARD
                            ? 'bg-rose-950/80 border-rose-600/50 text-rose-300'
                            : r.difficulty === Difficulty.NORMAL
                            ? 'bg-sky-950/80 border-sky-600/50 text-sky-300'
                            : 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300'
                        }`}
                      >
                        {r.difficulty === Difficulty.EASY ? 'EASY' : r.difficulty === Difficulty.NORMAL ? 'NORMAL' : 'HARD'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-amber-300/80">
                      {r.stageReached === 3 && r.isCleared ? (
                        <span className="text-amber-400 flex items-center justify-center gap-0.5 text-xs">
                          <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                          最終章
                        </span>
                      ) : (
                        `Stage ${r.stageReached}`
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-green-400 text-base">
                      {r.score.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-bold">
                      {r.isCleared ? (
                        <span className="text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
                          CLEAR
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                          END
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-amber-500/40 mt-4 gap-4">
        <div>スコアは難易度・残りHP・グレイズ数、および撃破速度で決定します。</div>
        {records.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors uppercase bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/30 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            ランキングを初期化
          </button>
        )}
      </div>
    </div>
  );
}
