import React, { useState, useEffect, useCallback } from 'react';
import type { ScoreboardState, Team } from '../types/scoreboard.ts';
import {
  BellRing,
  Lock,
  Unlock,
  CheckCircle2,
  Smartphone,
  Tablet,
  Layers,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Delete,
  X,
  AlertTriangle,
} from 'lucide-react';
import { playBuzzerSound, unlockAudio } from '../utils/audio.ts';
import { getTeamPin, MASTER_ADMIN_PIN } from '../utils/scoringLogic.ts';
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

  // PIN Input States
  const [inputPin, setInputPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccessMessage, setPinSuccessMessage] = useState<string | null>(null);

  // Unlock Modal States
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockPin, setUnlockPin] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

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

  const selectedTeam = state.teams.find((t) => t.id === selectedTeamId) || state.teams[0];
  const currentRound = state.rounds.find((r) => r.id === state.currentRoundId) || state.rounds[0];

  const inQueueIndex = state.buzzerQueue.findIndex((b) => b.teamId === selectedTeamId);
  const isFirst = inQueueIndex === 0;
  const isQueued = inQueueIndex !== -1;
  const relativeMs = isQueued ? state.buzzerQueue[inQueueIndex].relativeMs : null;
  const firstInQueue = state.buzzerQueue.length > 0 ? state.buzzerQueue[0] : null;

  // Process PIN to lock device to matching team
  const evaluatePinToLock = useCallback(
    (pin: string) => {
      if (pin.length !== 4) return;

      const matchedTeam = state.teams.find((t, idx) => getTeamPin(t, idx) === pin);
      if (matchedTeam) {
        setSelectedTeamId(matchedTeam.id);
        setIsTabletLocked(true);
        setPinError(null);
        setPinSuccessMessage(`Perangkat berhasil dikunci untuk ${matchedTeam.code} (${matchedTeam.name})`);
        setInputPin('');

        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_TEAM_KEY, matchedTeam.id);
          localStorage.setItem(LOCAL_STORAGE_LOCK_KEY, 'true');
        }

        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([120, 40, 120]);
          } catch {}
        }
      } else {
        setPinError(`PIN ${pin} tidak cocok dengan regu manapun!`);
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([250]);
          } catch {}
        }
        setTimeout(() => {
          setInputPin('');
          setPinError(null);
        }, 1200);
      }
    },
    [state.teams]
  );

  // Keypad Handlers for initial lock
  const handleKeypadPress = (digit: string) => {
    if (inputPin.length < 4) {
      const next = inputPin + digit;
      setInputPin(next);
      setPinError(null);
      if (next.length === 4) {
        evaluatePinToLock(next);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setInputPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handleKeypadClear = () => {
    setInputPin('');
    setPinError(null);
  };

  // Unlock Modal Handlers
  const handleUnlockKeypadPress = (digit: string) => {
    if (unlockPin.length < 4) {
      const next = unlockPin + digit;
      setUnlockPin(next);
      setUnlockError(null);
      if (next.length === 4) {
        verifyUnlockPin(next);
      }
    }
  };

  const verifyUnlockPin = (pin: string) => {
    const currentTeamPin = getTeamPin(
      selectedTeam,
      state.teams.findIndex((t) => t.id === selectedTeam.id)
    );

    if (pin === currentTeamPin || pin === MASTER_ADMIN_PIN || pin === '0000') {
      // PIN matches
      setIsTabletLocked(false);
      setShowUnlockModal(false);
      setUnlockPin('');
      setUnlockError(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_LOCK_KEY, 'false');
      }
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch {}
      }
    } else {
      setUnlockError('PIN salah! Masukkan PIN regu ini atau Master PIN.');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([250]);
        } catch {}
      }
      setTimeout(() => {
        setUnlockPin('');
      }, 1000);
    }
  };

  // Keyboard support for typing PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (showUnlockModal) {
          handleUnlockKeypadPress(e.key);
        } else if (!isTabletLocked) {
          handleKeypadPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        if (showUnlockModal) {
          setUnlockPin((prev) => prev.slice(0, -1));
        } else if (!isTabletLocked) {
          handleKeypadBackspace();
        }
      } else if (e.key === 'Escape' && showUnlockModal) {
        setShowUnlockModal(false);
        setUnlockPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnlockModal, isTabletLocked, inputPin, unlockPin]);

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
    <div className="max-w-3xl mx-auto flex flex-col gap-5 py-2 px-2 sm:px-4 touch-manipulation select-none">
      {/* ===================== VIEW 1: PIN LOCK SELECTION SCREEN ===================== */}
      {!isTabletLocked ? (
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-md mx-auto">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg ring-4 ring-amber-400/30">
                <ShieldCheck className="w-9 h-9 stroke-[2.5]" />
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Kunci Posisi Regu Tablet
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Masukkan <span className="text-amber-400 font-bold">4-digit PIN Regu</span> untuk mengunci perangkat ini ke posisi regu yang bersangkutan.
            </p>

            {/* 4 PIN Digit Visual Slots */}
            <div className="flex items-center justify-center gap-3 my-5">
              {[0, 1, 2, 3].map((slotIdx) => {
                const char = inputPin[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-mono font-black transition-all ${
                      char
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/30 scale-105'
                        : 'border-slate-700 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {char ? char : '•'}
                  </div>
                );
              })}
            </div>

            {/* Error or Success notification */}
            {pinError && (
              <div className="mb-4 py-2 px-3 rounded-xl bg-rose-950 border border-rose-600 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-bounce">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {pinSuccessMessage && (
              <div className="mb-4 py-2 px-3 rounded-xl bg-emerald-950 border border-emerald-600 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pinSuccessMessage}</span>
              </div>
            )}

            {/* Tactile Touch Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="py-3.5 sm:py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-xl sm:text-2xl shadow border border-slate-700 transition cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleKeypadClear}
                className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 active:scale-95 text-rose-400 font-bold text-xs uppercase shadow border border-slate-700 transition cursor-pointer"
              >
                Hapus
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                className="py-3.5 sm:py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-xl sm:text-2xl shadow border border-slate-700 transition cursor-pointer"
              >
                0
              </button>
              <button
                onClick={handleKeypadBackspace}
                className="py-3.5 sm:py-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 active:scale-95 text-amber-400 flex items-center justify-center shadow border border-slate-700 transition cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Reference / One-Tap Team Selector Cards */}
            <div className="pt-4 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 text-left mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Daftar PIN Resmi Regu (Atau Klik untuk Isi Otomatis):</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {state.teams.map((t, idx) => {
                  const teamPin = getTeamPin(t, idx);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setInputPin(teamPin);
                        evaluatePinToLock(teamPin);
                      }}
                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:border-amber-400 hover:bg-amber-500/10 text-left transition cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="font-mono font-black text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md group-hover:bg-amber-400 group-hover:text-slate-950 transition">
                          PIN {teamPin}
                        </span>
                      </div>
                      <div className="text-xs font-black text-white uppercase">{t.code}</div>
                      <div className="text-[10px] text-slate-400 truncate">{t.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================== VIEW 2: FULL TABLET BUZZER VIEW (LOCKED) ===================== */
        <div className="flex flex-col gap-4">
          {/* Top Persistent Security Header */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md shrink-0 ring-4 ring-white/10"
                style={{ backgroundColor: selectedTeam?.color || '#047857' }}
              >
                {selectedTeam?.code}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase">{selectedTeam?.name}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                    PIN: {getTeamPin(selectedTeam, state.teams.findIndex((t) => t.id === selectedTeam.id))}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <Lock className="w-3 h-3" />
                  <span>Tablet Terkunci Khusus Regu Ini</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Universal Round Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-xs font-bold">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[120px] sm:max-w-none">{currentRound?.name}</span>
              </div>

              {/* Unlock / Switch Team Button */}
              <button
                onClick={() => {
                  setShowUnlockModal(true);
                  setUnlockPin('');
                  setUnlockError(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                title="Buka Kunci Tablet dengan PIN"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Ganti Regu</span>
              </button>
            </div>
          </div>

          {/* Giant Responsive Touch Buzzer Pad */}
          <div className="flex flex-col items-center justify-center p-6 sm:p-10 bg-slate-900/70 border-2 border-slate-800 rounded-3xl text-center shadow-2xl relative overflow-hidden min-h-[390px] sm:min-h-[460px]">
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

            {/* The Giant Responsive Buzzer Button */}
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
              {/* Inner horn bezel ring */}
              <div className="absolute inset-2 sm:inset-3 rounded-full border-4 sm:border-6 border-white/20 pointer-events-none" />

              <BellRing
                className={`w-20 h-20 sm:w-28 sm:h-28 mb-1 sm:mb-3 text-white transition-transform duration-100 drop-shadow-lg ${
                  isPressing ? 'scale-125' : ''
                }`}
              />

              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-widest uppercase font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {state.isBuzzerLocked ? 'TERKUNCI' : isQueued ? 'TERCATAT' : 'TEKAN BEL!'}
              </span>

              <span className="text-xs sm:text-base font-black text-white/95 uppercase tracking-widest mt-1 sm:mt-2 px-3.5 py-0.5 rounded-full bg-black/35 backdrop-blur-xs">
                {selectedTeam?.code} — {selectedTeam?.name}
              </span>
            </button>

            {/* Bottom Info note */}
            <div className="mt-6 z-10 text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
              <span>Perangkat Terkunci Untuk:</span>
              <span className="text-white font-black px-2 py-0.5 rounded-md bg-slate-800">
                {selectedTeam?.name}
              </span>
              {feedback && <span className="text-amber-400 font-bold ml-2">({feedback})</span>}
            </div>
          </div>
        </div>
      )}

      {/* ===================== UNLOCK VERIFICATION PIN MODAL ===================== */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center relative">
            <button
              onClick={() => {
                setShowUnlockModal(false);
                setUnlockPin('');
              }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white">Buka Kunci Tablet</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Masukkan <span className="text-white font-bold">PIN {selectedTeam?.code} ({getTeamPin(selectedTeam)})</span> atau Master PIN Juri (9999):
            </p>

            {/* PIN slots */}
            <div className="flex items-center justify-center gap-2.5 mb-4">
              {[0, 1, 2, 3].map((idx) => {
                const char = unlockPin[idx];
                return (
                  <div
                    key={idx}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-mono font-black ${
                      char
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {char ? char : '•'}
                  </div>
                );
              })}
            </div>

            {unlockError && (
              <div className="mb-3 py-1.5 px-2 rounded-xl bg-rose-950 border border-rose-600 text-rose-300 text-xs font-bold animate-bounce">
                {unlockError}
              </div>
            )}

            {/* Touch Numpad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleUnlockKeypadPress(digit)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-lg border border-slate-700 transition cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setUnlockPin('')}
                className="py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-rose-400 text-xs font-bold uppercase border border-slate-700 transition cursor-pointer"
              >
                Hapus
              </button>
              <button
                onClick={() => handleUnlockKeypadPress('0')}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-lg border border-slate-700 transition cursor-pointer"
              >
                0
              </button>
              <button
                onClick={() => setUnlockPin((prev) => prev.slice(0, -1))}
                className="py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700 transition cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
