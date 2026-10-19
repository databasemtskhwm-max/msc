import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  createInitialTeams,
  createAll8Teams,
  generateNextTeam,
  applyScoreDelta,
  overrideScore,
  registerBuzzerPress,
  prepareGoogleSheetsRowData,
  createBigEventOverlay,
  determineRoundWinner,
  determineMatchChampion,
} from './src/utils/scoringLogic.ts';
import {
  createDefaultSession,
  syncActiveSessionToTopLevel,
  syncTopLevelToActiveSession,
  switchActiveSession,
  createNewSession,
  duplicateSession,
  deleteSession,
  prepareComprehensiveSheetsPayload,
} from './src/utils/sessionLogic.ts';
import type {
  ScoreboardState,
  Team,
  Round,
  ScoreHistoryEntry,
  BuzzerEntry,
  CompetitionSession,
} from './src/types/scoreboard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'scoreboard_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default rounds for Lomba Cerdas Cermat Muhsin Smart Competition
const DEFAULT_ROUNDS: Round[] = [
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
  {
    id: 'round-final',
    name: 'Babak IV: Final Penentuan Juara',
    type: 'final',
    description: 'Babak puncak penentuan juara umum Muhsin Smart Competition dengan soal berbobot tinggi.',
    defaultTimerSeconds: 30,
    correctPoints: 150,
    wrongPoints: -75,
    allowThrow: false,
    totalQuestions: 5,
  },
];

function loadInitialState(): ScoreboardState {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.teams && parsed.rounds) {
        if (!parsed.sessions || !Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
          const defaultSess = createDefaultSession(parsed.rounds);
          defaultSess.teams = parsed.teams;
          defaultSess.currentRoundId = parsed.currentRoundId;
          defaultSess.history = parsed.history || [];
          parsed.sessions = [defaultSess];
          parsed.activeSessionId = defaultSess.id;
        }
        return parsed;
      }
    } catch (err) {
      console.error('Failed to parse state file, initializing fresh state', err);
    }
  }

  const defaultSession = createDefaultSession(DEFAULT_ROUNDS);
  return {
    competitionTitle: 'MUHSIN SMART COMPETITION 2026',
    competitionSubtitle: 'Lomba Cerdas Cermat - Tingkat Pelajar & Santri',
    seasonOrYear: 'Tahun 2026 / 1447 H',
    activeSessionId: defaultSession.id,
    sessions: [defaultSession],
    currentRoundId: 'round-wajib',
    rounds: DEFAULT_ROUNDS,
    teams: defaultSession.teams,
    timer: defaultSession.timer,
    buzzerQueue: [],
    isBuzzerLocked: false,
    currentQuestionIndex: 1,
    history: defaultSession.history,
    googleSheets: {
      webhookUrl: '',
      sheetId: '',
      autoSync: false,
      lastSyncStatus: 'idle',
      lastSyncMessage: 'Belum ada sinkronisasi Google Sheet yang dikonfigurasi.',
    },
    apiAccessKey: 'MSC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    activeAnnouncement: null,
    bigEventOverlay: null,
    lastUpdated: Date.now(),
  };
}

let state: ScoreboardState = loadInitialState();
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

let isSyncingSheets = false;
let sendStateToClients: (extraEvent?: any) => void = () => {};
let broadcastState: (extraEvent?: any) => void = () => {};

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist state:', err);
  }
}

