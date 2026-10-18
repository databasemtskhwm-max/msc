import type {
  Team,
  ScoreHistoryEntry,
  BuzzerEntry,
  ScoreboardState,
  BigEventData,
} from '../types/scoreboard.ts';

export const TEAM_PRESETS_8: Array<{
  code: string;
  name: string;
  color: string;
  accentColor: string;
}> = [
  { code: 'Regu A', name: 'SMA Al-Muhsin Putra', color: '#f59e0b', accentColor: '#fbbf24' },
  { code: 'Regu B', name: 'SMA Al-Muhsin Putri', color: '#06b6d4', accentColor: '#22d3ee' },
  { code: 'Regu C', name: 'MAN 1 Unggulan', color: '#10b981', accentColor: '#34d399' },
  { code: 'Regu D', name: 'SMA IT Cendekia', color: '#ec4899', accentColor: '#f472b6' },
  { code: 'Regu E', name: 'MTs KH. A. Wahab Muhsin', color: '#8b5cf6', accentColor: '#a78bfa' },
  { code: 'Regu F', name: 'Ponpes Sukahideng Putra', color: '#f97316', accentColor: '#fb923c' },
  { code: 'Regu G', name: 'Ponpes Sukahideng Putri', color: '#84cc16', accentColor: '#a3e635' },
  { code: 'Regu H', name: 'MA Al-Falah Tasikmalaya', color: '#6366f1', accentColor: '#818cf8' },
];

export function createInitialTeams(): Team[] {
  return TEAM_PRESETS_8.slice(0, 4).map((preset, index) => ({
    id: `regu-${String.fromCharCode(97 + index)}`,
    code: preset.code,
    name: preset.name,
    score: 0,
    roundScores: { 'round-wajib': 0, 'round-lemparan': 0, 'round-penawaran': 0, 'round-rebutan': 0 },
    color: preset.color,
    accentColor: preset.accentColor,
    active: true,
  }));
}

export function createAll8Teams(): Team[] {
  return TEAM_PRESETS_8.map((preset, index) => ({
    id: `regu-${String.fromCharCode(97 + index)}`,
    code: preset.code,
    name: preset.name,
    score: 0,
    roundScores: { 'round-wajib': 0, 'round-lemparan': 0, 'round-penawaran': 0, 'round-rebutan': 0 },
    color: preset.color,
    accentColor: preset.accentColor,
    active: true,
  }));
}

export function generateNextTeam(currentTeams: Team[]): Team {
  const currentCount = currentTeams.length;
  if (currentCount >= 8) {
    throw new Error('Maksimum 8 regu telah tercapai');
  }

  const nextIndex = currentCount;
  const preset = TEAM_PRESETS_8[nextIndex] || {
    code: `Regu ${String.fromCharCode(65 + nextIndex)}`,
    name: `Sekolah Peserta ${String.fromCharCode(65 + nextIndex)}`,
    color: '#3b82f6',
    accentColor: '#60a5fa',
  };

  return {
    id: `regu-${String.fromCharCode(97 + nextIndex)}-${Date.now()}`,
    code: preset.code,
    name: preset.name,
    score: 0,
    roundScores: { 'round-wajib': 0, 'round-lemparan': 0, 'round-penawaran': 0, 'round-rebutan': 0 },
    color: preset.color,
    accentColor: preset.accentColor,
    active: true,
  };
}

export function applyScoreDelta(
  teams: Team[],
  teamId: string,
  roundId: string,
  delta: number,
  note = ''
): { updatedTeams: Team[]; historyEntry: ScoreHistoryEntry } {
  const targetIndex = teams.findIndex((t) => t.id === teamId);
  if (targetIndex === -1) {
    throw new Error(`Team with ID "${teamId}" not found`);
  }

  const target = teams[targetIndex];
  const prevScore = target.score;
  const newScore = prevScore + delta;
  const currentRoundScore = target.roundScores[roundId] ?? 0;
  const newRoundScore = currentRoundScore + delta;

  const updatedTarget: Team = {
    ...target,
    score: newScore,
    roundScores: {
      ...target.roundScores,
      [roundId]: newRoundScore,
    },
  };

  const updatedTeams = [...teams];
  updatedTeams[targetIndex] = updatedTarget;

  const historyEntry: ScoreHistoryEntry = {
    id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    action: delta >= 0 ? 'score_add' : 'score_deduct',
    teamId,
    teamName: target.name,
    delta,
    prevScore,
    newScore,
    roundId,
    note: note || (delta >= 0 ? `+${delta} poin` : `${delta} poin`),
  };

  return { updatedTeams, historyEntry };
}

export function overrideScore(
  teams: Team[],
  teamId: string,
  roundId: string,
  newTotalScore: number,
  note = 'Koreksi manual'
): { updatedTeams: Team[]; historyEntry: ScoreHistoryEntry } {
  const targetIndex = teams.findIndex((t) => t.id === teamId);
  if (targetIndex === -1) {
    throw new Error(`Team with ID "${teamId}" not found`);
  }

  const target = teams[targetIndex];
  const prevScore = target.score;
  const delta = newTotalScore - prevScore;

  const currentRoundScore = target.roundScores[roundId] ?? 0;
  const newRoundScore = currentRoundScore + delta;

  const updatedTarget: Team = {
    ...target,
    score: newTotalScore,
    roundScores: {
      ...target.roundScores,
      [roundId]: newRoundScore,
    },
  };

  const updatedTeams = [...teams];
  updatedTeams[targetIndex] = updatedTarget;

  const historyEntry: ScoreHistoryEntry = {
    id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    action: 'score_override',
    teamId,
    teamName: target.name,
    delta,
    prevScore,
    newScore: newTotalScore,
    roundId,
    note,
  };

  return { updatedTeams, historyEntry };
}

