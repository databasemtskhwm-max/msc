import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { ScoreboardState, Team } from '../types/scoreboard.ts';
import { rankTeams, formatTimer } from '../utils/scoringLogic.ts';
import {
  Trophy,
  Clock,
  BellRing,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Calendar,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MuhsinLogo } from './MuhsinLogo.tsx';

interface StageDisplayProps {
  state: ScoreboardState;
  onTimerAction?: (action: 'start' | 'pause' | 'reset' | 'set' | 'adjust', sec?: number) => void;
  onResetBuzzer?: () => void;
  isAdminQuickAccess?: boolean;
}

// Preset color definitions matching the exact design image for Regu A - H
const TEAM_DESIGN_PRESETS: Record<
  string,
  { borderClass: string; badgeClass: string; accentColor: string }
> = {
  'regu-a': {
    borderClass: 'border-amber-400',
    badgeClass: 'bg-amber-400 text-amber-950',
    accentColor: '#f59e0b',
  },
  'regu-b': {
    borderClass: 'border-emerald-600',
    badgeClass: 'bg-emerald-800 text-white',
    accentColor: '#059669',
  },
  'regu-c': {
    borderClass: 'border-emerald-700',
    badgeClass: 'bg-emerald-800 text-white',
    accentColor: '#047857',
  },
  'regu-d': {
    borderClass: 'border-pink-500',
    badgeClass: 'bg-pink-600 text-white',
    accentColor: '#ec4899',
  },
  'regu-e': {
    borderClass: 'border-purple-600',
    badgeClass: 'bg-purple-600 text-white',
    accentColor: '#9333ea',
  },
  'regu-f': {
    borderClass: 'border-orange-500',
    badgeClass: 'bg-orange-500 text-white',
    accentColor: '#f97316',
  },
  'regu-g': {
    borderClass: 'border-lime-500',
    badgeClass: 'bg-lime-600 text-white',
    accentColor: '#84cc16',
  },
  'regu-h': {
    borderClass: 'border-blue-600',
    badgeClass: 'bg-blue-600 text-white',
    accentColor: '#2563eb',
  },
};

