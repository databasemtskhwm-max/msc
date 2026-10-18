import type {
  CompetitionSession,
  ScoreboardState,
  Team,
  Round,
  ScoreHistoryEntry,
} from '../types/scoreboard.ts';
import { createAll8Teams, createInitialTeams, rankTeams } from './scoringLogic.ts';

export const DEFAULT_ROUNDS_CONFIG: Round[] = [
  {
    id: 'round-wajib',
    name: 'Babak I: Babak Wajib',
    type: 'wajib',
    description: 'Setiap regu memilih dan menjawab paket soal wajib. Benar +100 poin, salah 0 poin (tanpa pengurangan).',
    defaultTimerSeconds: 15,
    correctPoints: 100,
    wrongPoints: 0,
    allowThrow: false,
    totalQuestions: 10,
  },
  {
    id: 'round-penawaran',
    name: 'Babak II: Babak Penawaran',
    type: 'penawaran',
    description: 'Regu mengajukan penawaran taruhan poin (50, 75, 100, 150) untuk hak menjawab soal. Benar bertambah sebesar tawaran, salah berkurang sebesar tawaran.',
    defaultTimerSeconds: 20,
    correctPoints: 100,
    wrongPoints: -100,
    allowThrow: true,
    totalQuestions: 8,
  },
  {
    id: 'round-rebutan',
    name: 'Babak III: Babak Rebutan',
    type: 'rebutan',
    description: 'Semua regu berebut menekan bel tercepat. Benar +100 poin, salah -100 poin (pengurangan ketat).',
    defaultTimerSeconds: 10,
    correctPoints: 100,
    wrongPoints: -100,
    allowThrow: false,
    totalQuestions: 12,
  },
];

export function createDefaultSession(rounds: Round[] = DEFAULT_ROUNDS_CONFIG): CompetitionSession {
  return {
    id: 'session-penyisihan-1',
    name: 'Babak Penyisihan - Sesi 1',
    stage: 'Penyisihan',
    status: 'active',
    createdAt: Date.now(),
    teams: createAll8Teams(),
    rounds: rounds.length ? rounds : DEFAULT_ROUNDS_CONFIG,
    currentRoundId: rounds[0]?.id || 'round-wajib',
    timer: {
      secondsLeft: 15,
      totalSeconds: 15,
      isRunning: false,
    },
    buzzerQueue: [],
    isBuzzerLocked: false,
    history: [
      {
        id: 'hist-init-s1',
        timestamp: Date.now(),
        action: 'reset_all',
        teamId: '',
        teamName: 'Panitia',
        delta: 0,
        prevScore: 0,
        newScore: 0,
        roundId: 'round-wajib',
        note: 'Sesi 1 Diinisialisasi (8 Regu Siap Bertanding)',
      },
    ],
    notes: 'Sesi pembuka babak penyisihan Muhsin Smart Competition.',
  };
}

export function syncActiveSessionToTopLevel(state: ScoreboardState): ScoreboardState {
  let activeSession = state.sessions.find((s) => s.id === state.activeSessionId);
  if (!activeSession && state.sessions.length > 0) {
    activeSession = state.sessions[0];
    state.activeSessionId = activeSession.id;
  }

  if (activeSession) {
    return {
      ...state,
      currentRoundId: activeSession.currentRoundId || state.currentRoundId,
      rounds: activeSession.rounds && activeSession.rounds.length ? activeSession.rounds : state.rounds,
      teams: activeSession.teams && activeSession.teams.length ? activeSession.teams : state.teams,
      timer: activeSession.timer || state.timer,
      buzzerQueue: activeSession.buzzerQueue || [],
      isBuzzerLocked: Boolean(activeSession.isBuzzerLocked),
      history: activeSession.history || state.history,
      lastUpdated: Date.now(),
    };
  }

  return state;
}