export function registerBuzzerPress(
  currentQueue: BuzzerEntry[],
  team: Team,
  isLocked: boolean,
  now = Date.now()
): { updatedQueue: BuzzerEntry[]; isFirst: boolean } {
  if (isLocked) {
    return { updatedQueue: currentQueue, isFirst: false };
  }

  if (currentQueue.some((b) => b.teamId === team.id)) {
    return { updatedQueue: currentQueue, isFirst: false };
  }

  const isFirst = currentQueue.length === 0;
  const firstTimestamp = isFirst ? now : currentQueue[0].timestamp;
  const relativeMs = now - firstTimestamp;

  const newEntry: BuzzerEntry = {
    teamId: team.id,
    teamCode: team.code,
    teamName: team.name,
    color: team.color,
    timestamp: now,
    relativeMs,
  };

  return {
    updatedQueue: [...currentQueue, newEntry],
    isFirst,
  };
}

export function formatTimer(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function rankTeams(teams: Team[]): Array<Team & { rank: number }> {
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.code.localeCompare(b.code);
  });

  return sorted.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));
}

export function determineRoundWinner(
  teams: Team[],
  roundId: string
): { winner: Team; roundScore: number; lead: number } | null {
  if (teams.length === 0) return null;

  const sorted = [...teams].sort((a, b) => {
    const scoreA = a.roundScores[roundId] ?? 0;
    const scoreB = b.roundScores[roundId] ?? 0;
    return scoreB - scoreA;
  });

  const winner = sorted[0];
  const roundScore = winner.roundScores[roundId] ?? 0;
  const runnerUpScore = sorted[1] ? (sorted[1].roundScores[roundId] ?? 0) : 0;
  const lead = roundScore - runnerUpScore;

  return { winner, roundScore, lead };
}

export function determineMatchChampion(
  teams: Team[]
): { champion: Team; score: number; lead: number } | null {
  if (teams.length === 0) return null;

  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const champion = sorted[0];
  const runnerUpScore = sorted[1] ? sorted[1].score : 0;
  const lead = champion.score - runnerUpScore;

  return { champion, score: champion.score, lead };
}

export function createBigEventOverlay(
  type: 'timer_zero' | 'round_winner' | 'match_champion' | 'tension_warning',
  options: {
    roundName?: string;
    team?: Team;
    roundScore?: number;
    leadPoints?: number;
    customTitle?: string;
    customSubtitle?: string;
  }
): BigEventData {
  const id = 'event-' + Date.now();
  const timestamp = Date.now();

  if (type === 'timer_zero') {
    return {
      id,
      type: 'timer_zero',
      title: options.customTitle || 'WAKTU HABIS!',
      subtitle: options.customSubtitle || 'Waktu berpikir dan menjawab soal telah selesai.',
      roundName: options.roundName || 'Babak Aktif',
      timestamp,
      durationMs: 8000,
    };
  }

  if (type === 'round_winner' && options.team) {
    return {
      id,
      type: 'round_winner',
      title: options.customTitle || `PEMENANG ${options.roundName || 'BABAK INI'}`,
      subtitle: options.customSubtitle || `Memimpin dengan selisih +${options.leadPoints ?? 0} poin!`,
      roundName: options.roundName,
      winningTeam: {
        id: options.team.id,
        code: options.team.code,
        name: options.team.name,
        score: options.team.score,
        color: options.team.color,
        roundScore: options.roundScore ?? 0,
        leadPoints: options.leadPoints ?? 0,
      },
      timestamp,
      durationMs: 12000,
    };
  }

  if (type === 'match_champion' && options.team) {
    return {
      id,
      type: 'match_champion',
      title: 'JUARA UMUM MUHSIN SMART COMPETITION',
      subtitle: `Selamat kepada sang juara dengan perolehan ${options.team.score} total poin!`,
      roundName: 'Penentuan Akhir',
      winningTeam: {
        id: options.team.id,
        code: options.team.code,
        name: options.team.name,
        score: options.team.score,
        color: options.team.color,
        leadPoints: options.leadPoints ?? 0,
      },
      timestamp,
      durationMs: 15000,
    };
  }

  return {
    id,
    type: 'tension_warning',
    title: options.customTitle || 'PERINGATAN WAKTU KRITIS',
    subtitle: options.customSubtitle || 'Detik-detik penentuan babak!',
    roundName: options.roundName,
    timestamp,
  };
}

export function prepareGoogleSheetsRowData(state: ScoreboardState) {
  const ranked = rankTeams(state.teams);
  const activeRound =
    state.rounds.find((r) => r.id === state.currentRoundId)?.name || state.currentRoundId;

  return {
    competition: state.competitionTitle,
    subtitle: state.competitionSubtitle,
    activeRound,
    updatedAt: new Date(state.lastUpdated).toISOString(),
    teams: ranked.map((t) => ({
      rank: t.rank,
      code: t.code,
      name: t.name,
      totalScore: t.score,
      roundScores: t.roundScores,
    })),
    recentAudit: state.history.slice(-10).map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString('id-ID'),
      team: h.teamName,
      delta: h.delta,
      newScore: h.newScore,
      action: h.action,
      note: h.note || '',
    })),
  };
}