export const StageDisplay: React.FC<StageDisplayProps> = ({
  state,
  onTimerAction,
  onResetBuzzer,
}) => {
  const [lastDeltas, setLastDeltas] = useState<Record<string, { delta: number; key: number }>>({});
  const lastHistoryIdRef = useRef<string | null>(null);

  const rankedTeams = useMemo(() => rankTeams(state.teams), [state.teams]);
  const currentRound = state.rounds.find((r) => r.id === state.currentRoundId) || state.rounds[0];

  // Detect genuine score changes only when a new history ID arrives
  useEffect(() => {
    if (state.history && state.history.length > 0) {
      const latest = state.history[0];
      if (latest && latest.id && latest.id !== lastHistoryIdRef.current) {
        lastHistoryIdRef.current = latest.id;
        if (latest.teamId && latest.delta !== 0) {
          setLastDeltas((prev) => ({
            ...prev,
            [latest.teamId]: { delta: latest.delta, key: Date.now() },
          }));

          // Automatically clear delta after 3 seconds
          const timer = setTimeout(() => {
            setLastDeltas((prev) => {
              const copy = { ...prev };
              delete copy[latest.teamId];
              return copy;
            });
          }, 3000);

          if (latest.delta >= 100) {
            confetti({
              particleCount: 25,
              spread: 50,
              origin: { y: 0.8 },
              colors: ['#f59e0b', '#047857', '#3b82f6', '#ec4899'],
            });
          }

          return () => clearTimeout(timer);
        }
      }
    }
  }, [state.history]);

  const seconds = state.timer.secondsLeft;
  const firstBuzzer = state.buzzerQueue.length > 0 ? state.buzzerQueue[0] : null;

  return (
    <div className="w-full flex flex-col gap-5 relative z-10">
      {/* Top Hero Card (Header & Authoritative Timer) */}
      <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-lg p-5 md:p-6 relative overflow-hidden after:absolute after:bottom-0 after:left-6 after:right-6 after:h-1.5 after:bg-gradient-to-r after:from-emerald-700 after:via-emerald-600 after:to-emerald-700 after:rounded-full">
        {/* Subtle Islamic Arabesque Watermark */}
        <div className="absolute right-0 top-0 bottom-0 w-80 opacity-[0.03] pointer-events-none bg-repeat bg-islamic-pattern" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
          {/* Column 1: Competition Logo & Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 flex-1">
            <div className="relative group shrink-0">
              <MuhsinLogo className="w-20 h-20 md:w-24 md:h-24 ring-4 ring-emerald-600/30 shadow-xl rounded-full" />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black tracking-wide uppercase shadow-2xs">
                  MTs KH. A. WAHAB MUHSIN - {state.seasonOrYear}
                </span>
                {state.sessions && state.sessions.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-[#064e3b] text-amber-300 text-xs font-black tracking-wide uppercase shadow-2xs border border-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>SESI: {state.sessions.find((s) => s.id === state.activeSessionId)?.name || state.sessions[0].name}</span>
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-950 tracking-tight leading-tight">
                MUHSIN SMART <span className="text-amber-500">COMPETITION 2026</span>
              </h1>
              <p className="text-slate-600 text-xs md:text-sm font-medium mt-1">
                {state.competitionSubtitle} — Sukahideng Tasikmalaya
              </p>
            </div>
          </div>

          {/* Column 2: Active Round Card */}
          <div className="border border-slate-200 bg-white rounded-2xl p-4 flex flex-col justify-between shadow-xs min-w-[280px] lg:max-w-md w-full lg:w-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="bg-[#064e3b] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                BABAK SEDANG BERLANGSUNG
              </span>
              <Settings className="w-5 h-5 text-amber-500 shrink-0" />
            </div>

            <div className="text-xl font-black text-emerald-950 mt-2">
              {currentRound.name}
            </div>

            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
              {currentRound.description}
            </p>
          </div>

          {/* Column 3: Dedicated Authoritative Timer */}
          <div className="border-2 border-emerald-500/70 bg-white rounded-2xl p-4 flex flex-col items-center justify-between min-w-[210px] w-full sm:w-auto shadow-xs">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-emerald-800 stroke-[2.5]" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-4xl md:text-5xl font-black tracking-tight font-mono text-emerald-950">
                  {formatTimer(seconds)}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
                  {state.timer.isRunning ? 'TIMER BERJALAN' : 'TIMER JEDA'}
                </span>
              </div>
            </div>

            {/* Quick Timer Controls for Presenter / Operator */}
            {onTimerAction && (
              <div className="flex items-center gap-2 mt-3 w-full justify-center">
                <button
                  onClick={() => onTimerAction(state.timer.isRunning ? 'pause' : 'start')}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#064e3b] hover:bg-[#065f46] text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  {state.timer.isRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" /> Jeda
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-300" /> Mulai
                    </>
                  )}
                </button>
                <button
                  onClick={() => onTimerAction('reset')}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition cursor-pointer"
                  title="Reset timer ke nilai default babak"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buzzer Alert Banner (Triggered when contestants buzz in) */}
      {firstBuzzer && (
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 border-2 border-amber-300 text-white rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce duration-1000 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white text-rose-700 flex items-center justify-center font-black shadow-md">
              <BellRing className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 font-black text-xs uppercase px-2.5 py-0.5 rounded-full">
                  BEL TERCEPAT
                </span>
                <span className="text-rose-100 text-xs font-mono font-bold">+0.00 detik</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black mt-0.5">
                {firstBuzzer.teamCode} — <span className="text-amber-200">{firstBuzzer.teamName}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onResetBuzzer && (
              <button
                onClick={onResetBuzzer}
                className="px-4 py-2 bg-white text-rose-800 hover:bg-rose-50 font-bold text-sm rounded-xl transition shadow cursor-pointer"
              >
                Reset Bel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 8 Team Score Cards Grid (Exact 2 Rows × 4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 z-10">
        {state.teams.map((team, idx) => {
          const rankInfo = rankedTeams.find((r) => r.id === team.id);
          const rank = rankInfo?.rank ?? idx + 1;
          const isBuzzerFirst = firstBuzzer?.teamId === team.id;
          const floatingDelta = lastDeltas[team.id];

          // Determine visual styling from preset or fallback
          const preset = TEAM_DESIGN_PRESETS[team.id] || {
            borderClass: 'border-emerald-600',
            badgeClass: 'bg-emerald-800 text-white',
            accentColor: team.color || '#047857',
          };

          return (
            <div
              key={team.id}
              className={`bg-white rounded-2xl border-2 ${preset.borderClass} shadow-md p-4 flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                isBuzzerFirst ? 'ring-4 ring-rose-500 scale-[1.02]' : ''
              }`}
            >
              {/* Subtle background arabesque watermark inside card */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.025] bg-islamic-pattern" />

              {/* Floating Point Delta Animation */}
              {floatingDelta && (
                <div
                  key={floatingDelta.key}
                  className={`absolute top-3 right-3 z-20 px-3 py-1 rounded-full font-black text-sm shadow-lg animate-bounce ${
                    floatingDelta.delta >= 0
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                      : 'bg-rose-600 text-white ring-2 ring-rose-300'
                  }`}
                >
                  {floatingDelta.delta >= 0 ? `+${floatingDelta.delta}` : floatingDelta.delta}
                </div>
              )}

              <div>
                {/* Header: Team Code Badge + Simple Position Number Badge (Tanpa label Juara) */}
                <div className="flex items-center justify-between gap-2 mb-2 relative z-10">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-2xs ${preset.badgeClass}`}
                  >
                    {team.code}
                  </span>

                  {/* Standing Rank Badge (#1, #2, #3, dll. Tanpa label Juara) */}
                  <div className="flex items-center gap-1 font-bold text-xs">
                    <span className="text-slate-600 font-bold text-xs bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full shadow-2xs font-mono">
                      #{rank}
                    </span>
                  </div>
                </div>

                {/* Team / School Name */}
                <h3 className="font-black text-slate-900 text-base md:text-lg min-h-[46px] line-clamp-2 leading-snug flex items-center relative z-10">
                  {team.name}
                </h3>

                {/* Giant Total Score Display (Deep Emerald Islamic Green) */}
                <div className="bg-[#064e3b] text-white rounded-xl py-3 px-2 text-center shadow-inner relative my-2 z-10">
                  <span className="text-[10px] font-bold tracking-wider text-emerald-200 uppercase block mb-0.5">
                    TOTAL AKUMULASI POIN
                  </span>
                  <div className="text-5xl font-black font-mono tracking-tight text-white leading-none">
                    {team.score.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Rincian Babak Breakdown (4 Babak Terpisah: Wajib, Lemparan, Penawaran, Rebutan) */}
              <div className="pt-2 border-t border-slate-100 mt-2 relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  RINCIAN BABAK
                </span>
                <div className="grid grid-cols-4 gap-1 text-center font-mono">
                  {/* Wajib */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-1">
                    <div className="text-[9px] font-bold text-slate-600 truncate">Wajib</div>
                    <div className="font-black text-slate-900 text-xs sm:text-sm mt-0.5">
                      {team.roundScores['round-wajib'] ?? 0}
                    </div>
                  </div>

                  {/* Lemparan (Nilai dari soal wajib yang dilempar) */}
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-1">
                    <div className="text-[9px] font-bold text-amber-800 truncate">Lempar</div>
                    <div className="font-black text-amber-950 text-xs sm:text-sm mt-0.5">
                      {team.roundScores['round-lemparan'] ?? 0}
                    </div>
                  </div>

                  {/* Penawaran */}
                  <div className="bg-sky-50/80 border border-sky-200/80 rounded-lg p-1">
                    <div className="text-[9px] font-bold text-sky-800 truncate">Tawar</div>
                    <div className="font-black text-sky-950 text-xs sm:text-sm mt-0.5">
                      {team.roundScores['round-penawaran'] ?? 0}
                    </div>
                  </div>

                  {/* Rebutan */}
                  <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-1">
                    <div className="text-[9px] font-bold text-rose-800 truncate">Rebut</div>
                    <div className="font-black text-rose-950 text-xs sm:text-sm mt-0.5">
                      {team.roundScores['round-rebutan'] ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Running Standings & Leaderboard (Klasemen Sementara Otomatis Berdasarkan Poin) */}
      <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-lg p-4 sm:p-5 relative overflow-hidden z-10">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#064e3b] text-white font-bold text-sm px-4 py-2 rounded-xl shadow-xs flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Klasemen Sementara ({state.teams.length} Regu Bertanding)</span>
            </div>
            <span className="text-xs text-slate-500 font-medium hidden md:inline">
              • Urutan otomatis teratas ke terbawah berdasarkan akumulasi poin terkini
            </span>
          </div>

          <div className="bg-amber-400 text-amber-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-amber-900" />
            <span>
              Pembaruan Terakhir: {new Date(state.lastUpdated).toLocaleTimeString('id-ID')}
            </span>
          </div>
        </div>

        {/* 8-Chip Standings Ribbon (Horizontal Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-4">
          {rankedTeams.map((team) => {
            const preset = TEAM_DESIGN_PRESETS[team.id] || {
              borderClass: 'border-slate-200',
              badgeClass: 'bg-emerald-800 text-white',
              accentColor: '#047857',
            };

            return (
              <div
                key={team.id}
                className="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between transition shadow-2xs"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      team.rank === 1
                        ? 'bg-amber-400 text-amber-950 shadow-2xs'
                        : team.rank === 2
                        ? 'bg-slate-300 text-slate-800'
                        : team.rank === 3
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    #{team.rank}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${preset.badgeClass}`}
                  >
                    {team.code}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-slate-800 truncate" title={team.name}>
                  {team.name}
                </div>
                <div className="text-right mt-1.5">
                  <span className="font-mono font-black text-sm text-[#064e3b]">
                    {team.score.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">pt</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Running Standings Table (Detail Rincian Tiap Regu) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#064e3b] text-white font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5 text-center w-14">Posisi</th>
                <th className="py-2.5 px-3.5">Kode & Nama Sekolah / Regu</th>
                <th className="py-2.5 px-3 text-center">Wajib</th>
                <th className="py-2.5 px-3 text-center">Lemparan</th>
                <th className="py-2.5 px-3 text-center">Penawaran</th>
                <th className="py-2.5 px-3 text-center">Rebutan</th>
                <th className="py-2.5 px-3.5 text-right font-black">Total Akumulasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankedTeams.map((team, idx) => {
                const preset = TEAM_DESIGN_PRESETS[team.id] || {
                  borderClass: 'border-slate-200',
                  badgeClass: 'bg-emerald-800 text-white',
                  accentColor: '#047857',
                };

                return (
                  <tr
                    key={team.id}
                    className={`transition-colors hover:bg-emerald-50/50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs font-mono ${
                          team.rank === 1
                            ? 'bg-amber-400 text-amber-950 shadow-2xs'
                            : team.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : team.rank === 3
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{team.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${preset.badgeClass}`}>
                          {team.code}
                        </span>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {team.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {team.roundScores['round-wajib'] ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                      {team.roundScores['round-lemparan'] ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-sky-700">
                      {team.roundScores['round-penawaran'] ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700">
                      {team.roundScores['round-rebutan'] ?? 0}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-black text-sm sm:text-base text-[#064e3b]">
                      {team.score.toLocaleString('id-ID')} Poin
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
