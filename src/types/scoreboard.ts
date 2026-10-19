export interface Team {
  id: string;
  code: string;
  name: string;
  score: number;
  roundScores: Record<string, number>;
  color: string;
  accentColor: string;
  active: boolean;
  buzzerRank?: number;
  buzzerTime?: number;
  pin?: string;
}

export interface Round {
  id: string;
  name: string;
  type: 'wajib' | 'penawaran' | 'rebutan' | 'lemparan' | 'final' | 'custom';
  description: string;
  defaultTimerSeconds: number;
  correctPoints: number;
  wrongPoints: number;
  allowThrow: boolean;
  totalQuestions: number;
}

export interface BuzzerEntry {
  teamId: string;
  teamCode: string;
  teamName: string;
  color: string;
  timestamp: number;
  relativeMs: number;
}

export interface ScoreHistoryEntry {
  id: string;
  timestamp: number;
  action: 'score_add' | 'score_deduct' | 'score_override' | 'reset_round' | 'reset_all';
  teamId: string;
  teamName: string;
  delta: number;
  prevScore: number;
  newScore: number;
  roundId: string;
  note?: string;
}

export interface GoogleSheetsConfig {
  webhookUrl: string;
  sheetId: string;
  autoSync: boolean;
  lastSyncedAt?: number;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncMessage?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  isConnected: boolean;
  lastSyncedAt?: number;
  lastSyncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  lastSyncMessage?: string;
}

export interface TimerState {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  endTime?: number;
}

export interface BigEventData {
  id: string;
  type: 'timer_zero' | 'round_winner' | 'match_champion' | 'tension_warning';
  title: string;
  subtitle?: string;
  roundName?: string;
  winningTeam?: {
    id: string;
    code: string;
    name: string;
    score: number;
    color: string;
    roundScore?: number;
    leadPoints?: number;
  };
  durationMs?: number;
  timestamp: number;
}

export interface CompetitionSession {
  id: string;
  name: string;
  stage: string; // 'Penyisihan' | 'Semifinal' | 'Final' | 'Eksibisi' | string
  status: 'active' | 'completed' | 'upcoming';
  createdAt: number;
  teams: Team[];
  rounds: Round[];
  currentRoundId: string;
  timer: TimerState;
  history: ScoreHistoryEntry[];
  buzzerQueue: BuzzerEntry[];
  isBuzzerLocked: boolean;
  notes?: string;
}

export interface ScoreboardState {
  competitionTitle: string;
  competitionSubtitle: string;
  seasonOrYear: string;
  activeSessionId: string;
  sessions: CompetitionSession[];
  currentRoundId: string;
  rounds: Round[];
  teams: Team[];
  timer: TimerState;
  buzzerQueue: BuzzerEntry[];
  isBuzzerLocked: boolean;
  currentQuestionIndex: number;
  history: ScoreHistoryEntry[];
  supabase?: SupabaseConfig;
  googleSheets: GoogleSheetsConfig;
  apiAccessKey: string;
  activeAnnouncement?: {
    id: string;
    type: 'correct' | 'wrong' | 'buzzer' | 'round_change' | 'winner' | 'info';
    teamId?: string;
    teamName?: string;
    points?: number;
    message?: string;
    durationMs?: number;
    timestamp: number;
  } | null;
  bigEventOverlay?: BigEventData | null;
  lastUpdated: number;
}
