import React, { useState } from 'react';
import type { ScoreboardState, Team, Round, CompetitionSession } from '../types/scoreboard.ts';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Plus,
  Minus,
  RotateCcw,
  Play,
  Pause,
  Clock,
  BellRing,
  Award,
  Layers,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Undo2,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Sliders,
  Flame,
  ArrowRight,
  Check,
  Calendar,
  ChevronDown,
  Volume2,
  Share2,
  KeyRound,
  Calculator,
} from 'lucide-react';
import { formatTimer, getTeamPin } from '../utils/scoringLogic.ts';
import { MuhsinLogo } from './MuhsinLogo.tsx';
import { SessionManagerView } from './SessionManagerView.tsx';

interface AdminPanelProps {
  state: ScoreboardState;
  onAddScore: (teamId: string, delta: number, note?: string, targetRoundId?: string) => Promise<void>;
  onOverrideScore: (teamId: string, newScore: number, note?: string) => Promise<void>;
  onTimerControl: (action: 'start' | 'pause' | 'reset' | 'set' | 'adjust', seconds?: number) => Promise<void>;
  onResetBuzzer: () => Promise<void>;
  onToggleBuzzerLock: (locked: boolean) => Promise<void>;
  onSwitchRound: (roundId: string) => Promise<void>;
  onManageTeam: (action: 'add' | 'update' | 'delete' | 'preset8', team?: Partial<Team>) => Promise<void>;
  onManageRound?: (action: 'add' | 'update' | 'delete' | 'reset_default', round?: any, roundId?: string) => Promise<void>;
  onResetMatch: (type: 'scores_only' | 'full') => Promise<void>;
  onTriggerBigEvent?: (type: 'timer_zero' | 'round_winner' | 'match_champion', options?: any) => Promise<void>;
  onDismissBigEvent?: () => Promise<void>;
  // Sesi Pertandingan
  onCreateSession?: (name: string, stage?: string, activateImmediately?: boolean, preset?: 'preset8' | 'initial4' | 'empty') => Promise<any>;
  onActivateSession?: (sessionId: string) => Promise<any>;
  onDuplicateSession?: (sessionId: string, newName?: string) => Promise<any>;
  onDeleteSession?: (sessionId: string) => Promise<any>;
  onUpdateSession?: (sessionId: string, updates: Partial<CompetitionSession>) => Promise<any>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  state,
  onAddScore,
  onOverrideScore,
  onTimerControl,
  onResetBuzzer,
  onToggleBuzzerLock,
  onSwitchRound,
  onManageTeam,
  onManageRound,
  onResetMatch,
  onTriggerBigEvent,
  onDismissBigEvent,
  onCreateSession,
  onActivateSession,
  onDuplicateSession,
  onDeleteSession,
  onUpdateSession,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('msc_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Mobile navigation tabs: 'scores' | 'timer' | 'sessions' | 'teams' | 'rounds' | 'history'
  const [activeTab, setActiveTab] = useState<'scores' | 'timer' | 'sessions' | 'teams' | 'rounds' | 'history'>('scores');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');

  // Modals & local state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [manualScoreModal, setManualScoreModal] = useState<{ team: Team } | null>(null);
  const [manualScoreValue, setManualScoreValue] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Input Poin Manual Bebas (di luar template)
  const [customPoints, setCustomPoints] = useState<Record<string, string>>({});
  const [buzzerCustomPoint, setBuzzerCustomPoint] = useState<string>('');
  const [isCustomScoreModalOpen, setIsCustomScoreModalOpen] = useState(false);
  const [modalCustomTeamId, setModalCustomTeamId] = useState<string>('');
  const [modalCustomPoints, setModalCustomPoints] = useState<string>('');
  const [modalCustomRoundId, setModalCustomRoundId] = useState<string>('');
  const [modalCustomNote, setModalCustomNote] = useState<string>('');

  // Edit Template Poin & Waktu Babak
  const [roundEditModal, setRoundEditModal] = useState<Round | null>(null);
  const [editCorrectPoints, setEditCorrectPoints] = useState<string>('100');
  const [editWrongPoints, setEditWrongPoints] = useState<string>('-100');
  const [editTimerSeconds, setEditTimerSeconds] = useState<string>('15');

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 2500);
  };

  const handleApplyCustomScore = async (team: Team, sign: 1 | -1) => {
    const rawVal = customPoints[team.id];
    const val = Math.abs(parseInt(rawVal, 10));
    if (isNaN(val) || val <= 0) return;

    const delta = sign * val;
    const note = delta > 0 ? `Nilai Manual (+${val})` : `Nilai Manual (-${val})`;
    await onAddScore(team.id, delta, note, state.currentRoundId);
    setCustomPoints((prev) => ({ ...prev, [team.id]: '' }));
    showNotification(`${delta > 0 ? '+' : ''}${delta} poin untuk ${team.code}`);
  };

  const handleApplyModalCustomScore = async (sign: 1 | -1) => {
    const targetTeamId = modalCustomTeamId || state.teams[0]?.id;
    const team = state.teams.find((t) => t.id === targetTeamId);
    if (!team) return;

    const val = Math.abs(parseInt(modalCustomPoints, 10));
    if (isNaN(val) || val <= 0) {
      alert('Masukkan besaran nilai yang valid (angka lebih dari 0)');
      return;
    }

    const delta = sign * val;
    const targetRound = modalCustomRoundId || state.currentRoundId;
    const roundName = state.rounds.find((r) => r.id === targetRound)?.name || 'Babak Aktif';
    const note = modalCustomNote.trim() || `Nilai Manual ${roundName} (${delta > 0 ? '+' : ''}${delta})`;

    await onAddScore(team.id, delta, note, targetRound);
    showNotification(`${delta > 0 ? '+' : ''}${delta} poin manual berhasil diberikan ke ${team.code}`);
    setIsCustomScoreModalOpen(false);
    setModalCustomPoints('');
    setModalCustomNote('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('msc_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('PIN Admin salah. Default PIN adalah 1234.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('msc_admin_auth');
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border-2 border-amber-300 rounded-3xl p-6 md:p-8 shadow-xl text-center">
        <div className="flex justify-center mb-4">
          <MuhsinLogo className="w-20 h-20 ring-4 ring-emerald-600/30 shadow-xl rounded-full" />
        </div>
        <div className="w-12 h-12 bg-amber-100 border border-amber-300 text-amber-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6 text-amber-700" />
        </div>
        <h2 className="text-2xl font-black text-emerald-950">Panel Kontrol Juri & Panitia</h2>
        <p className="text-slate-600 text-sm mt-1 mb-6">
          Masukkan PIN Keamanan untuk mengakses kontrol skor cepat di HP, timer, manajemen 8 regu, dan sesi pertandingan.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Masukkan PIN (Default: 1234)"
              className="w-full text-center tracking-widest text-2xl font-mono px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
            {authError && (
              <p className="text-xs text-rose-600 font-semibold mt-2">{authError}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800 text-amber-300 font-black text-sm rounded-2xl shadow-lg shadow-emerald-950/20 transition cursor-pointer"
          >
            Buka Panel Juri (PIN: 1234)
          </button>
        </form>
      </div>
    );
  }

  const currentRound =
    state.rounds.find((r) => r.id === state.currentRoundId) || state.rounds[0];
  const isBabakWajib = currentRound.type === 'wajib' || currentRound.id === 'round-wajib';
  const isBabakPenawaran =
    currentRound.type === 'penawaran' || currentRound.id === 'round-penawaran';
  const isBabakRebutan =
    currentRound.type === 'rebutan' || currentRound.id === 'round-rebutan';

  const activeSession =
    state.sessions?.find((s) => s.id === state.activeSessionId) || state.sessions?.[0];

  const firstBuzzer = state.buzzerQueue && state.buzzerQueue.length > 0 ? state.buzzerQueue[0] : null;

  const filteredTeams = selectedTeamFilter === 'all'
    ? state.teams
    : state.teams.filter((t) => t.id === selectedTeamFilter);

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto pb-24 md:pb-8">
      {/* TOAST NOTIFICATION */}
      {actionSuccessMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-300" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* STICKY TOP MOBILE & DESKTOP QUICK STATUS BAR */}
      <div className="sticky top-2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Active Session & Round Badges */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sessions')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400 text-amber-950 text-xs font-black shadow-xs cursor-pointer hover:bg-amber-300 transition"
              title="Klik untuk ganti atau kelola sesi"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="truncate max-w-[130px] sm:max-w-none">
                {activeSession?.name || 'Sesi Utama'}
              </span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
            </button>

            <button
              onClick={() => setActiveTab('rounds')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#064e3b] text-amber-300 border border-amber-300/60 text-xs font-bold cursor-pointer hover:bg-emerald-900 transition"
              title="Klik untuk ganti babak"
            >
              <span>{currentRound.name}</span>
            </button>
          </div>

          {/* Quick Timer & Buzzer Controls */}
          <div className="flex items-center gap-2">
            {/* Quick Timer Pill */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-black text-sm text-white">
                {formatTimer(state.timer.secondsLeft)}
              </span>
              <button
                onClick={() => onTimerControl(state.timer.isRunning ? 'pause' : 'start')}
                className={`p-1 rounded-lg text-white font-bold transition cursor-pointer ${
                  state.timer.isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
                title={state.timer.isRunning ? 'Jeda Timer' : 'Jalankan Timer'}
              >
                {state.timer.isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
              </button>
              <button
                onClick={() => onTimerControl('reset')}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Quick Lock Buzzer */}
            <button
              onClick={() => onToggleBuzzerLock(!state.isBuzzerLocked)}
              className={`p-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                state.isBuzzerLocked
                  ? 'bg-rose-950/60 border-rose-700 text-rose-300'
                  : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
              }`}
              title={state.isBuzzerLocked ? 'Bel Terkunci' : 'Bel Siap'}
            >
              {state.isBuzzerLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* BUZZER ACTIVE RING ALERT BANNER */}
        {firstBuzzer && (
          <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-rose-900 to-amber-900 border-2 border-amber-400 text-white flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse shadow-xl">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <div className="w-9 h-9 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black shrink-0">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-amber-300">
                  🏆 REGU BERHAK MENJAWAB (BEL TERCEPAT)
                </div>
                <div className="text-base font-black text-white">
                  {firstBuzzer.teamCode} — {firstBuzzer.teamName}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={async () => {
                  const pts = currentRound.correctPoints ?? 100;
                  await onAddScore(firstBuzzer.teamId, pts, `Rebutan Benar (+${pts})`);
                  await onResetBuzzer();
                  showNotification(`+${pts} untuk ${firstBuzzer.teamCode}`);
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Benar (+{currentRound.correctPoints ?? 100})</span>
              </button>

              <button
                onClick={async () => {
                  const pts = currentRound.wrongPoints ?? (isBabakWajib ? 0 : -100);
                  if (pts !== 0) {
                    await onAddScore(firstBuzzer.teamId, pts, `Rebutan Salah (${pts})`);
                  }
                  await onResetBuzzer();
                  showNotification(`Salah (${pts}) untuk ${firstBuzzer.teamCode}`);
                }}
                className="flex-1 sm:flex-none px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Salah ({currentRound.wrongPoints ?? (isBabakWajib ? 0 : -100)})</span>
              </button>

              {/* Input Nilai Custom untuk Pemenang Bel */}
              <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-amber-400/40">
                <input
                  type="number"
                  placeholder="Poin bebas..."
                  value={buzzerCustomPoint}
                  onChange={(e) => setBuzzerCustomPoint(e.target.value)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs font-bold placeholder:text-slate-500 focus:outline-hidden"
                />
                <button
                  onClick={async () => {
                    const val = Math.abs(parseInt(buzzerCustomPoint, 10));
                    if (!isNaN(val) && val > 0) {
                      await onAddScore(firstBuzzer.teamId, val, `Rebutan Benar (+${val})`);
                      await onResetBuzzer();
                      setBuzzerCustomPoint('');
                      showNotification(`+${val} untuk ${firstBuzzer.teamCode}`);
                    }
                  }}
                  disabled={!buzzerCustomPoint || isNaN(Number(buzzerCustomPoint)) || Number(buzzerCustomPoint) <= 0}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-xs font-black rounded-lg cursor-pointer transition shadow-xs"
                  title="Tambah Poin Custom"
                >
                  +
                </button>
                <button
                  onClick={async () => {
                    const val = Math.abs(parseInt(buzzerCustomPoint, 10));
                    if (!isNaN(val) && val > 0) {
                      await onAddScore(firstBuzzer.teamId, -val, `Rebutan Salah (-${val})`);
                      await onResetBuzzer();
                      setBuzzerCustomPoint('');
                      showNotification(`-${val} untuk ${firstBuzzer.teamCode}`);
                    }
                  }}
                  disabled={!buzzerCustomPoint || isNaN(Number(buzzerCustomPoint)) || Number(buzzerCustomPoint) <= 0}
                  className="px-2 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-30 text-white text-xs font-black rounded-lg cursor-pointer transition shadow-xs"
                  title="Kurang Poin Custom"
                >
                  -
                </button>
              </div>

              <button
                onClick={onResetBuzzer}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                title="Reset Antrean Bel"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP & TABLET TAB NAVIGATION BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto shadow-md">
        <button
          onClick={() => setActiveTab('scores')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'scores'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Input Skor</span>
        </button>

        <button
          onClick={() => setActiveTab('timer')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'timer'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Timer & Bel</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Sesi Lomba ({state.sessions?.length || 1})</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'teams'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kelola 8 Regu</span>
        </button>

        <button
          onClick={() => setActiveTab('rounds')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'rounds'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Babak Lomba</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Riwayat & Reset</span>
        </button>
      </div>

      {/* ===================== TAB 1: INPUT SKOR REG LOGIC (MOBILE FIRST) ===================== */}
      {activeTab === 'scores' && (
        <div className="space-y-4">
          {/* Team Filter Chips for Mobile Ergonomics */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedTeamFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition cursor-pointer ${
                selectedTeamFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              Semua ({state.teams.length} Regu)
            </button>
            {state.teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                  selectedTeamFilter === t.id
                    ? 'text-slate-950 shadow-xs ring-2 ring-white'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
                style={{
                  backgroundColor: selectedTeamFilter === t.id ? t.color : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <span>{t.code}</span>
              </button>
            ))}
          </div>

          {/* Quick Round Instruction Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-white font-bold">
                Babak Aktif: <strong className="text-amber-400">{currentRound.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[11px] text-slate-400 hidden lg:inline">
                {isBabakPenawaran
                  ? 'Babak Penawaran: Input taruhan skor (+ / -)'
                  : isBabakWajib
                  ? 'Babak Wajib: Benar +100 poin, salah 0 poin'
                  : 'Babak Rebutan: Benar +100 poin, salah -100 poin'}
              </span>

              <button
                onClick={() => {
                  setModalCustomTeamId(state.teams[0]?.id || '');
                  setModalCustomPoints('');
                  setModalCustomNote('');
                  setModalCustomRoundId(state.currentRoundId);
                  setIsCustomScoreModalOpen(true);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 shrink-0"
              >
                <Calculator className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Input Poin Manual Bebas</span>
              </button>
            </div>
          </div>

          {/* Team Cards Grid (Touch Friendly) */}
          <div
            className={`grid gap-3.5 ${
              filteredTeams.length === 1
                ? 'grid-cols-1 max-w-xl mx-auto'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
            }`}
          >
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-xl relative overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.color }}
                />

                {/* Team Card Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 mb-3.5 pt-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-black uppercase text-slate-950 tracking-wide"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.code}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-white text-sm sm:text-base line-clamp-1">
                        {team.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1 mt-1 font-mono text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold" title="Babak Wajib">
                          W: {team.roundScores?.['round-wajib'] ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300 font-bold" title="Poin Lemparan">
                          L: {team.roundScores?.['round-lemparan'] ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-600/40 text-sky-300 font-bold" title="Babak Penawaran">
                          P: {team.roundScores?.['round-penawaran'] ?? 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-600/40 text-rose-300 font-bold" title="Babak Rebutan">
                          R: {team.roundScores?.['round-rebutan'] ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-mono font-black text-2xl sm:text-3xl ${team.score < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {team.score}
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                      Total Poin
                    </span>
                  </div>
                </div>

                {/* SPECIAL CONTROLS: BABAK PENAWARAN */}
                {isBabakPenawaran ? (
                  <div className="space-y-2 mb-3">
                    <div className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                      Taruhan Poin Penawaran:
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50, 75, 100, 150].map((pts) => (
                        <div key={pts} className="flex flex-col gap-1">
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, pts, `Penawaran Benar (+${pts})`, 'round-penawaran');
                              showNotification(`+${pts} penawaran untuk ${team.code}`);
                            }}
                            className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer active:scale-95"
                          >
                            +{pts}
                          </button>
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, -pts, `Penawaran Salah (-${pts})`, 'round-penawaran');
                              showNotification(`-${pts} penawaran untuk ${team.code}`);
                            }}
                            className="py-1.5 bg-rose-700 hover:bg-rose-600 text-rose-100 font-bold text-[11px] rounded-lg transition cursor-pointer active:scale-95"
                          >
                            -{pts}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* BABAK WAJIB & REBUTAN BIG ACTION BUTTONS */
                  <div className="space-y-2 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          const pts = currentRound.correctPoints ?? 100;
                          await onAddScore(
                            team.id,
                            pts,
                            isBabakWajib ? `Jawaban Benar Wajib (+${pts})` : `Jawaban Benar (+${pts})`,
                            isBabakWajib ? 'round-wajib' : state.currentRoundId
                          );
                          showNotification(`+${pts} poin untuk ${team.code}`);
                        }}
                        className="py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                      >
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                        <span>BENAR (+{currentRound.correctPoints ?? 100})</span>
                      </button>

                      <button
                        onClick={async () => {
                          const pts = currentRound.wrongPoints ?? (isBabakWajib ? 0 : -100);
                          if (pts !== 0) {
                            await onAddScore(
                              team.id,
                              pts,
                              `Jawaban Salah (${pts})`,
                              isBabakWajib ? 'round-wajib' : state.currentRoundId
                            );
                          }
                          showNotification(`Salah (${pts}) untuk ${team.code}`);
                        }}
                        className={`py-3.5 active:scale-95 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer ${
                          isBabakWajib
                            ? 'bg-slate-800 hover:bg-slate-700 shadow-slate-800/30'
                            : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                        }`}
                      >
                        <XCircle className="w-5 h-5 stroke-[2.5]" />
                        <span>SALAH ({currentRound.wrongPoints ?? (isBabakWajib ? 0 : -100)})</span>
                      </button>
                    </div>

                    {/* KHUSUS BABAK WAJIB: LEMPARAN SOAL (Jika regu utama gagal jawab, dilempar ke regu ini) */}
                    {isBabakWajib && (
                      <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5">
                        <div className="flex items-center justify-between text-[11px] font-black text-amber-300 uppercase tracking-wider mb-2">
                          <span className="flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Poin Lemparan (Soal Rebutan Wajib):</span>
                          </span>
                          <span className="font-mono text-amber-400 font-bold">
                            Total: {team.roundScores?.['round-lemparan'] ?? 0}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, 100, `Lemparan Benar (+100)`, 'round-lemparan');
                              showNotification(`+100 Lemparan untuk ${team.code}`);
                            }}
                            className="py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-md"
                          >
                            + Lemparan (+100)
                          </button>
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, 50, `Lemparan Benar (+50)`, 'round-lemparan');
                              showNotification(`+50 Lemparan untuk ${team.code}`);
                            }}
                            className="py-2.5 bg-amber-700/80 hover:bg-amber-600 active:scale-95 text-amber-100 font-black text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-md"
                          >
                            + Lemparan (+50)
                          </button>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-2 pt-1.5 border-t border-amber-500/20">
                          <span className="text-[10px] text-amber-400/80 font-bold">Koreksi Lemparan:</span>
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, -50, `Koreksi Lemparan (-50)`, 'round-lemparan');
                              showNotification(`-50 Lemparan untuk ${team.code}`);
                            }}
                            className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 active:scale-95 text-rose-300 font-bold text-[10px] rounded transition cursor-pointer"
                          >
                            -50
                          </button>
                          <button
                            onClick={async () => {
                              await onAddScore(team.id, -100, `Koreksi Lemparan (-100)`, 'round-lemparan');
                              showNotification(`-100 Lemparan untuk ${team.code}`);
                            }}
                            className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 active:scale-95 text-rose-300 font-bold text-[10px] rounded transition cursor-pointer"
                          >
                            -100
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Secondary Quick Increments & Manual Edit */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1">
                    {[10, 25, 50].map((inc) => (
                      <button
                        key={inc}
                        onClick={async () => {
                          await onAddScore(team.id, inc, `Tambahan Cepat (+${inc})`);
                          showNotification(`+${inc} poin untuk ${team.code}`);
                        }}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 active:scale-90 text-slate-300 hover:text-amber-400 font-bold text-[11px] rounded-lg transition border border-slate-800 cursor-pointer"
                      >
                        +{inc}
                      </button>
                    ))}
                    {[25, 50].map((dec) => (
                      <button
                        key={dec}
                        onClick={async () => {
                          await onAddScore(team.id, -dec, `Pengurangan Cepat (-${dec})`);
                          showNotification(`-${dec} poin untuk ${team.code}`);
                        }}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 active:scale-90 text-rose-300 font-bold text-[11px] rounded-lg transition border border-slate-800 cursor-pointer"
                      >
                        -{dec}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setManualScoreModal({ team });
                      setManualScoreValue(String(team.score));
                    }}
                    className="px-2.5 py-1 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Koreksi Total</span>
                  </button>
                </div>

                {/* Input Nilai Manual Bebas (Angka di luar template) */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/70 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5 text-amber-300 font-extrabold">
                      <Calculator className="w-3.5 h-3.5 text-amber-400" />
                      <span>Input Nilai Manual Bebas:</span>
                    </span>
                    <span className="text-[9px] text-slate-500 lowercase">(angka bebas di luar template)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="Ketik angka, misal: 15, 35, 75..."
                      value={customPoints[team.id] ?? ''}
                      onChange={(e) => setCustomPoints({ ...customPoints, [team.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCustomScore(team, 1);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg text-white font-mono text-xs font-bold placeholder:text-slate-600 focus:outline-hidden"
                    />
                    <button
                      onClick={() => handleApplyCustomScore(team, 1)}
                      disabled={!customPoints[team.id] || isNaN(Number(customPoints[team.id])) || Number(customPoints[team.id]) === 0}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs rounded-lg transition active:scale-95 cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                      title="Tambah Nilai Manual"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Tambah</span>
                    </button>
                    <button
                      onClick={() => handleApplyCustomScore(team, -1)}
                      disabled={!customPoints[team.id] || isNaN(Number(customPoints[team.id])) || Number(customPoints[team.id]) === 0}
                      className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs rounded-lg transition active:scale-95 cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                      title="Kurang Nilai Manual"
                    >
                      <Minus className="w-3 h-3 stroke-[3]" />
                      <span>Kurang</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== TAB 2: TIMER & BEL CERDAS CERMAT ===================== */}
      {activeTab === 'timer' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Big Digital Timer Control Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-extrabold text-white">Kontrol Timer Resmi</h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {state.timer.isRunning ? 'STATUS: BERJALAN' : 'STATUS: JEDA'}
                </span>
              </div>

              {/* Huge Timer Digits */}
              <div className="text-center py-6 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
                <div className="text-6xl sm:text-7xl font-mono font-black text-amber-400 tracking-tight">
                  {formatTimer(state.timer.secondsLeft)}
                </div>
                <span className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1 block">
                  Total Alokasi: {state.timer.totalSeconds} Detik
                </span>
              </div>

              {/* Primary Start / Pause / Reset Buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => onTimerControl('start')}
                  disabled={state.timer.isRunning}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Mulai</span>
                </button>

                <button
                  onClick={() => onTimerControl('pause')}
                  disabled={!state.timer.isRunning}
                  className="py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl transition flex items-center justify-center gap-1 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>Jeda</span>
                </button>

                <button
                  onClick={() => onTimerControl('reset')}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Timer Preset Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Preset Detik Babak:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 15, 20, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => onTimerControl('set', sec)}
                      className="py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-400 font-mono font-bold text-xs rounded-xl border border-slate-800 transition cursor-pointer"
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Buzzer Control Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-extrabold text-white">Antrean Bel Cerdas Cermat</h3>
                </div>

                <button
                  onClick={() => onToggleBuzzerLock(!state.isBuzzerLocked)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    state.isBuzzerLocked
                      ? 'bg-rose-950 border border-rose-700 text-rose-300'
                      : 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                  }`}
                >
                  {state.isBuzzerLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{state.isBuzzerLocked ? 'Bel Terkunci' : 'Bel Terbuka'}</span>
                </button>
              </div>

              {/* Buzzer Queue List */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 min-h-[180px] max-h-[220px] overflow-y-auto mb-4">
                {state.buzzerQueue.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    Belum ada regu yang menekan bel.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {state.buzzerQueue.map((entry, idx) => (
                      <div
                        key={entry.teamId + entry.timestamp}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          idx === 0
                            ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px]">
                            #{idx + 1}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-black text-slate-950"
                            style={{ backgroundColor: entry.color }}
                          >
                            {entry.teamCode}
                          </span>
                          <span className="truncate max-w-[120px] sm:max-w-none">{entry.teamName}</span>
                        </div>
                        <span className="font-mono text-[11px] text-amber-400">
                          +{entry.relativeMs}ms
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={onResetBuzzer}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Antrean Bel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: SESI LOMBA (MATCH SESSIONS) ===================== */}
      {activeTab === 'sessions' && (
        <SessionManagerView
          state={state}
          onCreateSession={onCreateSession}
          onActivateSession={onActivateSession}
          onDuplicateSession={onDuplicateSession}
          onDeleteSession={onDeleteSession}
          onUpdateSession={onUpdateSession}
          showNotification={showNotification}
        />
      )}

      {/* ===================== TAB 4: KELOLA 8 REGU ===================== */}
      {activeTab === 'teams' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">
                  Manajemen Regu Peserta ({state.teams.length} / 8 Regu)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasikan nama sekolah, kode regu, dan warna regu yang bertanding pada sesi aktif ini.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={state.teams.length >= 8}
                onClick={async () => {
                  await onManageTeam('add');
                  showNotification('Regu baru berhasil ditambahkan!');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition ${
                  state.teams.length >= 8
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-600/20'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Tambah Regu ({state.teams.length}/8)</span>
              </button>

              <button
                onClick={async () => {
                  await onManageTeam('preset8');
                  showNotification('8 Regu lengkap (A-H) disiapkan!');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Preset 8 Regu (A-H)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {state.teams.map((team) => (
              <div
                key={team.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="font-black text-sm text-white">{team.code}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTeam({ ...team })}
                      title="Edit Nama & Warna Regu"
                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {state.teams.length > 2 && (
                      <button
                        onClick={async () => {
                          await onManageTeam('delete', { id: team.id });
                          showNotification(`${team.code} dihapus.`);
                        }}
                        title="Hapus Regu"
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-300 font-medium truncate mb-2" title={team.name}>
                  {team.name}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80 font-mono">
                  <span className="text-slate-500">Skor:</span>
                  <span className="font-black text-amber-400">{team.score} Pts</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900 font-mono">
                  <span className="text-slate-500 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-amber-400" />
                    <span>PIN Tablet:</span>
                  </span>
                  <span className="font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {getTeamPin(team, state.teams.findIndex((t) => t.id === team.id))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== TAB 5: BABAK LOMBA ===================== */}
      {activeTab === 'rounds' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Pilih & Konfigurasi Babak Lomba</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik kartu babak untuk langsung mengganti babak aktif di Layar Panggung.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {state.rounds.map((round, idx) => {
              const isActive = state.currentRoundId === round.id;
              return (
                <div
                  key={round.id}
                  onClick={() => onSwitchRound(round.id)}
                  className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-white">
                        {round.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          AKTIF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      {round.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80 gap-1 flex-wrap">
                    <span>Timer: <strong className="text-amber-400">{round.defaultTimerSeconds}s</strong></span>
                    <span>Poin: <strong className="text-emerald-400">+{round.correctPoints}</strong> / <strong className="text-rose-400">{round.wrongPoints}</strong></span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoundEditModal({ ...round });
                        setEditCorrectPoints(String(round.correctPoints ?? 100));
                        setEditWrongPoints(String(round.wrongPoints ?? (round.id === 'round-wajib' ? 0 : -100)));
                        setEditTimerSeconds(String(round.defaultTimerSeconds ?? 15));
                      }}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white rounded border border-slate-700 transition text-[10px] font-bold cursor-pointer"
                    >
                      Edit Template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== TAB 6: RIWAYAT & AUDIT ===================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">Riwayat Skor Juri</h3>
              </div>

              <button
                onClick={async () => {
                  if (confirm('Yakin ingin mereset skor semua regu pada sesi ini menjadi 0?')) {
                    await onResetMatch('scores_only');
                    showNotification('Skor sesi berhasil direset ke 0');
                  }
                }}
                className="px-3.5 py-2 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Skor Sesi Ini</span>
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {state.history.slice(0, 30).map((h) => (
                <div
                  key={h.id}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white mr-2">{h.teamName}</span>
                    <span className="text-slate-400 text-[11px]">{h.note}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold ${
                        h.delta > 0 ? 'text-emerald-400' : h.delta < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {h.delta > 0 ? `+${h.delta}` : h.delta}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(h.timestamp).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== FLOATING MOBILE BOTTOM NAVIGATION BAR ===================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 p-2 md:hidden">
        <div className="flex items-center justify-around gap-1">
          <button
            onClick={() => setActiveTab('scores')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'scores' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[10px]">Skor</span>
          </button>

          <button
            onClick={() => setActiveTab('timer')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'timer' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px]">Timer</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'sessions' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Sesi</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'teams' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">8 Regu</span>
          </button>

          <button
            onClick={() => setActiveTab('rounds')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'rounds' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px]">Babak</span>
          </button>
        </div>
      </div>

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4">Edit Data {editingTeam.code}</h3>

            <div className="mb-3">
              <label className="text-xs text-slate-300 font-bold block mb-1">Kode Regu</label>
              <input
                type="text"
                value={editingTeam.code}
                onChange={(e) => setEditingTeam({ ...editingTeam, code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div className="mb-3">
              <label className="text-xs text-slate-300 font-bold block mb-1">Nama Sekolah / Tim</label>
              <input
                type="text"
                value={editingTeam.name}
                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-300 font-bold block mb-1">Warna Regu</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editingTeam.color}
                  onChange={(e) => setEditingTeam({ ...editingTeam, color: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-xs text-slate-300">{editingTeam.color}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-300 font-bold block mb-1">
                PIN Kunci Bel Tablet (Default 4 digit)
              </label>
              <input
                type="text"
                maxLength={6}
                value={editingTeam.pin || ''}
                placeholder={getTeamPin(editingTeam, state.teams.findIndex((t) => t.id === editingTeam.id))}
                onChange={(e) => setEditingTeam({ ...editingTeam, pin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono tracking-widest placeholder:text-slate-600"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Contoh: 1111 untuk Regu A, 2222 untuk Regu B, dst.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  await onManageTeam('update', editingTeam);
                  setEditingTeam(null);
                  showNotification(`Data ${editingTeam.code} diperbarui!`);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL SCORE OVERRIDE MODAL */}
      {manualScoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1">
              Koreksi Skor {manualScoreModal.team.code}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {manualScoreModal.team.name} — Skor saat ini: {manualScoreModal.team.score}
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-300 font-bold block mb-1">
                Total Skor Baru
              </label>
              <input
                type="number"
                value={manualScoreValue}
                onChange={(e) => setManualScoreValue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-lg font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const val = parseInt(manualScoreValue, 10);
                  if (!isNaN(val)) {
                    await onOverrideScore(
                      manualScoreModal.team.id,
                      val,
                      'Koreksi manual oleh Dewan Juri'
                    );
                    setManualScoreModal(null);
                    showNotification(`Skor ${manualScoreModal.team.code} dikoreksi menjadi ${val}`);
                  }
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
              >
                Simpan Koreksi
              </button>
              <button
                onClick={() => setManualScoreModal(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL CUSTOM SCORE INPUT MODAL */}
      {isCustomScoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                <span>Input Nilai Manual Bebas</span>
              </h3>
              <button
                onClick={() => setIsCustomScoreModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Masukkan besaran nilai custom yang tidak ada pada template tombol untuk regu yang dipilih.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Pilih Regu
                </label>
                <select
                  value={modalCustomTeamId || state.teams[0]?.id}
                  onChange={(e) => setModalCustomTeamId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs"
                >
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name} (Skor saat ini: {t.score})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Alokasi Babak
                </label>
                <select
                  value={modalCustomRoundId || state.currentRoundId}
                  onChange={(e) => setModalCustomRoundId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs"
                >
                  {state.rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.id === state.currentRoundId ? '(Babak Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Besaran Nilai Bebas (Angka Positif)
                </label>
                <input
                  type="number"
                  placeholder="Misal: 15, 30, 45, 75, 120, 250..."
                  value={modalCustomPoints}
                  onChange={(e) => setModalCustomPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold placeholder:text-slate-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Jawaban kurang sempurna, Bonus juri, Penalti..."
                  value={modalCustomNote}
                  onChange={(e) => setModalCustomNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyModalCustomScore(1)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Tambah Nilai</span>
              </button>
              <button
                onClick={() => handleApplyModalCustomScore(-1)}
                className="flex-1 py-3 bg-rose-700 hover:bg-rose-600 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-700/30 cursor-pointer active:scale-95"
              >
                <Minus className="w-4 h-4 stroke-[3]" />
                <span>- Kurang Nilai</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUND TEMPLATE EDIT MODAL */}
      {roundEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">
              Edit Template Nilai & Waktu
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Babak: <strong className="text-amber-400">{roundEditModal.name}</strong>
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Poin Benar (+ Nilai Default Template)
                </label>
                <input
                  type="number"
                  value={editCorrectPoints}
                  onChange={(e) => setEditCorrectPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Poin Salah (- Nilai Default Template)
                </label>
                <input
                  type="number"
                  value={editWrongPoints}
                  onChange={(e) => setEditWrongPoints(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-rose-400 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Alokasi Waktu Default (Detik)
                </label>
                <input
                  type="number"
                  value={editTimerSeconds}
                  onChange={(e) => setEditTimerSeconds(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 font-mono text-base font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (onManageRound) {
                    await onManageRound('update', {
                      ...roundEditModal,
                      correctPoints: parseInt(editCorrectPoints, 10) || 100,
                      wrongPoints: parseInt(editWrongPoints, 10) || 0,
                      defaultTimerSeconds: parseInt(editTimerSeconds, 10) || 15,
                    }, roundEditModal.id);
                    showNotification(`Template ${roundEditModal.name} berhasil diperbarui!`);
                    setRoundEditModal(null);
                  }
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
              >
                Simpan Perubahan
              </button>
              <button
                onClick={() => setRoundEditModal(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