export function syncTopLevelToActiveSession(state: ScoreboardState): ScoreboardState {
  const sessionIdx = state.sessions.findIndex((s) => s.id === state.activeSessionId);
  if (sessionIdx === -1) {
    // If no matching session exists, create one from current top-level state
    const newSession: CompetitionSession = {
      id: state.activeSessionId || `session-${Date.now()}`,
      name: 'Sesi Kompetisi Aktif',
      stage: 'Penyisihan',
      status: 'active',
      createdAt: Date.now(),
      teams: state.teams,
      rounds: state.rounds,
      currentRoundId: state.currentRoundId,
      timer: state.timer,
      buzzerQueue: state.buzzerQueue,
      isBuzzerLocked: state.isBuzzerLocked,
      history: state.history,
    };
    return {
      ...state,
      activeSessionId: newSession.id,
      sessions: [newSession],
      lastUpdated: Date.now(),
    };
  }

  const updatedSessions = [...state.sessions];
  updatedSessions[sessionIdx] = {
    ...updatedSessions[sessionIdx],
    teams: state.teams,
    rounds: state.rounds,
    currentRoundId: state.currentRoundId,
    timer: state.timer,
    buzzerQueue: state.buzzerQueue,
    isBuzzerLocked: state.isBuzzerLocked,
    history: state.history,
  };

  return {
    ...state,
    sessions: updatedSessions,
    lastUpdated: Date.now(),
  };
}

export function switchActiveSession(state: ScoreboardState, targetSessionId: string): ScoreboardState {
  // 1. Commit current work to active session first
  const stateWithCommitted = syncTopLevelToActiveSession(state);

  // 2. Mark previous session as completed/inactive and target as active
  const updatedSessions = stateWithCommitted.sessions.map((sess) => {
    if (sess.id === targetSessionId) {
      return { ...sess, status: 'active' as const };
    }
    if (sess.status === 'active') {
      return { ...sess, status: 'completed' as const };
    }
    return sess;
  });

  const nextState: ScoreboardState = {
    ...stateWithCommitted,
    activeSessionId: targetSessionId,
    sessions: updatedSessions,
  };

  // 3. Mirror the target session data to top-level
  return syncActiveSessionToTopLevel(nextState);
}

export function createNewSession(
  state: ScoreboardState,
  name: string,
  stage: string = 'Penyisihan',
  activateImmediately: boolean = true,
  preset: 'preset8' | 'initial4' | 'empty' = 'preset8'
): ScoreboardState {
  const newId = `session-${Date.now()}`;
  const teams =
    preset === 'preset8'
      ? createAll8Teams()
      : preset === 'initial4'
      ? createInitialTeams()
      : [];

  const newSession: CompetitionSession = {
    id: newId,
    name: name.trim() || `Sesi Baru #${state.sessions.length + 1}`,
    stage,
    status: activateImmediately ? 'active' : 'upcoming',
    createdAt: Date.now(),
    teams,
    rounds: state.rounds.length ? state.rounds : DEFAULT_ROUNDS_CONFIG,
    currentRoundId: state.rounds[0]?.id || 'round-wajib',
    timer: {
      secondsLeft: state.rounds[0]?.defaultTimerSeconds || 15,
      totalSeconds: state.rounds[0]?.defaultTimerSeconds || 15,
      isRunning: false,
    },
    buzzerQueue: [],
    isBuzzerLocked: false,
    history: [
      {
        id: `hist-create-${Date.now()}`,
        timestamp: Date.now(),
        action: 'reset_all',
        teamId: '',
        teamName: 'Panitia',
        delta: 0,
        prevScore: 0,
        newScore: 0,
        roundId: state.rounds[0]?.id || 'round-wajib',
        note: `Sesi "${name}" dibuat dengan ${teams.length} regu`,
      },
    ],
    notes: '',
  };

  let nextSessions = [...state.sessions];
  if (activateImmediately) {
    nextSessions = nextSessions.map((s) => ({
      ...s,
      status: s.status === 'active' ? ('completed' as const) : s.status,
    }));
    nextSessions.push(newSession);

    const nextState: ScoreboardState = {
      ...state,
      activeSessionId: newId,
      sessions: nextSessions,
    };
    return syncActiveSessionToTopLevel(nextState);
  } else {
    nextSessions.push(newSession);
    return {
      ...state,
      sessions: nextSessions,
      lastUpdated: Date.now(),
    };
  }
}

