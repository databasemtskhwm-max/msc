import React, { useState, useEffect } from 'react';
import type { ScoreboardState } from '../types/scoreboard.ts';
import {
  BellRing,
  Lock,
  Unlock,
  CheckCircle2,
  Smartphone,
  Tablet,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
} from 'lucide-react';
import { playBuzzerSound, unlockAudio } from '../utils/audio.ts';
import { MuhsinLogo } from './MuhsinLogo.tsx';

interface BuzzerViewProps {
  state: ScoreboardState;
  onBuzzIn: (teamId: string) => Promise<{ success: boolean; isFirst?: boolean; message?: string }>;
}

const LOCAL_STORAGE_TEAM_KEY = 'msc_assigned_buzzer_team';
const LOCAL_STORAGE_LOCK_KEY = 'msc_tablet_mode_locked';

export const BuzzerView: React.FC<BuzzerViewProps> = ({ state, onBuzzIn }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_TEAM_KEY);
      if (saved && state.teams.some((t) => t.id === saved)) {
        return saved;
      }
    }
    return state.teams[0]?.id || 'regu-a';
  });

  const [isTabletLocked, setIsTabletLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOCAL_STORAGE_LOCK_KEY) === 'true';
    }
    return false;
  });

  const [isPressing, setIsPressing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync saved team if teams list changes
  useEffect(() => {
    if (!state.teams.some((t) => t.id === selectedTeamId)) {
      const fallback = state.teams[0]?.id || 'regu-a';
      setSelectedTeamId(fallback);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_TEAM_KEY, fallback);
      }
    }
  }, [state.teams, selectedTeamId]);

  const handleSelectTeam = (teamId: string) => {
    if (isTabletLocked) return;
    setSelectedTeamId(teamId);
    setFeedback(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_TEAM_KEY, teamId);
    }
  };

  const handleToggleLock = () => {
    const nextLocked = !isTabletLocked;
    setIsTabletLocked(nextLocked);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LOCK_KEY, String(nextLocked));
      localStorage.setItem(LOCAL_STORAGE_TEAM_KEY, selectedTeamId);
    }
  };

  const selectedTeam = state.teams.find((t) => t.id === selectedTeamId) || state.teams[0];
  const currentRound = state.rounds.find((r) => r.id === state.currentRoundId) || state.rounds[0];

  const inQueueIndex = state.buzzerQueue.findIndex((b) => b.teamId === selectedTeamId);
  const isFirst = inQueueIndex === 0;
  const isQueued = inQueueIndex !== -1;
  const relativeMs = isQueued ? state.buzzerQueue[inQueueIndex].relativeMs : null;
  const firstInQueue = state.buzzerQueue.length > 0 ? state.buzzerQueue[0] : null;

  const handlePress = async () => {
    if (state.isBuzzerLocked || isQueued) return;

    // Unlock browser audio context on user gesture
    unlockAudio();

    setIsPressing(true);
    playBuzzerSound();

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([140, 50, 140]);
      } catch {}
    }

    try {
      const result = await onBuzzIn(selectedTeamId);
      if (result && result.success) {
        setFeedback(result.isFirst ? '🏆 REGU ANDA BEL TERCEPAT!' : 'Tercatat dalam antrean bel');
      } else {
        setFeedback(result?.message || 'Gagal menekan bel');
      }
    } catch {
      setFeedback('Terjadi kendala koneksi bel');
    } finally {
      setIsPressing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 py-2 px-2 sm:px-4 touch-manipulation select-none">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: selectedTeam?.color || '#f59e0b' }}
        />

        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <MuhsinLogo className="w-10 h-10 ring-2 ring-emerald-500/40 rounded-full" />
            <div className="text-left">
              <h1 className="text-sm font-black text-white leading-tight">MSC 2026</h1>
              <p className="text-[10px] text-slate-400 font-mono">Bel Digital Cerdas Cermat</p>
            </div>
          </div>

          {/* Current Round Badge (Universal across all rounds) */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs font-bold shadow-xs">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-[140px] sm:max-w-xs">{currentRound?.name || 'Babak Lomba'}</span>
          </div>
        </div>

        {/* Tablet Team Lock Control */}
        <div className="mt-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-left">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow-md shrink-0"
              style={{ backgroundColor: selectedTeam?.color || '#047857' }}
            >
              {selectedTeam?.code}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400">Regu Terpilih:</span>
                <span className="text-sm font-black text-white">{selectedTeam?.name}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isTabletLocked
                  ? '🔒 Tablet terkunci khusus untuk regu ini'
                  : '🔓 Mode bebas (Dapat mengganti regu di bawah)'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleLock}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              isTabletLocked
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md'
            }`}
          >
            {isTabletLocked ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kunci Regu</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Kunci Tablet ke Regu Ini</span>
              </>
            )}
          </button>
        </div>

        {/* Team Selector Pills (Hidden or Disabled when Tablet is Locked to prevent mis-clicks) */}
        {!isTabletLocked ? (
          <div className="mt-4">
            <div className="text-[11px] font-semibold text-slate-400 text-left mb-2 flex items-center gap-1">
              <Tablet className="w-3.5 h-3.5 text-amber-400" />
              <span>Pilih Regu Tablet Ini:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {state.teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTeam(t.id)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    selectedTeamId === t.id
                      ? 'border-amber-400 bg-amber-500/20 text-white font-black ring-2 ring-amber-400/50 shadow-md'
                      : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
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
        ) : (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Bel dapat digunakan di semua babak (Wajib, Lemparan, Penawaran, Rebutan)</span>
            </span>
          </div>
        )}
      </div>

      {/* Giant Responsive Touch Buzzer Pad */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-slate-900/70 border border-slate-800 rounded-3xl text-center shadow-2xl relative overflow-hidden min-h-[380px] sm:min-h-[440px]">
        {/* Ambient radial glow based on team color */}
        <div
          className="absolute inset-0 opacity-25 blur-3xl pointer-events-none transition-all duration-500"
          style={{ backgroundColor: selectedTeam?.color || '#f59e0b' }}
        />

        {/* Real-time Status Banner */}
        <div className="mb-6 z-10 w-full flex justify-center">
          {state.isBuzzerLocked ? (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-950/90 border-2 border-rose-600 text-rose-300 text-sm font-black shadow-lg animate-pulse">
              <Lock className="w-5 h-5 text-rose-400" />
              <span>BEL TERKUNCI OLEH JURI / SERVER</span>
            </div>
          ) : isFirst ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-slate-950 text-base font-black shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-300 animate-bounce">
              <CheckCircle2 className="w-6 h-6 stroke-[3]" />
              <span>🏆 REGU ANDA BEL TERCEPAT! (+0.00s)</span>
            </div>
          ) : isQueued ? (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500/25 border-2 border-amber-400 text-amber-200 text-sm font-extrabold shadow-lg">
              <span>Antrean #{inQueueIndex + 1} (+{((relativeMs || 0) / 1000).toFixed(2)} detik)</span>
            </div>
          ) : firstInQueue ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/90 border border-amber-500/50 text-amber-300 text-xs font-bold">
              <span>{firstInQueue.teamCode} menekan bel lebih dahulu</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-950/90 border border-slate-700 text-emerald-400 text-xs font-black uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>SIAP! TEKAN SAAT BEL DIBUKA</span>
            </div>
          )}
        </div>

        {/* The Massive Touch Buzzer Button */}
        <button
          onClick={handlePress}
          disabled={state.isBuzzerLocked || isQueued}
          aria-label={`Bel ${selectedTeam?.name}`}
          className={`relative z-10 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border-8 sm:border-[12px] transition-all duration-100 flex flex-col items-center justify-center shadow-2xl select-none cursor-pointer active:scale-95 ${
            state.isBuzzerLocked
              ? 'bg-slate-800 border-slate-700 opacity-60 cursor-not-allowed shadow-none'
              : isFirst
              ? 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 border-emerald-200 shadow-emerald-500/80 ring-8 ring-emerald-400/40 animate-pulse'
              : isQueued
              ? 'bg-gradient-to-tr from-amber-700 to-amber-500 border-amber-300 ring-4 ring-amber-500/30'
              : 'bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 border-rose-300 hover:brightness-110 shadow-[0_0_50px_rgba(225,29,72,0.6)] ring-8 sm:ring-[14px] ring-rose-500/30'
          }`}
          style={{
            transform: isPressing ? 'scale(0.92)' : undefined,
          }}
        >
          {/* Inner ring for tactile 3D horn look */}
          <div className="absolute inset-2 sm:inset-3 rounded-full border-4 sm:border-6 border-white/20 pointer-events-none" />

          <BellRing
            className={`w-20 h-20 sm:w-28 sm:h-28 mb-1 sm:mb-3 text-white transition-transform duration-100 drop-shadow-lg ${
              isPressing ? 'scale-125' : ''
            }`}
          />

          <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-widest uppercase font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {state.isBuzzerLocked ? 'TERKUNCI' : isQueued ? 'TERCATAT' : 'TEKAN BEL!'}
          </span>

          <span className="text-xs sm:text-base font-black text-white/95 uppercase tracking-widest mt-1 sm:mt-2 px-3 py-0.5 rounded-full bg-black/30 backdrop-blur-xs">
            {selectedTeam?.code} — {selectedTeam?.name}
          </span>
        </button>

        {/* Footer Info for Contestants */}
        <div className="mt-6 z-10 text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
          <span>Perangkat Regu:</span>
          <span className="text-white font-black px-2 py-0.5 rounded-md bg-slate-800">
            {selectedTeam?.name}
          </span>
          {feedback && <span className="text-amber-400 font-bold ml-2">({feedback})</span>}
        </div>
      </div>
    </div>
  );
};
