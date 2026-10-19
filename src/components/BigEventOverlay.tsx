import React, { useEffect, useState } from 'react';
import type { BigEventData } from '../types/scoreboard.ts';
import {
  Trophy,
  AlertOctagon,
  Clock,
  Sparkles,
  X,
  Flame,
  Award,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playTimesUpSound, playFanfareSound, playTensionWarningSound } from '../utils/audio.ts';

interface BigEventOverlayProps {
  event: BigEventData | null;
  onDismiss: () => void;
}

export const BigEventOverlay: React.FC<BigEventOverlayProps> = ({ event, onDismiss }) => {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (!event) return;

    if (event.type === 'timer_zero') {
      playTimesUpSound();
      playTensionWarningSound();
      setCountdown(1);

      // Auto dismiss after exactly 1 second (1000ms) for timer_zero
      const timer = setTimeout(() => {
        onDismiss();
      }, 1000);

      return () => clearTimeout(timer);
    } else if (event.type === 'round_winner' || event.type === 'match_champion') {
      playFanfareSound();
      // Continuous celebratory confetti
      const end = Date.now() + 4000;
      const colors = ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#ffffff'];

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
      setCountdown(12);

      // Auto dismiss interval for celebrations
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onDismiss();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [event, onDismiss]);

  if (!event) return null;

  const isTimerZero = event.type === 'timer_zero';
  const isChampion = event.type === 'match_champion';
  const isRoundWinner = event.type === 'round_winner';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in select-none">
      {/* Background Radial Glow */}
      <div
        className={`absolute inset-0 pointer-events-none opacity-40 ${
          isTimerZero
            ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-700/60 via-slate-950/80 to-slate-950'
            : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/50 via-slate-900/80 to-slate-950'
        }`}
      />

      {/* Main Alert Card */}
      <div
        className={`relative z-10 max-w-2xl w-full rounded-3xl border-4 p-6 sm:p-10 shadow-2xl overflow-hidden text-center transition-all duration-300 transform scale-100 ${
          isTimerZero
            ? 'bg-slate-900/95 border-rose-500 shadow-rose-600/50 ring-8 ring-rose-500/20'
            : isChampion
            ? 'bg-slate-900/95 border-amber-400 shadow-amber-500/50 ring-8 ring-amber-400/20'
            : 'bg-slate-900/95 border-emerald-400 shadow-emerald-500/50 ring-8 ring-emerald-400/20'
        }`}
      >
        {/* Top Dismiss Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Tutup (Esc)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Event Content */}
        {isTimerZero ? (
          /* TIMER ZERO / TIMES UP STATE */
          <div className="flex flex-col items-center">
            {/* Warning Hazard Strobe Icon */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-rose-600 text-white flex items-center justify-center shadow-2xl shadow-rose-600/60 mb-6 animate-bounce">
              <Clock className="w-14 h-14 sm:w-16 sm:h-16 stroke-[2.5]" />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-black uppercase tracking-widest mb-3">
              <AlertOctagon className="w-4 h-4" />
              <span>PERINGATAN WAKTU SELESAI</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase font-mono drop-shadow-lg">
              {event.title}
            </h1>

            <p className="text-base sm:text-xl font-bold text-rose-300 mt-2 max-w-md">
              {event.subtitle}
            </p>

            {event.roundName && (
              <div className="mt-4 px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono font-bold">
                {event.roundName}
              </div>
            )}

            {/* Tension Message */}
            <div className="mt-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm font-semibold max-w-lg">
              Peserta dilarang melanjutkan jawaban. Dewan Juri sedang memvalidasi perolehan poin.
            </div>
          </div>
        ) : (
          /* WINNER / CHAMPION CELEBRATION STATE */
          <div className="flex flex-col items-center">
            {/* Crown / Trophy Shimmer */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 mb-6 animate-pulse">
              <Trophy className="w-14 h-14 sm:w-16 sm:h-16 stroke-[2.5]" />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black uppercase tracking-widest mb-2">
              <Sparkles className="w-4 h-4" />
              <span>{isChampion ? 'PENENTUAN AKHIR JUARA' : 'HASIL TERBAIK BABAK'}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              {event.title}
            </h1>

            {/* Winning Team Card Spotlight */}
            {event.winningTeam && (
              <div className="mt-6 w-full p-6 rounded-2xl bg-slate-950 border-2 border-slate-700/80 shadow-inner flex flex-col items-center">
                <div
                  className="px-4 py-1 rounded-lg text-sm font-black uppercase tracking-wider text-slate-950 shadow-md mb-2"
                  style={{ backgroundColor: event.winningTeam.color }}
                >
                  {event.winningTeam.code}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white text-center">
                  {event.winningTeam.name}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mt-4 text-center font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Total Akumulasi
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-400">
                      {event.winningTeam.score} Pts
                    </span>
                  </div>

                  {event.winningTeam.roundScore !== undefined && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Skor di Babak Ini
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-400">
                        {event.winningTeam.roundScore} Pts
                      </span>
                    </div>
                  )}

                  {event.winningTeam.leadPoints !== undefined && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 block uppercase">
                        Keunggulan Poin
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-cyan-400">
                        +{event.winningTeam.leadPoints} Pts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-400 mt-4 font-medium">
              {event.subtitle}
            </p>
          </div>
        )}

        {/* Footer Action & Auto-Dismiss Counter */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-400">
            {isTimerZero ? (
              <span className="text-rose-400 font-bold animate-pulse">
                Menutup otomatis (1 detik) → Langsung fokus pelemparan bel
              </span>
            ) : (
              <>
                Menutup otomatis dalam <strong className="text-white">{countdown}</strong> detik...
              </>
            )}
          </span>

          <button
            onClick={onDismiss}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs transition cursor-pointer shadow-lg ${
              isTimerZero
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
            }`}
          >
            {isTimerZero ? 'Fokus Pelemparan Bel' : 'Lanjutkan Pertandingan'}
          </button>
        </div>
      </div>
    </div>
  );
};