export function duplicateSession(
  state: ScoreboardState,
  sourceSessionId: string,
  newName: string
): ScoreboardState {
  const source = state.sessions.find((s) => s.id === sourceSessionId);
  if (!source) return state;

  const newId = `session-${Date.now()}`;
  const duplicatedTeams: Team[] = source.teams.map((t) => ({
    ...t,
    score: 0,
    roundScores: { 'round-wajib': 0, 'round-lemparan': 0, 'round-penawaran': 0, 'round-rebutan': 0 },
    buzzerRank: undefined,
    buzzerTime: undefined,
  }));

  const clonedSession: CompetitionSession = {
    ...source,
    id: newId,
    name: newName.trim() || `${source.name} (Salinan)`,
    status: 'upcoming',
    createdAt: Date.now(),
    teams: duplicatedTeams,
    timer: {
      secondsLeft: source.rounds[0]?.defaultTimerSeconds || 15,
      totalSeconds: source.rounds[0]?.defaultTimerSeconds || 15,
      isRunning: false,
    },
    buzzerQueue: [],
    isBuzzerLocked: false,
    history: [
      {
        id: `hist-dup-${Date.now()}`,
        timestamp: Date.now(),
        action: 'reset_all',
        teamId: '',
        teamName: 'Panitia',
        delta: 0,
        prevScore: 0,
        newScore: 0,
        roundId: source.rounds[0]?.id || 'round-wajib',
        note: `Duplikasi dari sesi "${source.name}"`,
      },
    ],
  };

  return {
    ...state,
    sessions: [...state.sessions, clonedSession],
    lastUpdated: Date.now(),
  };
}

export function deleteSession(state: ScoreboardState, sessionId: string): ScoreboardState {
  if (state.sessions.length <= 1) {
    throw new Error('Minimal harus ada 1 sesi pertandingan dalam sistem.');
  }

  const remainingSessions = state.sessions.filter((s) => s.id !== sessionId);
  let nextActiveId = state.activeSessionId;

  if (state.activeSessionId === sessionId) {
    nextActiveId = remainingSessions[0].id;
    remainingSessions[0].status = 'active';
  }

  const nextState: ScoreboardState = {
    ...state,
    activeSessionId: nextActiveId,
    sessions: remainingSessions,
  };

  return syncActiveSessionToTopLevel(nextState);
}

export function prepareComprehensiveSheetsPayload(state: ScoreboardState) {
  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) || state.sessions[0];
  const ranked = rankTeams(state.teams);
  const activeRound =
    state.rounds.find((r) => r.id === state.currentRoundId)?.name || state.currentRoundId;

  return {
    type: 'MSC_FULL_DATABASE_SYNC',
    competition: state.competitionTitle,
    subtitle: state.competitionSubtitle,
    activeSession: {
      id: activeSession?.id || state.activeSessionId,
      name: activeSession?.name || 'Sesi Utama',
      stage: activeSession?.stage || 'Penyisihan',
      status: activeSession?.status || 'active',
    },
    activeRound,
    updatedAt: new Date().toISOString(),
    teams: ranked.map((t) => ({
      rank: t.rank,
      code: t.code,
      name: t.name,
      totalScore: t.score,
      roundScores: t.roundScores,
    })),
    sessionsList: state.sessions.map((s) => ({
      id: s.id,
      name: s.name,
      stage: s.stage,
      status: s.status,
      teamCount: s.teams?.length || 0,
      createdAt: new Date(s.createdAt).toLocaleString('id-ID'),
    })),
    recentAudit: state.history.slice(0, 15).map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString('id-ID'),
      team: h.teamName,
      delta: h.delta,
      newScore: h.newScore,
      action: h.action,
      note: h.note || '',
    })),
    fullStateJson: JSON.stringify(state),
  };
}
