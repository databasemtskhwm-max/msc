import type { ScoreboardState } from '../types/scoreboard.ts';
import { prepareComprehensiveSheetsPayload } from './sessionLogic.ts';

const LOCAL_STORAGE_KEY = 'msc_live_scoreboard_state_v2';
const SHEETS_CONFIG_KEY = 'msc_sheets_config_v2';

export function getCachedLocalState(): ScoreboardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.teams && parsed.sessions) {
      return parsed;
    }
  } catch (err) {
    console.warn('[Cache] Gagal membaca state lokal:', err);
  }
  return null;
}

export function saveCachedLocalState(state: ScoreboardState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[Cache] Gagal menyimpan state lokal:', err);
  }
}

export function getCachedSheetsConfig(): { webhookUrl: string; sheetId: string; autoSync: boolean } {
  if (typeof window === 'undefined') {
    return { webhookUrl: '', sheetId: '', autoSync: false };
  }
  try {
    const raw = localStorage.getItem(SHEETS_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { webhookUrl: '', sheetId: '', autoSync: false };
}

export function saveCachedSheetsConfig(config: { webhookUrl: string; sheetId: string; autoSync: boolean }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

/**
 * Fetch full state directly from Google Sheets Webhook (doGet)
 * Used when running on Vercel or when multiple devices need to sync
 */
export async function fetchStateFromGoogleSheets(webhookUrl: string): Promise<ScoreboardState | null> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) return null;

  // 1. Try server proxy first (100% bypasses browser CORS restrictions)
  try {
    const proxyUrl = `/api/sheets/proxy?url=${encodeURIComponent(webhookUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.hasData && json.state) {
        return json.state as ScoreboardState;
      }
    }
  } catch {}

  // 2. Direct browser fetch
  try {
    const res = await fetch(webhookUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.hasData && json.state) {
        return json.state as ScoreboardState;
      }
    }
  } catch {}

  return null;
}

/**
 * Push full state directly to Google Sheets Webhook (doPost)
 * Used both by local server and directly from browser on Vercel
 */
export async function pushStateToGoogleSheets(
  webhookUrl: string,
  state: ScoreboardState
): Promise<{ success: boolean; message?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'Webhook URL belum diisi' };
  }

  try {
    const payload = prepareComprehensiveSheetsPayload(state);
    
    // We send payload as JSON text
    // Using fetch with standard POST
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      mode: 'no-cors', // Ensures zero CORS blocking across any domain/Vercel
    });

    return { success: true, message: 'Terkirim ke Google Sheets' };
  } catch (err: any) {
    console.warn('[Sheets] Gagal kirim ke Google Sheets:', err);
    return { success: false, message: err.message };
  }
}
