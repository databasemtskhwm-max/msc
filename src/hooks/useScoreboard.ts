import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ScoreboardState,
  Team,
  Round,
  ScoreHistoryEntry,
  CompetitionSession,
  BuzzerEntry,
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
import { createBigEventOverlay, registerBuzzerPress } from '../utils/scoringLogic.ts';
import {
  getCachedLocalState,
  saveCachedLocalState,
  getCachedSheetsConfig,
  saveCachedSheetsConfig,
  fetchStateFromGoogleSheets,
  pushStateToGoogleSheets,
} from '../utils/sheetsSync.ts';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  fetchStateFromSupabase,
  saveStateToSupabase,
  broadcastStateViaSupabase,
  subscribeToSupabaseRealtime,
  testSupabaseConnection,
} from '../utils/supabaseClient.ts';

const BROADCAST_CHANNEL_NAME = 'msc_live_scoreboard_sync_v2';

export function useScoreboard() {
  const [state, setState] = useState<ScoreboardState | null>(() => {
    // 1. Try local storage cache for instant 0ms startup
    const cached = getCachedLocalState();
    if (cached) return cached;

    // 2. Default fallback session state
    const defaultSess = createDefaultSession();
    const config = getCachedSheetsConfig();
    const supabaseConfig = getStoredSupabaseConfig();
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
      supabase: supabaseConfig,
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
  const [connectionType, setConnectionType] = useState<'ws' | 'sheets' | 'supabase' | 'http' | 'local'>('local');

  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<ScoreboardState | null>(state);
  const lastTickTimeRef = useRef<number>(0);

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
            if (event.data.extra?.type === 'TIMER_TICK') {
              lastTickTimeRef.current = Date.now();
              setState((prev) => (prev ? { ...prev, timer: event.data.payload.timer } : event.data.payload));
            } else {
              setState((prev) => {
                if (
                  event.data.extra?.type === 'BUZZER_RING' &&
                  prev &&
                  (prev.isBuzzerLocked || prev.buzzerQueue.length > 0) &&
                  prev.buzzerQueue[0]?.teamId &&
                  event.data.payload?.buzzerQueue?.[0]?.teamId &&
                  prev.buzzerQueue[0].teamId !== event.data.payload.buzzerQueue[0].teamId
                ) {
                  return prev;
                }
                return event.data.payload;
              });
            }
            if (event.data.extra) {
              setLastEvent(event.data.extra);
              if (event.data.extra.type === 'BUZZER_RING') playBuzzerSound();
              else if (event.data.extra.type === 'SCORE_CHANGED') {
                if (Number(event.data.extra.delta) >= 0) playCorrectSound();
                else playWrongSound();
              } else if (event.data.extra.type === 'TIMER_END') playTimesUpSound();
              else if (event.data.extra.type === 'TIMER_TICK' && event.data.extra.secondsLeft <= 5) playTimerTick();
            }
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

  // Fetch state from server, Supabase, or Google Sheets
  const fetchState = useCallback(async () => {
    // 1. Try Supabase Cloud Database first (Instant cloud sync across devices)
    const supabaseConfig = getStoredSupabaseConfig();
    if (supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        const supabaseState = await fetchStateFromSupabase();
        if (supabaseState) {
          setState(supabaseState);
          setIsConnected(true);
          setConnectionType('supabase');
          return;
        }
      } catch (e) {
        console.warn('Supabase fetch failed, falling back:', e);
      }
    }

    // 2. Try local server first (when running locally)
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

    // 3. If running on Vercel without local server, try Google Sheets Cloud DB
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

  // Supabase Realtime Subscription (Sub-millisecond updates across all devices anywhere)
  useEffect(() => {
    const unsubscribe = subscribeToSupabaseRealtime((remoteState, extra) => {
      if (extra?.type === 'TIMER_TICK') {
        lastTickTimeRef.current = Date.now();
        setState((prev) => (prev ? { ...prev, timer: remoteState.timer } : remoteState));
      } else {
        setState((prev) => {
          if (
            extra?.type === 'BUZZER_RING' &&
            prev &&
            (prev.isBuzzerLocked || prev.buzzerQueue.length > 0) &&
            prev.buzzerQueue[0]?.teamId &&
            remoteState.buzzerQueue?.[0]?.teamId &&
            prev.buzzerQueue[0].teamId !== remoteState.buzzerQueue[0].teamId
          ) {
            return prev;
          }
          return remoteState;
        });
      }
      notifyLocalTabs(remoteState, extra);
      setIsConnected(true);
      setConnectionType((prev) => (prev === 'ws' ? 'ws' : 'supabase'));

      if (extra) {
        setLastEvent(extra);
        if (extra.type === 'BUZZER_RING') playBuzzerSound();
        else if (extra.type === 'SCORE_CHANGED') {
          if (Number(extra.delta) >= 0) playCorrectSound();
          else playWrongSound();
        } else if (extra.type === 'TIMER_END') playTimesUpSound();
        else if (extra.type === 'TIMER_TICK' && extra.secondsLeft <= 5) playTimerTick();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [notifyLocalTabs]);

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
              if (data.extra?.type === 'TIMER_TICK') {
                lastTickTimeRef.current = Date.now();
                setState((prevState) => {
                  if (!prevState) return data.payload;
                  return {
                    ...prevState,
                    timer: data.payload.timer,
                  };
                });
              } else {
                setState(data.payload);
              }

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

  // Client-side authoritative countdown interval (works standalone, Vercel, Supabase, offline)
  useEffect(() => {
    if (!state?.timer.isRunning) return;

    const interval = setInterval(() => {
      // If a tick arrived from server or remote within last 1200ms, don't double tick
      if (Date.now() - lastTickTimeRef.current < 1200) {
        return;
      }

      setState((prev) => {
        if (!prev || !prev.timer.isRunning) return prev;

        const currentSec = prev.timer.secondsLeft;
        if (currentSec <= 1) {
          // Time's up!
          playTimesUpSound();
          const currentRound = prev.rounds.find((r) => r.id === prev.currentRoundId);
          const nextState: ScoreboardState = {
            ...prev,
            timer: {
              ...prev.timer,
              secondsLeft: 0,
              isRunning: false,
            },
            isBuzzerLocked: prev.buzzerQueue.length > 0 ? prev.isBuzzerLocked : false,
            bigEventOverlay: createBigEventOverlay('timer_zero', {
              roundName: currentRound?.name || 'Babak Ini',
              customTitle: 'WAKTU HABIS!',
              customSubtitle: 'Waktu menjawab soal pada babak ini telah habis.',
            }),
            activeAnnouncement: {
              id: 'timeup-' + Date.now(),
              type: 'info',
              message: 'Waktu Habis!',
              timestamp: Date.now(),
            },
            lastUpdated: Date.now(),
          };

          // Auto-clear overlay tepat 1 detik (1000ms) di sisi client
          setTimeout(() => {
            if (stateRef.current?.bigEventOverlay?.type === 'timer_zero') {
              setState({ ...stateRef.current, bigEventOverlay: null });
            }
          }, 1000);

          lastTickTimeRef.current = Date.now();
          notifyLocalTabs(nextState, { type: 'TIMER_END' });
          if (nextState.supabase?.isConnected) {
            broadcastStateViaSupabase(nextState, { type: 'TIMER_END' });
          }
          return nextState;
        }

        const nextSec = currentSec - 1;
        if (nextSec <= 5) {
          playTimerTick();
        }

        const nextState: ScoreboardState = {
          ...prev,
          timer: {
            ...prev.timer,
            secondsLeft: nextSec,
          },
        };

        lastTickTimeRef.current = Date.now();
        notifyLocalTabs(nextState, { type: 'TIMER_TICK', secondsLeft: nextSec });
        return nextState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.timer.isRunning, state?.currentRoundId, notifyLocalTabs]);



  // Push helper that sends to Google Sheets if configured
  const triggerSheetsPushIfActive = useCallback((nextState: ScoreboardState) => {
    if (nextState.googleSheets.autoSync && nextState.googleSheets.webhookUrl) {
      pushStateToGoogleSheets(nextState.googleSheets.webhookUrl, nextState).catch(() => {});
    }
  }, []);

  // Update State & synchronize everywhere (Local Tabs + Supabase Realtime + Sheets)
  const commitStateUpdate = useCallback(
    (
      updater: (prev: ScoreboardState) => ScoreboardState,
      extraEvent?: any,
      syncSheets: boolean = true
    ) => {
      setState((prev) => {
        if (!prev) return prev;

        // Protection: If incoming event is a BUZZER_RING, but someone already buzzed in prev,
        // do not let another team hijack or overwrite the first team!
        if (extraEvent?.type === 'BUZZER_RING' && (prev.isBuzzerLocked || prev.buzzerQueue.length > 0)) {
          if (prev.buzzerQueue[0]?.teamId && prev.buzzerQueue[0].teamId !== extraEvent.teamId) {
            return prev;
          }
        }

        const updated = updater(prev);
        const withCommittedSession = syncTopLevelToActiveSession({
          ...updated,
          lastUpdated: Date.now(),
        });

        notifyLocalTabs(withCommittedSession, extraEvent);

        // Supabase Realtime Broadcast & Cloud Persistence
        const sbConfig = withCommittedSession.supabase || getStoredSupabaseConfig();
        if (sbConfig.autoSync && sbConfig.url && sbConfig.anonKey) {
          broadcastStateViaSupabase(withCommittedSession, extraEvent);
          saveStateToSupabase(withCommittedSession).catch((err) => {
            console.warn('[Supabase] background save error:', err);
          });
        }

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
        const newScore = currentTeam.score + delta;
        const roundScores = { ...currentTeam.roundScores };
        const currentRoundKey = targetRoundId || prev.currentRoundId;
        roundScores[currentRoundKey] = (roundScores[currentRoundKey] || 0) + delta;

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
        const currentRoundKey = prev.currentRoundId;
        const roundScores = { ...currentTeam.roundScores };
        roundScores[currentRoundKey] = (roundScores[currentRoundKey] || 0) + delta;

        updatedTeams[teamIndex] = {
          ...currentTeam,
          score: newScore,
          roundScores,
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
    commitStateUpdate(
      (prev) => {
        let secondsLeft = prev.timer.secondsLeft;
        let totalSeconds = prev.timer.totalSeconds;
        let isRunning = prev.timer.isRunning;

        if (action === 'start') {
          if (secondsLeft <= 0) {
            const currentRound = prev.rounds.find((r) => r.id === prev.currentRoundId);
            const defSec = currentRound?.defaultTimerSeconds || 15;
            secondsLeft = totalSeconds > 0 ? totalSeconds : defSec;
            totalSeconds = secondsLeft;
          }
          isRunning = true;
        } else if (action === 'pause') {
          isRunning = false;
        } else if (action === 'reset') {
          isRunning = false;
          const currentRound = prev.rounds.find((r) => r.id === prev.currentRoundId);
          const defSec = currentRound?.defaultTimerSeconds || 15;
          const target = seconds !== undefined ? seconds : (totalSeconds > 0 ? totalSeconds : defSec);
          secondsLeft = target;
          totalSeconds = target;
        } else if (action === 'set' && seconds !== undefined) {
          totalSeconds = seconds;
          secondsLeft = seconds;
          isRunning = false;
        } else if (action === 'adjust' && seconds !== undefined) {
          secondsLeft = Math.max(0, secondsLeft + seconds);
        }

        return {
          ...prev,
          timer: { secondsLeft, totalSeconds, isRunning },
        };
      },
      { type: 'TIMER_CONTROL', action, seconds },
      false
    );

    try {
      await fetch('/api/timer/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, seconds }),
      });
    } catch {}
  };

  const buzzIn = async (teamId: string): Promise<{ success: boolean; isFirst?: boolean; message?: string }> => {
    const currentState = stateRef.current;
    if (!currentState) {
      return { success: false, message: 'Status papan skor belum termuat' };
    }

    // STRICT CHECK: IF ALREADY LOCKED OR ALREADY BUZZED BY ANY TEAM, IMMEDIATELY BLOCK
    if (currentState.isBuzzerLocked || currentState.buzzerQueue.length > 0) {
      const winner = currentState.buzzerQueue[0];
      return {
        success: false,
        isFirst: false,
        message: winner ? `Bel sudah dikunci oleh ${winner.teamCode}!` : 'Bel saat ini terkunci',
      };
    }

    const team = currentState.teams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, message: 'Regu tidak ditemukan' };
    }

    const now = Date.now();
    const winningEntry: BuzzerEntry = {
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      color: team.color,
      timestamp: now,
      relativeMs: 0,
    };

    // 1. Play authentic cerdas cermat buzzer sound immediately
    playBuzzerSound();

    // 2. Commit optimistic update to state, BroadcastChannel, and Supabase Realtime
    commitStateUpdate(
      (prev) => {
        // Double check: if already locked or another team already pressed, DO NOT OVERWRITE!
        if (prev.isBuzzerLocked || prev.buzzerQueue.length > 0) {
          return prev;
        }

        const activeAnnouncement = {
          id: 'buzz-' + now,
          type: 'buzzer' as const,
          teamId: team.id,
          teamName: team.name,
          message: `${team.code} (${team.name}) menekan bel tercepat! Berhak menjawab.`,
          timestamp: now,
        };

        return {
          ...prev,
          isBuzzerLocked: true, // EXCLUSIVE LOCK!
          buzzerQueue: [winningEntry],
          activeAnnouncement,
        };
      },
      { type: 'BUZZER_RING', teamId, isFirst: true },
      false
    );

    // 3. Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'BUZZER_PRESS', teamId }));
      } catch {}
    } else {
      try {
        await fetch('/api/buzzer/buzz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId }),
        });
      } catch {}
    }

    return {
      success: true,
      isFirst: true,
      message: '🏆 REGU ANDA BERHAK MENJAWAB! (BEL TERCEPAT)',
    };
  };

  const resetBuzzer = async () => {
    commitStateUpdate(
      (prev) => ({
        ...prev,
        isBuzzerLocked: false, // UNLOCK so next question can be buzzed!
        buzzerQueue: [],
        activeAnnouncement: prev.activeAnnouncement?.type === 'buzzer' ? null : prev.activeAnnouncement,
      }),
      { type: 'BUZZER_RESET' },
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
      { type: 'BUZZER_LOCK', locked },
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

  const saveSupabaseConfig = async (url: string, anonKey: string, autoSync: boolean) => {
    saveStoredSupabaseConfig({ url, anonKey, autoSync });
    const test = await testSupabaseConnection(url, anonKey);
    commitStateUpdate((prev) => ({
      ...prev,
      supabase: {
        url,
        anonKey,
        autoSync,
        isConnected: test.success,
        lastSyncedAt: test.success ? Date.now() : undefined,
        lastSyncStatus: test.success ? 'connected' : 'error',
        lastSyncMessage: test.message,
      },
    }));

    if (test.success && autoSync && stateRef.current) {
      await saveStateToSupabase(stateRef.current);
      broadcastStateViaSupabase(stateRef.current, { type: 'SUPABASE_CONNECTED' });
    }

    return test;
  };

  const syncSupabase = async () => {
    setIsSyncing(true);
    try {
      if (!stateRef.current) return { success: false, message: 'State kosong' };
      const res = await saveStateToSupabase(stateRef.current);
      if (res.success) {
        broadcastStateViaSupabase(stateRef.current, { type: 'MANUAL_SYNC' });
        commitStateUpdate((prev) => ({
          ...prev,
          supabase: {
            ...(prev.supabase || getStoredSupabaseConfig()),
            isConnected: true,
            lastSyncedAt: Date.now(),
            lastSyncStatus: 'connected',
            lastSyncMessage: `Sinkronisasi berhasil pada ${new Date().toLocaleTimeString('id-ID')}`,
          },
        }));
        return { success: true, message: 'Data berhasil disinkronkan ke Supabase Cloud!' };
      }
      return { success: false, message: res.message || 'Gagal menyimpan ke Supabase.' };
    } finally {
      setIsSyncing(false);
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
      syncSupabase,
      saveSupabaseConfig,
      syncGoogleSheets,
      saveGoogleSheetsConfig,
      resetMatch,
      triggerBigEvent,
      dismissBigEvent,
      refresh: fetchState,
    },
  };
}
