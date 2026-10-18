import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { ScoreboardState, SupabaseConfig } from '../types/scoreboard.ts';

const SUPABASE_STORAGE_KEY = 'msc_supabase_config_v1';
const TABLE_NAME = 'msc_scoreboard_state';
const STATE_ROW_ID = 'active_state';
const REALTIME_CHANNEL_NAME = 'msc-live-room';

let cachedClient: SupabaseClient | null = null;
let activeRealtimeChannel: RealtimeChannel | null = null;

export function isSupabaseConfiguredFromEnv(): boolean {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim();
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(envUrl && envKey);
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim() || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim() || '';

  if (typeof window === 'undefined') {
    return {
      url: envUrl,
      anonKey: envKey,
      autoSync: Boolean(envUrl && envKey),
      isConnected: false,
      lastSyncStatus: 'idle',
    };
  }

  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const finalUrl = envUrl || parsed.url || '';
      const finalKey = envKey || parsed.anonKey || '';
      return {
        url: finalUrl,
        anonKey: finalKey,
        autoSync: parsed.autoSync !== undefined ? parsed.autoSync : Boolean(finalUrl && finalKey),
        isConnected: false,
        lastSyncStatus: 'idle',
        lastSyncMessage: parsed.lastSyncMessage || '',
      };
    }
  } catch {}

  return {
    url: envUrl,
    anonKey: envKey,
    autoSync: Boolean(envUrl && envKey),
    isConnected: false,
    lastSyncStatus: 'idle',
    lastSyncMessage: '',
  };
}

export function saveStoredSupabaseConfig(config: Partial<SupabaseConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredSupabaseConfig();
    const updated = { ...existing, ...config };
    localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(updated));
    // Reset cached client if credentials changed
    if (config.url !== undefined || config.anonKey !== undefined) {
      cachedClient = null;
      if (activeRealtimeChannel) {
        activeRealtimeChannel.unsubscribe();
        activeRealtimeChannel = null;
      }
    }
  } catch {}
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  try {
    const cleanUrl = config.url.trim().replace(/\/+$/, '');
    const cleanKey = config.anonKey.trim();
    if (!cleanUrl.startsWith('http')) return null;

    cachedClient = createClient(cleanUrl, cleanKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

/**
 * Test connectivity to Supabase and verify the table exists
 */
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string; hasTable: boolean }> {
  const url = customUrl || getStoredSupabaseConfig().url;
  const anonKey = customKey || getStoredSupabaseConfig().anonKey;

  if (!url || !anonKey) {
    return {
      success: false,
      message: 'Supabase URL dan Anon Key belum diisi.',
      hasTable: false,
    };
  }

  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const testClient = createClient(cleanUrl, anonKey.trim(), {
      auth: { persistSession: false },
    });

    // Check table existence by reading active_state
    const { data, error } = await testClient
      .from(TABLE_NAME)
      .select('id, updated_at')
      .eq('id', STATE_ROW_ID)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        // Table does not exist
        return {
          success: true,
          message: 'Terkoneksi ke Supabase, namun tabel belum dibuat. Silakan jalankan Skrip SQL di bawah.',
          hasTable: false,
        };
      }
      return {
        success: false,
        message: `Supabase error (${error.code}): ${error.message}`,
        hasTable: false,
      };
    }

    return {
      success: true,
      message: 'Berhasil terhubung ke Supabase Database & Realtime!',
      hasTable: true,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungkan ke Supabase: ${err.message || 'Network error'}`,
      hasTable: false,
    };
  }
}

/**
 * Fetch latest full scoreboard state from Supabase PostgreSQL
 */
export async function fetchStateFromSupabase(): Promise<ScoreboardState | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('state, updated_at')
      .eq('id', STATE_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.state) {
      return null;
    }

    return data.state as ScoreboardState;
  } catch (err) {
    console.warn('[Supabase] fetchState error:', err);
    return null;
  }
}

/**
 * Save state into Supabase PostgreSQL (upsert)
 */
export async function saveStateToSupabase(
  state: ScoreboardState
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client belum dikonfigurasi.' };
  }

  try {
    const nowIso = new Date().toISOString();
    const { error } = await client.from(TABLE_NAME).upsert(
      {
        id: STATE_ROW_ID,
        state: state,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' };
  }
}

/**
 * Broadcast instantaneous state changes across all devices via Supabase Realtime Channel
 */
export function broadcastStateViaSupabase(
  state: ScoreboardState,
  extraEvent?: any
): void {
  const client = getSupabaseClient();
  if (!client || !activeRealtimeChannel) return;

  try {
    activeRealtimeChannel.send({
      type: 'broadcast',
      event: 'STATE_UPDATE',
      payload: {
        state,
        extra: extraEvent,
        sentAt: Date.now(),
      },
    });
  } catch (err) {
    console.warn('[Supabase Realtime] broadcast error:', err);
  }
}

/**
 * Subscribe to Supabase Realtime broadcast and PostgreSQL change streams
 */
export function subscribeToSupabaseRealtime(
  onStateReceived: (newState: ScoreboardState, extraEvent?: any) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  try {
    if (activeRealtimeChannel) {
      activeRealtimeChannel.unsubscribe();
      activeRealtimeChannel = null;
    }

    const channel = client.channel(REALTIME_CHANNEL_NAME);
    activeRealtimeChannel = channel;

    // 1. Listen for ultra-low latency broadcast events (HP juri -> TV panggung in milliseconds)
    channel.on('broadcast', { event: 'STATE_UPDATE' }, (payload: any) => {
      if (payload?.payload?.state) {
        onStateReceived(payload.payload.state, payload.payload.extra);
      }
    });

    // 2. Listen for Postgres CDC table changes (backup sync if any device performs direct DB upsert)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE_NAME,
        filter: `id=eq.${STATE_ROW_ID}`,
      },
      (payload: any) => {
        if (payload?.new?.state) {
          onStateReceived(payload.new.state as ScoreboardState);
        }
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Connected to Realtime room
      }
    });

    return () => {
      try {
        channel.unsubscribe();
      } catch {}
      if (activeRealtimeChannel === channel) {
        activeRealtimeChannel = null;
      }
    };
  } catch (err) {
    console.warn('[Supabase Realtime] subscribe error:', err);
    return () => {};
  }
}
