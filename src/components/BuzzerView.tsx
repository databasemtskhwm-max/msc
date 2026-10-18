import React, { useState } from 'react';
import type { ScoreboardState, Team } from '../types/scoreboard.ts';
import { BellRing, Lock, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { playBuzzerSound } from '../utils/audio.ts';
import { MuhsinLogo } from './MuhsinLogo.tsx';

interface BuzzerViewProps {
  state: ScoreboardState;
  onBuzzIn: (teamId: string) => Promise<any>;
}

export const BuzzerView: React.FC<BuzzerViewProps> = ({ state, onBuzzIn }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    return state.teams[0]?.id || 'regu-a';
  });
  const [isPressing, setIsPressing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedTeam = state.teams.find((t) => t.id === selectedTeamId) || state.teams[0];

  const inQueueIndex = state.buzzerQueue.findIndex((b) => b.teamId === selectedTeamId);
  const isFirst = inQueueIndex === 0;
  const isQueued = inQueueIndex !== -1;
  const relativeMs = isQueued ? state.buzzerQueue[inQueueIndex].relativeMs : null;

  const handlePress = async () => {
    if (state.isBuzzerLocked || isQueued) return;

    setIsPressing(true);
    playBuzzerSound();

    if ('vibrate' in navigator) {
      navigator.vibrate([120, 40, 120]);
    }

    try {
      const result = await onBuzzIn(selectedTeamId);
      if (result.success) {
        setFeedback(result.isFirst ? '🏆 ANDA BEL TERCEPAT!' : 'Tercatat dalam antrean bel');
      } else {
        setFeedback(result.message || 'Gagal menekan bel');
      }
    } finally {
      setIsPressing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 py-4">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-xl">
        <div className="flex justify-center mb-3">
          <MuhsinLogo className="w-16 h-16 ring-4 ring-emerald-500/30 shadow-lg" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold mb-2">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Bel Digital Peserta (Mobile Stage Buzzer)</span>
        </div>
        <h2 className="text-xl font-black text-white">Lomba Cerdas Cermat MSC</h2>
        <p className="text-xs text-slate-400 mt-1">
          Pilih regu Anda lalu tekan tombol besar di bawah saat bel dibuka pada Babak Rebutan.
        </p>

        {/* Team Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {state.teams.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTeamId(t.id);
                setFeedback(null);
              }}
              className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                selectedTeamId === t.id
                  ? 'border-amber-500 bg-amber-500/20 text-white font-extrabold ring-2 ring-amber-500/40'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: t.color }}
              />
              <div className="text-xs font-black uppercase">{t.code}</div>
              <div className="text-[10px] text-slate-400 truncate">{t.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Giant Tactile Buzzer Button */}
      <div className="flex flex-col items-center justify-center p-6 bg-slate-900/60 border border-slate-800 rounded-3xl text-center shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div
          className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
          style={{ backgroundColor: selectedTeam?.color || '#f59e0b' }}
        />

        {/* Status banner */}
        <div className="mb-6 z-10">
          {state.isBuzzerLocked ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-rose-800/60 text-rose-400 text-sm font-bold animate-pulse">
              <Lock className="w-4 h-4" />
              <span>BEL TERKUNCI OLEH JURI</span>
            </div>
          ) : isFirst ? (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black shadow-lg shadow-emerald-500/40 animate-bounce">
              <CheckCircle2 className="w-5 h-5 stroke-[3]" />
              <span>🏆 REGU ANDA BEL TERCEPAT! (+0.00s)</span>
            </div>
          ) : isQueued ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500 text-amber-300 text-sm font-bold">
              <span>Antrean #{inQueueIndex + 1} (+{((relativeMs || 0) / 1000).toFixed(2)}s)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-700 text-slate-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SIAP! TEKAN SAAT SOAL SELESAI</span>
            </div>
          )}
        </div>

        {/* The Giant Buzzer Button */}
        <button
          onClick={handlePress}
          disabled={state.isBuzzerLocked || isQueued}
          className={`relative z-10 w-64 h-64 sm:w-72 sm:h-72 rounded-full border-8 transition-all duration-150 flex flex-col items-center justify-center shadow-2xl select-none cursor-pointer ${
            state.isBuzzerLocked
              ? 'bg-slate-800 border-slate-700 opacity-60 cursor-not-allowed'
              : isFirst
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 border-emerald-300 shadow-emerald-500/60 ring-8 ring-emerald-500/30'
              : isQueued
              ? 'bg-gradient-to-tr from-amber-700 to-amber-500 border-amber-400'
              : 'bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 border-rose-400 hover:scale-105 active:scale-95 shadow-rose-600/60 ring-8 ring-rose-500/20'
          }`}
          style={{
            transform: isPressing ? 'scale(0.92)' : undefined,
          }}
        >
          <BellRing
            className={`w-20 h-20 mb-2 transition-transform duration-100 ${
              isPressing ? 'scale-125' : ''
            } text-white stroke-[2.5]`}
          />
          <span className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase font-mono drop-shadow-md">
            {state.isBuzzerLocked ? 'TERKUNCI' : isQueued ? 'TERCATAT' : 'TEKAN BEL!'}
          </span>
          <span className="text-xs font-extrabold text-rose-100 uppercase tracking-widest mt-1 opacity-90">
            {selectedTeam?.code}
          </span>
        </button>

        {/* Active team reminder */}
        <div className="mt-6 z-10 text-xs text-slate-400 font-mono">
          Perangkat ini bertindak sebagai:{' '}
          <span className="text-white font-bold">{selectedTeam?.name}</span>
        </div>
      </div>
    </div>
  );
};
