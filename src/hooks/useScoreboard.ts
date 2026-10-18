import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ScoreboardState,
  Team,
  Round,
  ScoreHistoryEntry,
  CompetitionSession,
} from '../types/scoreboard.ts';
import {
  playBuzzerSound,
  playCorrectSound,
  playWrongSound,
  playTimerTick,
  playTimesUpSound,
} from '../utils/audio.ts';
import {
  createDefaultSession,
  syncActiveSessionToTopLevel,
  syncTopLevelToActiveSession,
  switchActiveSession,
  createNewSession,
  duplicateSession,
  deleteSession,
} from '../utils/sessionLogic.ts';
import {
  getCachedLocalState,
  saveCachedLocalState,
  getCachedSheetsConfig,
  saveCachedSheetsConfig,
  fetchStateFromGoogleSheets,
  pushStateToGoogleSheets,
} from '../utils/sheetsSync.ts';

const BROADCAST_CHANNEL_NAME = 'msc_live_scoreboard_sync_v2';

export function useScoreboard() {
  const [state, setState] = useState<ScoreboardState | null>(() => {
    // 1. Try local storage cache for instant 0ms startup
    const cached = getCachedLocalState();
    if (cached) return cached;

    // 2. Default fallback session state
    const defaultSess = createDefaultSession();
    const config = getCachedSheetsConfig();
    return {
      competitionTitle: 'MUHSIN SMART COMPETITION 2026',
      competitionSubtitle: 'Lomba Cerdas Cermat - Tingkat Pelajar & Santri',
      seasonOrYear: 'Tahun 2026 / 1447 H',
      activeSessionId: defaultSess.id,
      sessions: [defaultSess],
      currentRoundId: defaultSess.currentRoundId,
      rounds: defaultSess.rounds,
      teams: defaultSess.teams,
      timer: defaultSess.timer,
      buzzerQueue: defaultSess.buzzerQueue,
      isBuzzerLocked: defaultSess.isBuzzerLocked,
      currentQuestionIndex: 1,
      history: defaultSess.history,
      googleSheets: {
        webhookUrl: config.webhookUrl,
        sheetId: config.sheetId,
        autoSync: config.autoSync,
        lastSyncStatus: 'idle',
        lastSyncMessage: 'Belum ada sinkronisasi Google Sheet yang dikonfigurasi.',
      },
      apiAccessKey: 'MSC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      activeAnnouncement: null,
      bigEventOverlay: null,
      lastUpdated: Date.now(),
    };
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [connectionType, setConnectionType] = useState<'ws' | 'sheets' | 'http' | 'local'>('local');

  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<ScoreboardState | null>(state);

  // Keep stateRef synchronized
  useEffect(() => {
    stateRef.current = state;
    if (state) {
      saveCachedLocalState(state);
    }
  }, [state]);

  // Broadcast channel for instantaneous tab-to-tab sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'LOCAL_STATE_UPDATE') {
            setState(event.data.payload);
            setConnectionType((prev) => (prev === 'ws' ? 'ws' : 'local'));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or error:', e);
      }
    }

    return () => {
      try {
        channelRef.current?.close();
      } catch {}
      channelRef.current = null;
    };
  }, []);

  const notifyLocalTabs = useCallback((nextState: ScoreboardState, extra?: any) => {
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({
          type: 'LOCAL_STATE_UPDATE',
          payload: nextState,
          extra,
        });
      } catch {}
    }
  }, []);

  // Fetch state from server or Google Sheets
  const fetchState = useCallback(async () => {
    // 1. Try local server first (when running locally)
    try {
      const res = await fetch('/api/scoreboard');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setState(json.data);
          setIsConnected(true);
          setConnectionType('http');
          return;
        }
      }
    } catch {
      // Local server not available (e.g., deployed on Vercel)
    }

    // 2. If running on Vercel without local server, try Google Sheets Cloud DB
    const currentWebhook = stateRef.current?.googleSheets?.webhookUrl || getCachedSheetsConfig().webhookUrl;
    if (currentWebhook) {
      const sheetsState = await fetchStateFromGoogleSheets(currentWebhook);
      if (sheetsState) {
        setState(sheetsState);
        setIsConnected(true);
        setConnectionType('sheets');
      }
    }
  }, []);

  // WebSocket connection logic (for local development)
  useEffect(() => {
    fetchState();

    function connectWs() {
      if (typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setConnectionType('ws');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'STATE_UPDATE' && data.payload) {
              setState((prevState) => {
                if (
                  prevState &&
                  data.extra?.type === 'TIMER_TICK' &&
                  prevState.lastUpdated === data.payload.lastUpdated
                ) {
                  return {
                    ...prevState,
                    timer: data.payload.timer,
                  };
                }
                return data.payload;
              });

              if (data.extra?.type !== 'TIMER_TICK') {
                notifyLocalTabs(data.payload, data.extra);
              }

              // Sound effects
              if (data.extra) {
                setLastEvent(data.extra);
                if (data.extra.type === 'BUZZER_RING') {
                  playBuzzerSound();
                } else if (data.extra.type === 'SCORE_CHANGED') {
                  if (Number(data.extra.delta) >= 0) {
                    playCorrectSound();
                  } else {
                    playWrongSound();
                  }
                } else if (data.extra.type === 'TIMER_END') {
                  playTimesUpSound();
                } else if (data.extra.type === 'TIMER_TICK' && data.extra.secondsLeft <= 5) {
                  playTimerTick();
                }
              }
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Try reconnecting after 3 seconds
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        // WS connection failed (e.g. running on Vercel without persistent WS)
      }
    }

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchState, notifyLocalTabs]);



  // Push helper that sends to Google Sheets if configured
  const triggerSheetsPushIfActive = useCallback((nextState: ScoreboardState) => {
    if (nextState.googleSheets.autoSync && nextState.googleSheets.webhookUrl) {
      pushStateToGoogleSheets(nextState.googleSheets.webhookUrl, nextState).catch(() => {});
    }
  }, []);

  // Update State & synchronize everywhere
  const commitStateUpdate = useCallback(
    (
      updater: (prev: ScoreboardState) => ScoreboardState,
      extraEvent?: any,
      syncSheets: boolean = true
    ) => {
      setState((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        const withCommittedSession = syncTopLevelToActiveSession({
          ...updated,
          lastUpdated: Date.now(),
        });

        notifyLocalTabs(withCommittedSession, extraEvent);
        if (syncSheets && connectionType !== 'ws') {
          triggerSheetsPushIfActive(withCommittedSession);
        }
        return withCommittedSession;
      });
    },
    [notifyLocalTabs, triggerSheetsPushIfActive, connectionType]
  );

  // Actions
  const addScore = async (teamId: string, delta: number, note?: string, targetRoundId?: string) => {
    // 1. Optimistic local update
    commitStateUpdate(
      (prev) => {
        const teamIndex = prev.teams.findIndex((t) => t.id === teamId);
        if (teamIndex === -1) return prev;

        const updatedTeams = [...prev.teams];
        const currentTeam = updatedTeams[teamIndex];
        const newScore = Math.max(0, currentTeam.score + delta);
        const roundScores = { ...currentTeam.roundScores };
        const currentRoundKey = targetRoundId || prev.currentRoundId;
        roundScores[currentRoundKey] = Math.max(0, (roundScores[currentRoundKey] || 0) + delta);

        updatedTeams[teamIndex] = {
          ...currentTeam,
          score: newScore,
          roundScores,
        };

        const newHistoryEntry: ScoreHistoryEntry = {
          id: `hist-${Date.now()}`,
          timestamp: Date.now(),
          action: delta >= 0 ? 'score_add' : 'score_deduct',
          teamId,
          teamName: currentTeam.name,
          delta,
          prevScore: currentTeam.score,
          newScore,
          roundId: currentRoundKey,
          note: note || (delta >= 0 ? `+${delta} poin` : `${delta} poin`),
        };

        return {
          ...prev,
          teams: updatedTeams,
          history: [newHistoryEntry, ...prev.history.slice(0, 99)],
        };
      },
      { type: 'SCORE_CHANGED', delta, teamId }
    );

    // 2. Local server sync if available
    try {
      await fetch('/api/scores/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, delta, note, roundId: targetRoundId }),
      });
    } catch {}
  };

  const overrideScore = async (teamId: string, newScore: number, note?: string) => {
    commitStateUpdate(
      (prev) => {
        const teamIndex = prev.teams.findIndex((t) => t.id === teamId);
        if (teamIndex === -1) return prev;

        const updatedTeams = [...prev.teams];
        const currentTeam = updatedTeams[teamIndex];
        const delta = newScore - currentTeam.score;

        updatedTeams[teamIndex] = {
          ...currentTeam,
          score: newScore,
        };

        const newHistoryEntry: ScoreHistoryEntry = {
          id: `hist-${Date.now()}`,
          timestamp: Date.now(),
          action: 'score_override',
          teamId,
          teamName: currentTeam.name,
          delta,
          prevScore: currentTeam.score,
          newScore,
          roundId: prev.currentRoundId,
          note: note || `Koreksi skor manual: ${newScore}`,
        };

        return {
          ...prev,
          teams: updatedTeams,
          history: [newHistoryEntry, ...prev.history.slice(0, 99)],
        };
      },
      { type: 'SCORE_OVERRIDE', teamId, newScore }
    );

    try {
      await fetch('/api/score/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, newScore, note }),
      });
    } catch {}
  };

  const controlTimer = async (
    action: 'start' | 'pause' | 'reset' | 'set' | 'adjust',
    seconds?: number
  ) => {
    commitStateUpdate((prev) => {
      let secondsLeft = prev.timer.secondsLeft;
      let totalSeconds = prev.timer.totalSeconds;
      let isRunning = prev.timer.isRunning;

      if (action === 'start') {
        isRunning = true;
      } else if (action === 'pause') {
        isRunning = false;
      } else if (action === 'reset') {
        isRunning = false;
        secondsLeft = totalSeconds;
      } else if (action === 'set' && seconds !== undefined) {
        totalSeconds = seconds;
        secondsLeft = seconds;
      }

      return {
        ...prev,
        timer: { secondsLeft, totalSeconds, isRunning },
      };
    }, undefined, false);

    try {
      await fetch('/api/timer/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, seconds }),
      });
    } catch {}
  };

  const buzzIn = async (teamId: string) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'BUZZER_PRESS', teamId }));
      } else {
        await fetch('/api/buzzer/buzz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetBuzzer = async () => {
    commitStateUpdate(
      (prev) => ({
        ...prev,
        buzzerQueue: [],
      }),
      undefined,
      false
    );

    try {
      await fetch('/api/buzzer/reset', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleBuzzerLock = async (locked: boolean) => {
    commitStateUpdate(
      (prev) => ({
        ...prev,
        isBuzzerLocked: locked,
      }),
      undefined,
      false
    );

    try {
      await fetch('/api/buzzer/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const switchRound = async (roundId: string) => {
    setIsSyncing(true);
    commitStateUpdate((prev) => {
      const selectedRound = prev.rounds.find((r) => r.id === roundId);
      const defaultSec = selectedRound?.defaultTimerSeconds || 15;
      return {
        ...prev,
        currentRoundId: roundId,
        timer: {
          secondsLeft: defaultSec,
          totalSeconds: defaultSec,
          isRunning: false,
        },
      };
    });

    try {
      const res = await fetch('/api/rounds/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const data = await res.json();
      if (data.data) setState(data.data);
    } catch {} finally {
      setIsSyncing(false);
    }
  };

  const manageTeam = async (
    action: 'add' | 'update' | 'delete' | 'preset8',
    team?: Partial<Team>
  ) => {
    commitStateUpdate((prev) => {
      let updatedTeams = [...prev.teams];
      if (action === 'update' && team?.id) {
        const idx = updatedTeams.findIndex((t) => t.id === team.id);
        if (idx !== -1) {
          updatedTeams[idx] = { ...updatedTeams[idx], ...team } as Team;
        }
      } else if (action === 'delete' && team?.id) {
        if (updatedTeams.length > 2) {
          updatedTeams = updatedTeams.filter((t) => t.id !== team.id);
        }
      }
      return {
        ...prev,
        teams: updatedTeams,
      };
    });

    try {
      const res = await fetch('/api/teams/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, team }),
      });
      const data = await res.json();
      if (data.teams && stateRef.current) {
        commitStateUpdate((prev) => ({ ...prev, teams: data.teams }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const manageRound = async (
    action: 'add' | 'update' | 'delete' | 'reset_default',
    round?: any,
    roundId?: string
  ) => {
    try {
      const res = await fetch('/api/rounds/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, round, roundId }),
      });
      const data = await res.json();
      if (data.rounds && stateRef.current) {
        commitStateUpdate((prev) => ({ ...prev, rounds: data.rounds }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // SESSIONS MANAGEMENT ACTIONS
  const createSession = async (
    name: string,
    stage: string = 'Penyisihan',
    activateImmediately: boolean = true,
    preset: 'preset8' | 'initial4' | 'empty' = 'preset8'
  ) => {
    commitStateUpdate((prev) =>
      createNewSession(prev, name, stage, activateImmediately, preset)
    );

    try {
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stage, activateImmediately, preset }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      return data;
    } catch {}
  };

  const activateSession = async (sessionId: string) => {
    commitStateUpdate((prev) => switchActiveSession(prev, sessionId));

    try {
      const res = await fetch('/api/sessions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      return data;
    } catch {}
  };

  const duplicateSessionAction = async (sessionId: string, newName?: string) => {
    commitStateUpdate((prev) => duplicateSession(prev, sessionId, newName || 'Salinan Sesi'));

    try {
      const res = await fetch('/api/sessions/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newName }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      return data;
    } catch {}
  };

  const deleteSessionAction = async (sessionId: string) => {
    commitStateUpdate((prev) => deleteSession(prev, sessionId));

    try {
      const res = await fetch('/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      return data;
    } catch {}
  };

  const updateSessionAction = async (sessionId: string, updates: Partial<CompetitionSession>) => {
    commitStateUpdate((prev) => {
      const updatedSessions = prev.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...updates } : s
      );
      const next = { ...prev, sessions: updatedSessions };
      return prev.activeSessionId === sessionId ? syncActiveSessionToTopLevel(next) : next;
    });

    try {
      await fetch('/api/sessions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, updates }),
      });
    } catch {}
  };

  // Google Sheets config & sync
  const syncGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      // 1. Try local server first
      try {
        const res = await fetch('/api/sheets/sync', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.googleSheets && stateRef.current) {
            setState({ ...stateRef.current, googleSheets: data.googleSheets });
          }
          return data;
        }
      } catch {}

      // 2. Direct browser push (e.g. on Vercel)
      if (stateRef.current && stateRef.current.googleSheets.webhookUrl) {
        const pushRes = await pushStateToGoogleSheets(
          stateRef.current.googleSheets.webhookUrl,
          stateRef.current
        );
        if (pushRes.success) {
          commitStateUpdate((prev) => ({
            ...prev,
            googleSheets: {
              ...prev.googleSheets,
              lastSyncStatus: 'success',
              lastSyncedAt: Date.now(),
              lastSyncMessage: `Tersinkron ke Google Sheets pada ${new Date().toLocaleTimeString('id-ID')}`,
            },
          }));
        }
        return pushRes;
      }
      return { success: false, error: 'Webhook URL belum diisi' };
    } finally {
      setIsSyncing(false);
    }
  };

  const saveGoogleSheetsConfig = async (webhookUrl: string, sheetId: string, autoSync: boolean) => {
    setIsSyncing(true);
    saveCachedSheetsConfig({ webhookUrl, sheetId, autoSync });

    commitStateUpdate((prev) => ({
      ...prev,
      googleSheets: {
        ...prev.googleSheets,
        webhookUrl: webhookUrl.trim(),
        sheetId: sheetId.trim(),
        autoSync: Boolean(autoSync),
      },
    }));

    try {
      // Also notify local server if available
      try {
        await fetch('/api/sheets/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl, sheetId, autoSync }),
        });
      } catch {}

      // Push initial sync test to Google Sheets
      if (webhookUrl && webhookUrl.startsWith('http')) {
        if (stateRef.current) {
          await pushStateToGoogleSheets(webhookUrl, stateRef.current);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Scoreboard] Gagal menyimpan konfigurasi Google Sheets:', err);
      return { success: false, error: err.message || 'Gagal terhubung ke Google Sheets' };
    } finally {
      setIsSyncing(false);
    }
  };

  const resetMatch = async (type: 'scores_only' | 'full') => {
    setIsSyncing(true);
    commitStateUpdate((prev) => {
      if (type === 'scores_only') {
        const resetTeams = prev.teams.map((t) => ({
          ...t,
          score: 0,
          roundScores: { 'round-wajib': 0, 'round-penawaran': 0, 'round-rebutan': 0, 'round-final': 0 },
        }));
        return {
          ...prev,
          teams: resetTeams,
          buzzerQueue: [],
          timer: { ...prev.timer, isRunning: false, secondsLeft: prev.timer.totalSeconds },
          history: [
            {
              id: `hist-${Date.now()}`,
              timestamp: Date.now(),
              action: 'reset_all',
              teamId: '',
              teamName: 'Panitia',
              delta: 0,
              prevScore: 0,
              newScore: 0,
              roundId: prev.currentRoundId,
              note: 'Skor semua regu direset ke 0',
            },
            ...prev.history,
          ],
        };
      }
      return prev;
    });

    try {
      await fetch('/api/state/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
    } catch {} finally {
      setIsSyncing(false);
    }
  };

  const triggerBigEvent = async (
    type: 'timer_zero' | 'round_winner' | 'match_champion',
    options?: { roundId?: string; teamId?: string; title?: string; subtitle?: string }
  ) => {
    try {
      const res = await fetch('/api/events/big-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', type, ...options }),
      });
      const data = await res.json();
      if (data.bigEventOverlay && stateRef.current) {
        setState({ ...stateRef.current, bigEventOverlay: data.bigEventOverlay });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const dismissBigEvent = async () => {
    if (stateRef.current) {
      setState({ ...stateRef.current, bigEventOverlay: null });
    }
    try {
      await fetch('/api/events/big-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return {
    state,
    isConnected,
    isSyncing,
    lastEvent,
    connectionType,
    actions: {
      addScore,
      overrideScore,
      controlTimer,
      buzzIn,
      resetBuzzer,
      toggleBuzzerLock,
      switchRound,
      manageTeam,
      manageRound,
      createSession,
      activateSession,
      duplicateSession: duplicateSessionAction,
      deleteSession: deleteSessionAction,
      updateSession: updateSessionAction,
      syncGoogleSheets,
      saveGoogleSheetsConfig,
      resetMatch,
      triggerBigEvent,
      dismissBigEvent,
      refresh: fetchState,
    },
  };
}
