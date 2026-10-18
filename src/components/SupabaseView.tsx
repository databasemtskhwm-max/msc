import React, { useState } from 'react';
import type { ScoreboardState } from '../types/scoreboard.ts';
import {
  Database,
  Zap,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { isSupabaseConfiguredFromEnv } from '../utils/supabaseClient.ts';

interface SupabaseViewProps {
  state: ScoreboardState;
  onSaveConfig: (url: string, anonKey: string, autoSync: boolean) => Promise<any>;
  onTriggerSync: () => Promise<any>;
  isSyncing: boolean;
}

export const SupabaseView: React.FC<SupabaseViewProps> = ({
  state,
  onSaveConfig,
  onTriggerSync,
  isSyncing,
}) => {
  const isEnvConfigured = isSupabaseConfiguredFromEnv();
  const [url, setUrl] = useState(state.supabase?.url || '');
  const [anonKey, setAnonKey] = useState(state.supabase?.anonKey || '');
  const [autoSync, setAutoSync] = useState(
    state.supabase?.autoSync !== undefined ? state.supabase.autoSync : true
  );
  const [copiedSql, setCopiedSql] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const supabaseSqlSchema = `-- 1. Buat Tabel Penyimpanan State Skor Muhsin Smart Competition
CREATE TABLE IF NOT EXISTS msc_scoreboard_state (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS) & Beri Izin Akses Anonim (Publik)
ALTER TABLE msc_scoreboard_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses Penuh Skor MSC" ON msc_scoreboard_state;
CREATE POLICY "Akses Penuh Skor MSC" ON msc_scoreboard_state
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Aktifkan Publikasi Supabase Realtime Antar-Device (HP Juri -> TV Panggung)
ALTER PUBLICATION supabase_realtime ADD TABLE msc_scoreboard_state;`;

  const copySql = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2200);
  };

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setStatusMessage({ type: 'info', text: 'Menghubungkan ke Supabase Cloud...' });

    try {
      const res = await onSaveConfig(url.trim(), anonKey.trim(), autoSync);
      if (res && res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message || 'Koneksi ke Supabase berhasil! Realtime antar device aktif.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res?.message || 'Gagal terhubung. Pastikan URL & Anon Key sudah tepat.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error: ${err.message || 'Gagal menyimpan konfigurasi.'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isConnected = state.supabase?.isConnected;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto z-10 relative">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border-2 border-emerald-500/80 shadow-lg p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black shadow-md">
              <Database className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-emerald-950">
                  Integrasi Database & Realtime Supabase
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                  SUB-MILIDETIK
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Database cloud PostgreSQL instan dengan fitur Realtime. HP juri, panggung TV, dan laptop panitia terhubung tanpa ribet webhook atau Google Apps Script.
              </p>
            </div>
          </div>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing || !url || !anonKey}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-300' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
          </button>
        </div>

        {/* Live Status Pill Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-slate-800">
              Status Koneksi:{' '}
              <strong className={isConnected ? 'text-emerald-700' : 'text-amber-800'}>
                {isConnected
                  ? 'Terhubung & Realtime Aktif'
                  : url && anonKey
                  ? 'Menunggu Verifikasi Koneksi'
                  : 'Belum Dikonfigurasi'}
              </strong>
            </span>
          </div>

          {state.supabase?.lastSyncedAt && (
            <span className="text-[11px] font-mono text-slate-500">
              Sinkronisasi Terakhir:{' '}
              {new Date(state.supabase.lastSyncedAt).toLocaleTimeString('id-ID')}
            </span>
          )}
        </div>
      </div>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-sky-50 border-sky-300 text-sky-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Form Settings & SQL Schema */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Credentials (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-md p-6 flex flex-col justify-between">
          <form onSubmit={handleSaveAndTest} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Kredensial Supabase Proyek Anda</span>
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline"
              >
                <span>Dashboard Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {isEnvConfigured && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900 font-bold">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Kredensial otomatis terhubung dari Environment (.env / Vercel)!</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] uppercase font-black shrink-0">
                  .ENV AKTIF
                </span>
              </div>
            )}

            {/* Supabase URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                required
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Didapat dari: <em>Project Settings &gt; API &gt; Project URL</em>
              </span>
            </div>

            {/* Anon Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supabase Anon (Public) API Key
              </label>
              <textarea
                rows={3}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Didapat dari: <em>Project Settings &gt; API &gt; Project API keys &gt; anon public</em>
              </span>
            </div>

            {/* AutoSync Switch */}
            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Sinkronisasi Otomatis Realtime Antar-Perangkat
                </span>
              </label>
              <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                Setiap kali juri menambah poin atau ganti babak di HP, skor di panggung TV langsung berubah dalam hitungan milidetik.
              </p>
            </div>

            <div className="pt-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={isTesting}
                className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {isTesting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                ) : (
                  <Save className="w-4 h-4 text-amber-300" />
                )}
                <span>{isTesting ? 'Memverifikasi...' : 'Simpan & Hubungkan Database'}</span>
              </button>
            </div>
          </form>

          {/* Quick Tip */}
          <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-950 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Kelebihan Supabase:</strong> Tidak ada batas kuota ketat seperti Google Sheets, bebas masalah otorisasi/CORS, dan mendukung banyak HP juri sekaligus secara bersamaan.
            </span>
          </div>
        </div>

        {/* 1-Click SQL Schema Setup (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm text-white">Skrip SQL Siap Pakai</h3>
              </div>
              <button
                onClick={copySql}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Cukup jalankan skrip SQL ini sekali saja di menu <strong>SQL Editor</strong> Supabase Anda untuk membuat tabel otomatis dan mengaktifkan fitur Realtime:
            </p>

            <pre className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-[10.5px] font-mono text-emerald-400 overflow-x-auto leading-tight max-h-[260px] scrollbar-thin">
              {supabaseSqlSchema}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-white block">Cara pasang di Supabase:</span>
            <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
              <li>Buka proyek di <strong>supabase.com</strong></li>
              <li>Pilih menu <strong>SQL Editor</strong> &gt; klik <strong>New Query</strong></li>
              <li>Paste skrip di atas, lalu klik <strong>Run</strong></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