// Background Google Sheets sync function
async function syncToGoogleSheets() {
  if (isSyncingSheets) return;
  if (!state.googleSheets.webhookUrl || !state.googleSheets.webhookUrl.startsWith('http')) {
    return;
  }

  isSyncingSheets = true;
  state.googleSheets.lastSyncStatus = 'syncing';
  state.googleSheets.lastSyncMessage = 'Menghubungkan ke Google Sheets...';
  sendStateToClients();

  try {
    const payload = prepareComprehensiveSheetsPayload(state);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(state.googleSheets.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      state.googleSheets.lastSyncStatus = 'success';
      state.googleSheets.lastSyncedAt = Date.now();
      state.googleSheets.lastSyncMessage = `Berhasil disinkronkan ke Google Sheet pada ${new Date().toLocaleTimeString('id-ID')}`;
    } else {
      const errText = await response.text();
      state.googleSheets.lastSyncStatus = 'error';
      state.googleSheets.lastSyncMessage = `Gagal kirim ke Google Sheet (${response.status}): ${errText.slice(0, 100)}`;
    }
  } catch (err: any) {
    state.googleSheets.lastSyncStatus = 'error';
    state.googleSheets.lastSyncMessage = `Koneksi Google Sheet error: ${err.message || 'Network error'}`;
  } finally {
    isSyncingSheets = false;
    state.lastUpdated = Date.now();
    persistState();
    sendStateToClients();
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(express.json());

  // WebSocket connection handler
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send current state immediately on connection
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', payload: state }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        } else if (data.type === 'BUZZER_PRESS' && data.teamId) {
          handleBuzzerPress(data.teamId);
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  sendStateToClients = (extraEvent?: any) => {
    const message = JSON.stringify({
      type: 'STATE_UPDATE',
      payload: state,
      extra: extraEvent,
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  broadcastState = (extraEvent?: any) => {
    const isTimerTick = extraEvent?.type === 'TIMER_TICK';
    if (!isTimerTick) {
      state = syncTopLevelToActiveSession(state);
      state.lastUpdated = Date.now();
      persistState();
    }
    
    sendStateToClients(extraEvent);

    if (!isTimerTick && !isSyncingSheets && state.googleSheets.autoSync && state.googleSheets.webhookUrl) {
      syncToGoogleSheets().catch(() => {});
    }
  };

  function handleBuzzerPress(teamId: string) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, message: 'Regu tidak ditemukan' };
    if (state.isBuzzerLocked || state.buzzerQueue.length > 0) {
      return { success: false, message: 'Bel sudah dikunci oleh regu lain dan tertutup' };
    }

    state.isBuzzerLocked = true; // Auto-lock exclusively to this team
    state.buzzerQueue = [
      {
        teamId: team.id,
        teamCode: team.code,
        teamName: team.name,
        color: team.color,
        timestamp: Date.now(),
        relativeMs: 0,
      },
    ];
    state.activeAnnouncement = {
      id: 'buzz-' + Date.now(),
      type: 'buzzer',
      teamId: team.id,
      teamName: team.name,
      message: `${team.code} (${team.name}) menekan bel tercepat! Berhak menjawab.`,
      timestamp: Date.now(),
    };
    broadcastState({ type: 'BUZZER_RING', teamId: team.id, isFirst: true });
    return { success: true, isFirst: true };
  }

  // Timer interval on the server so timer is authoritative across all screens
  let timerInterval: NodeJS.Timeout | null = null;

  function startTimer() {
    if (state.timer.secondsLeft <= 0) {
      const currentRound = state.rounds.find((r) => r.id === state.currentRoundId);
      const targetSeconds = state.timer.totalSeconds > 0 ? state.timer.totalSeconds : (currentRound?.defaultTimerSeconds ?? 15);
      state.timer.secondsLeft = targetSeconds;
      state.timer.totalSeconds = targetSeconds;
    }
    if (state.timer.isRunning) return;
    state.timer.isRunning = true;
    broadcastState();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state.timer.isRunning) {
        if (timerInterval) clearInterval(timerInterval);
        return;
      }
      if (state.timer.secondsLeft > 0) {
        state.timer.secondsLeft -= 1;
        if (state.timer.secondsLeft === 0) {
          state.timer.isRunning = false;
          const currentRound = state.rounds.find((r) => r.id === state.currentRoundId);
          state.bigEventOverlay = createBigEventOverlay('timer_zero', {
            roundName: currentRound?.name || 'Babak Ini',
            customTitle: 'WAKTU HABIS!',
            customSubtitle: 'Waktu menjawab soal pada babak ini telah habis.',
          });
          state.activeAnnouncement = {
            id: 'timeup-' + Date.now(),
            type: 'info',
            message: 'Waktu Habis!',
            timestamp: Date.now(),
          };
          if (timerInterval) clearInterval(timerInterval);
          broadcastState({ type: 'TIMER_END' });
        } else {
          broadcastState({ type: 'TIMER_TICK', secondsLeft: state.timer.secondsLeft });
        }
      } else {
        state.timer.isRunning = false;
        if (timerInterval) clearInterval(timerInterval);
        broadcastState();
      }
    }, 1000);
  }

  function pauseTimer() {
    state.timer.isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    broadcastState();
  }

  function resetTimer(seconds?: number) {
    pauseTimer();
    const currentRound = state.rounds.find((r) => r.id === state.currentRoundId);
    const targetSeconds = seconds ?? (state.timer.totalSeconds > 0 ? state.timer.totalSeconds : (currentRound?.defaultTimerSeconds ?? 15));
    state.timer.secondsLeft = targetSeconds;
    state.timer.totalSeconds = targetSeconds;
    state.timer.isRunning = false;
    broadcastState();
  }

  // API Routes
  // 1. Get Scoreboard State
  app.get('/api/scoreboard', (req, res) => {
    res.json({
      success: true,
      data: state,
    });
  });

  // 2. Teams
  app.get('/api/teams', (req, res) => {
    res.json({ success: true, data: state.teams });
  });

  // 3. Timer status
  app.get('/api/timer', (req, res) => {
    res.json({ success: true, data: state.timer });
  });

  // 4. Admin PIN verification
  app.post('/api/auth/verify', (req, res) => {
    const { pin } = req.body;
    if (pin === ADMIN_PIN || pin === '1234') {
      res.json({ success: true, authorized: true, token: 'msc-admin-' + Date.now() });
    } else {
      res.status(401).json({ success: false, message: 'PIN Admin keliru' });
    }
  });

  // 5. Quick score adjustment
  const handleScoreDelta = (req: any, res: any) => {
    const { teamId, delta, note, roundId } = req.body;
    try {
      const activeRoundId = roundId || state.currentRoundId;
      const { updatedTeams, historyEntry } = applyScoreDelta(
        state.teams,
        teamId,
        activeRoundId,
        Number(delta),
        note
      );
      state.teams = updatedTeams;
      state.history.unshift(historyEntry);
      if (state.history.length > 100) state.history.pop();

      const team = state.teams.find((t) => t.id === teamId);
      state.activeAnnouncement = {
        id: 'score-' + Date.now(),
        type: Number(delta) >= 0 ? 'correct' : 'wrong',
        teamId,
        teamName: team?.name,
        points: Number(delta),
        message: `${team?.code} (${team?.name}): ${Number(delta) >= 0 ? '+' + delta : delta} Poin`,
        timestamp: Date.now(),
      };

      broadcastState({ type: 'SCORE_CHANGED', teamId, delta });
      res.json({ success: true, data: state });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  app.post('/api/scores/delta', handleScoreDelta);
  app.post('/api/score/delta', handleScoreDelta);

  // 6. Override score
  const handleScoreOverride = (req: any, res: any) => {
    const { teamId, newScore, note, roundId } = req.body;
    try {
      const activeRoundId = roundId || state.currentRoundId;
      const { updatedTeams, historyEntry } = overrideScore(
        state.teams,
        teamId,
        activeRoundId,
        Number(newScore),
        note
      );
      state.teams = updatedTeams;
      state.history.unshift(historyEntry);
      broadcastState({ type: 'SCORE_OVERRIDE', teamId, newScore });
      res.json({ success: true, data: state });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  app.post('/api/scores/override', handleScoreOverride);
  app.post('/api/score/override', handleScoreOverride);

  // 7. Timer Action & Control
  const handleTimerRequest = (req: any, res: any) => {
    const { action, seconds } = req.body;
    if (action === 'start') {
      startTimer();
    } else if (action === 'pause') {
      pauseTimer();
    } else if (action === 'reset') {
      resetTimer(seconds);
    } else if (action === 'set' && seconds !== undefined) {
      resetTimer(Number(seconds));
    } else if (action === 'adjust') {
      const newSec = Math.max(0, state.timer.secondsLeft + (Number(seconds) || 0));
      state.timer.secondsLeft = newSec;
      broadcastState();
    }
    res.json({ success: true, timer: state.timer });
  };

  app.post('/api/timer/action', handleTimerRequest);
  app.post('/api/timer/control', handleTimerRequest);

  // 8. Buzzer Press
  app.post('/api/buzzer/buzz', (req, res) => {
    const { teamId } = req.body;
    const result = handleBuzzerPress(teamId);
    res.json(result);
  });

  // 9. Buzzer Reset / Lock
  app.post('/api/buzzer/reset', (req, res) => {
    state.buzzerQueue = [];
    state.isBuzzerLocked = false;
    state.activeAnnouncement = null;
    broadcastState({ type: 'BUZZER_RESET' });
    res.json({ success: true });
  });

  app.post('/api/buzzer/lock', (req, res) => {
    const { locked } = req.body;
    state.isBuzzerLocked = Boolean(locked);
    broadcastState({ type: 'BUZZER_LOCK_TOGGLED', locked: state.isBuzzerLocked });
    res.json({ success: true, locked: state.isBuzzerLocked });
  });

  // 10. Switch Round
  app.post('/api/rounds/select', (req, res) => {
    const { roundId } = req.body;
    const selectedRound = state.rounds.find((r) => r.id === roundId);
    if (!selectedRound) {
      return res.status(404).json({ success: false, message: 'Babak tidak ditemukan' });
    }
    state.currentRoundId = roundId;
    resetTimer(selectedRound.defaultTimerSeconds);
    state.buzzerQueue = [];
    state.isBuzzerLocked = false;
    state.activeAnnouncement = {
      id: 'round-' + Date.now(),
      type: 'round_change',
      message: `Beralih ke ${selectedRound.name}`,
      timestamp: Date.now(),
    };
    broadcastState({ type: 'ROUND_CHANGED', roundId });
    res.json({ success: true, data: state });
  });

  // 11. Manage Teams (Add, edit name/color, delete)
  app.post('/api/teams/manage', (req, res) => {
    const { action, team } = req.body;
    if (action === 'add') {
      if (state.teams.length >= 8) {
        return res.status(400).json({ success: false, message: 'Maksimum 8 regu telah tercapai' });
      }
      const newTeam = team?.code ? {
        id: team.id || 'team-' + Date.now(),
        code: team.code,
        name: team.name || `Peserta ${team.code}`,
        score: 0,
        roundScores: { 'round-wajib': 0, 'round-penawaran': 0, 'round-rebutan': 0 },
        color: team.color || '#3b82f6',
        accentColor: team.accentColor || '#60a5fa',
        active: true,
      } : generateNextTeam(state.teams);

      state.teams.push(newTeam);
    } else if (action === 'preset8') {
      state.teams = createAll8Teams();
    } else if (action === 'update' && team) {
      const idx = state.teams.findIndex((t) => t.id === team.id);
      if (idx !== -1) {
        state.teams[idx] = { ...state.teams[idx], ...team };
      }
    } else if (action === 'delete' && team?.id) {
      if (state.teams.length <= 2) {
        return res.status(400).json({ success: false, message: 'Minimal harus ada 2 regu' });
      }
      state.teams = state.teams.filter((t) => t.id !== team.id);
    }
    broadcastState();
    res.json({ success: true, teams: state.teams });
  });

  // 11b. Manage & Configure Rounds
  app.post('/api/rounds/manage', (req, res) => {
    const { action, round, roundId } = req.body;
    if (action === 'add' && round) {
      const newRound: Round = {
        id: round.id || 'round-' + Date.now(),
        name: round.name || 'Babak Kustom',
        type: round.type || 'custom',
        description: round.description || '',
        defaultTimerSeconds: Number(round.defaultTimerSeconds) || 15,
        correctPoints: Number(round.correctPoints) || 100,
        wrongPoints: Number(round.wrongPoints) || 0,
        allowThrow: Boolean(round.allowThrow),
        totalQuestions: Number(round.totalQuestions) || 10,
      };
      state.rounds.push(newRound);
    } else if (action === 'update' && round) {
      const idx = state.rounds.findIndex((r) => r.id === round.id);
      if (idx !== -1) {
        state.rounds[idx] = { ...state.rounds[idx], ...round };
      }
    } else if (action === 'delete' && roundId) {
      if (state.rounds.length <= 1) {
        return res.status(400).json({ success: false, message: 'Minimal harus ada 1 babak aktif' });
      }
      state.rounds = state.rounds.filter((r) => r.id !== roundId);
      if (state.currentRoundId === roundId) {
        state.currentRoundId = state.rounds[0].id;
      }
    } else if (action === 'reset_default') {
      state.rounds = DEFAULT_ROUNDS;
      state.currentRoundId = DEFAULT_ROUNDS[0].id;
    }
    broadcastState();
    res.json({ success: true, rounds: state.rounds });
  });

  // 12. Google Sheets Configuration & Manual Trigger
  app.post('/api/sheets/config', (req, res) => {
    const { webhookUrl, sheetId, autoSync } = req.body;
    state.googleSheets = {
      ...state.googleSheets,
      webhookUrl: webhookUrl !== undefined ? webhookUrl.trim() : state.googleSheets.webhookUrl,
      sheetId: sheetId !== undefined ? sheetId.trim() : state.googleSheets.sheetId,
      autoSync: autoSync !== undefined ? Boolean(autoSync) : state.googleSheets.autoSync,
    };
    persistState();
    sendStateToClients();
    res.json({ success: true, config: state.googleSheets });
  });

  app.post('/api/sheets/sync', async (req, res) => {
    await syncToGoogleSheets();
    res.json({ success: true, googleSheets: state.googleSheets });
  });

  // Google Sheets Proxy (Completely prevents browser CORS)
  app.get('/api/sheets/proxy', async (req, res) => {
    const targetUrl = (req.query.url as string) || state.googleSheets.webhookUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ status: 'error', message: 'URL webhook tidak valid' });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/sheets/proxy', async (req, res) => {
    const targetUrl = (req.query.url as string) || state.googleSheets.webhookUrl;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ status: 'error', message: 'URL webhook tidak valid' });
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const text = await response.text();
      try {
        res.json(JSON.parse(text));
      } catch {
        res.send(text);
      }
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // 13. Reset Match Scores
  app.post('/api/state/reset', (req, res) => {
    const { type } = req.body; // 'scores_only' | 'full'
    if (type === 'scores_only') {
      state.teams = state.teams.map((t) => ({
        ...t,
        score: 0,
        roundScores: { 'round-wajib': 0, 'round-lemparan': 0, 'round-rebutan': 0, 'round-final': 0 },
      }));
      state.history.unshift({
        id: 'hist-' + Date.now(),
        timestamp: Date.now(),
        action: 'reset_all',
        teamId: '',
        teamName: 'Panitia',
        delta: 0,
        prevScore: 0,
        newScore: 0,
        roundId: state.currentRoundId,
        note: 'Skor semua regu direset ke 0',
      });
    } else {
      state = loadInitialState();
    }
    state.buzzerQueue = [];
    resetTimer();
    broadcastState();
    res.json({ success: true, data: state });
  });

  // 14. Big Event Visual Alert Trigger & Dismiss
  app.post('/api/events/big-event', (req, res) => {
    const { action, type, roundId, teamId, title, subtitle } = req.body;
    if (action === 'dismiss') {
      state.bigEventOverlay = null;
      broadcastState({ type: 'BIG_EVENT_DISMISS' });
      return res.json({ success: true, bigEventOverlay: null });
    }

    const activeRound = state.rounds.find((r) => r.id === (roundId || state.currentRoundId));
    if (type === 'round_winner') {
      const winnerData = determineRoundWinner(state.teams, activeRound?.id || state.currentRoundId);
      if (winnerData) {
        state.bigEventOverlay = createBigEventOverlay('round_winner', {
          roundName: activeRound?.name || 'Babak Ini',
          team: winnerData.winner,
          roundScore: winnerData.roundScore,
          leadPoints: winnerData.lead,
          customTitle: title,
          customSubtitle: subtitle,
        });
      }
    } else if (type === 'match_champion') {
      const championData = determineMatchChampion(state.teams);
      if (championData) {
        state.bigEventOverlay = createBigEventOverlay('match_champion', {
          team: championData.champion,
          leadPoints: championData.lead,
          customTitle: title,
          customSubtitle: subtitle,
        });
      }
    } else if (type === 'timer_zero') {
      state.bigEventOverlay = createBigEventOverlay('timer_zero', {
        roundName: activeRound?.name,
        customTitle: title,
        customSubtitle: subtitle,
      });
    }

    broadcastState({ type: 'BIG_EVENT_TRIGGER', payload: state.bigEventOverlay });
    res.json({ success: true, bigEventOverlay: state.bigEventOverlay });
  });

  // 15. Competition Sessions Management
  app.get('/api/sessions', (req, res) => {
    res.json({
      success: true,
      activeSessionId: state.activeSessionId,
      sessions: state.sessions,
    });
  });

  app.post('/api/sessions/create', (req, res) => {
    const { name, stage, activateImmediately, preset } = req.body;
    state = createNewSession(state, name || 'Sesi Baru', stage || 'Penyisihan', activateImmediately ?? true, preset ?? 'preset8');
    broadcastState();
    res.json({ success: true, state });
  });

  app.post('/api/sessions/activate', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId diperlukan' });
    state = switchActiveSession(state, sessionId);
    broadcastState();
    res.json({ success: true, state });
  });

  app.post('/api/sessions/duplicate', (req, res) => {
    const { sessionId, newName } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId diperlukan' });
    state = duplicateSession(state, sessionId, newName);
    broadcastState();
    res.json({ success: true, state });
  });

  app.post('/api/sessions/delete', (req, res) => {
    const { sessionId } = req.body;
    try {
      state = deleteSession(state, sessionId);
      broadcastState();
      res.json({ success: true, state });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/sessions/update', (req, res) => {
    const { sessionId, updates } = req.body;
    const idx = state.sessions.findIndex((s) => s.id === sessionId);
    if (idx !== -1) {
      state.sessions[idx] = { ...state.sessions[idx], ...updates };
      if (state.activeSessionId === sessionId) {
        state = syncActiveSessionToTopLevel(state);
      }
      broadcastState();
      res.json({ success: true, session: state.sessions[idx], state });
    } else {
      res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
    }
  });

  // Vite integration
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Muhsin Smart Competition Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
