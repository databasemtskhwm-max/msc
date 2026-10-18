import React, { useState } from 'react';
import type { ScoreboardState } from '../types/scoreboard.ts';
import {
  Sheet,
  CloudCheck,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Lock,
} from 'lucide-react';

interface GoogleSheetsViewProps {
  state: ScoreboardState;
  onSaveConfig: (webhookUrl: string, sheetId: string, autoSync: boolean) => Promise<any>;
  onTriggerSync: () => Promise<any>;
  isSyncing: boolean;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  state,
  onSaveConfig,
  onTriggerSync,
  isSyncing,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(state.googleSheets.webhookUrl || '');
  const [sheetId, setSheetId] = useState(state.googleSheets.sheetId || '');
  const [autoSync, setAutoSync] = useState(state.googleSheets.autoSync);
  const [copiedScript, setCopiedScript] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const googleAppsScriptCode = `/**
 * Google Apps Script untuk Muhsin Smart Competition (Database Cloud Penuh)
 * 1. Buka Google Sheets baru di https://sheets.new
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'
 * 3. Hapus semua kode yang ada, tempel seluruh kode ini
 * 4. Klik tombol 'Deploy' (Terapkan) berwarna biru di kanan atas > 'New deployment' (Deployment baru)
 * 5. Pilih jenis: 'Web app' (Aplikasi web)
 * 6. Setel:
 *    - Execute as (Jalankan sebagai): 'Me' (Saya)
 *    - Who has access (Siapa yang memiliki akses): 'Anyone' (Siapa saja)
 * 7. Klik 'Deploy' lalu izinkan akses Google Account
 * 8. Salin 'Web app URL' (akhiran /exec) dan tempel di formulir aplikasi Muhsin Smart Competition!
 */

// 1. ENDPOINT GET: Membaca Database Cloud untuk sinkronisasi antar-device (HP, Laptop, TV)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    var dbSheet = sheet.getSheetByName("Database Backup MSC");
    var stateJson = null;
    if (dbSheet && dbSheet.getLastRow() >= 1) {
      stateJson = dbSheet.getRange(1, 1).getValue();
    }
    
    var result = {
      status: "success",
      hasData: Boolean(stateJson),
      state: stateJson ? JSON.parse(stateJson) : null,
      serverTime: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. ENDPOINT POST: Menyimpan Skor, Sesi Lomba, dan Nama Regu ke Spreadsheet
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    
    var payloadContent = (e && e.postData && e.postData.contents)
      ? e.postData.contents
      : JSON.stringify({
          activeSession: { name: "Babak Penyisihan - Sesi 1", stage: "Penyisihan" },
          teams: [
            { rank: 1, code: "Regu A", name: "SMA Al-Muhsin Putra", totalScore: 200, roundScores: { "round-wajib": 100, "round-lemparan": 0, "round-penawaran": 100, "round-rebutan": 0 } },
            { rank: 2, code: "Regu B", name: "SMA Al-Muhsin Putri", totalScore: 100, roundScores: { "round-wajib": 100, "round-lemparan": 0, "round-penawaran": 0, "round-rebutan": 0 } }
          ],
          sessionsList: [
            { id: "session-penyisihan-1", name: "Babak Penyisihan - Sesi 1", stage: "Penyisihan", status: "active", teamCount: 8, createdAt: new Date().toLocaleString("id-ID") }
          ],
          recentAudit: [
            { time: new Date().toLocaleTimeString("id-ID"), team: "Regu A", delta: "+100", newScore: 200, note: "Tes sinkronisasi sistem" }
          ],
          fullStateJson: "{}"
        });

    var data = JSON.parse(payloadContent);
    var sessionName = (data.activeSession && data.activeSession.name) ? data.activeSession.name : "Sesi Utama";
    
    // TAB 1: Peringkat & Skor (Sesi Aktif)
    var leaderboardSheet = sheet.getSheetByName("Peringkat & Skor (Sesi Aktif)");
    if (!leaderboardSheet) {
      leaderboardSheet = sheet.insertSheet("Peringkat & Skor (Sesi Aktif)");
      leaderboardSheet.appendRow([
        "Peringkat",
        "Sesi Lomba",
        "Kode Regu",
        "Nama Sekolah / Tim",
        "Total Skor",
        "Babak Wajib",
        "Babak Lemparan",
        "Babak Penawaran",
        "Babak Rebutan",
        "Terakhir Diperbarui"
      ]);
      leaderboardSheet.getRange("A1:J1")
        .setFontWeight("bold")
        .setBackground("#064e3b")
        .setFontColor("#ffffff");
    }
    
    var lastRow = leaderboardSheet.getLastRow();
    if (lastRow > 1) {
      leaderboardSheet.getRange(2, 1, lastRow - 1, 10).clearContent();
    }
    
    if (data.teams && data.teams.length > 0) {
      var rows = data.teams.map(function(t) {
        return [
          t.rank,
          sessionName,
          t.code,
          t.name,
          t.totalScore,
          (t.roundScores && t.roundScores["round-wajib"]) || 0,
          (t.roundScores && t.roundScores["round-lemparan"]) || 0,
          (t.roundScores && t.roundScores["round-penawaran"]) || 0,
          (t.roundScores && t.roundScores["round-rebutan"]) || 0,
          new Date().toLocaleString("id-ID")
        ];
      });
      leaderboardSheet.getRange(2, 1, rows.length, 10).setValues(rows);
    }
    
    // TAB 2: Daftar Sesi Lomba
    if (data.sessionsList && data.sessionsList.length > 0) {
      var sessionSheet = sheet.getSheetByName("Daftar Sesi Lomba");
      if (!sessionSheet) {
        sessionSheet = sheet.insertSheet("Daftar Sesi Lomba");
        sessionSheet.appendRow(["ID Sesi", "Nama Sesi Lomba", "Kategori / Babak", "Status", "Jumlah Regu", "Waktu Dibuat"]);
        sessionSheet.getRange("A1:F1")
          .setFontWeight("bold")
          .setBackground("#1e293b")
          .setFontColor("#ffffff");
      }
      var sLastRow = sessionSheet.getLastRow();
      if (sLastRow > 1) {
        sessionSheet.getRange(2, 1, sLastRow - 1, 6).clearContent();
      }
      var sRows = data.sessionsList.map(function(s) {
        return [s.id, s.name, s.stage, s.status.toUpperCase(), s.teamCount, s.createdAt];
      });
      sessionSheet.getRange(2, 1, sRows.length, 6).setValues(sRows);
    }

    // TAB 3: Log Riwayat Audit Nilai Juri
    var logSheet = sheet.getSheetByName("Log Riwayat Juri");
    if (!logSheet) {
      logSheet = sheet.insertSheet("Log Riwayat Juri");
      logSheet.appendRow(["Waktu", "Sesi", "Regu", "Perubahan Skor", "Skor Akhir", "Keterangan"]);
      logSheet.getRange("A1:F1")
        .setFontWeight("bold")
        .setBackground("#f59e0b")
        .setFontColor("#000000");
    }
    
    if (data.recentAudit && data.recentAudit.length > 0) {
      var latest = data.recentAudit[0];
      logSheet.appendRow([latest.time, sessionName, latest.team, latest.delta, latest.newScore, latest.note]);
    }

    // TAB 4: Database Backup MSC (Penyimpanan JSON untuk Restore Otomatis)
    if (data.fullStateJson) {
      var dbSheet = sheet.getSheetByName("Database Backup MSC");
      if (!dbSheet) {
        dbSheet = sheet.insertSheet("Database Backup MSC");
      }
      dbSheet.getRange(1, 1).setValue(data.fullStateJson);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data sesi, regu, dan skor berhasil disimpan di Spreadsheet!",
      receivedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi tes manual untuk tombol 'Jalankan' di Apps Script
function testManual() {
  doPost();
  doGet();
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSaveConfig(webhookUrl, sheetId, autoSync);
    if (res && res.success === false) {
      alert('Gagal menyimpan ke server: ' + (res.error || 'Periksa koneksi server.'));
    } else {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto z-10 relative">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-lg p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-black shadow-md">
              <Sheet className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-emerald-950">
                  Integrasi Google Sheets Cloud Database
                </h2>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full">
                  LIVE & AMAN
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Data skor kompetisi langsung tersimpan secara otomatis dan terpusat di spreadsheet Google Drive panitia.
              </p>
            </div>
          </div>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-[#064e3b] hover:bg-[#065f46] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
          </button>
        </div>

        {/* Security & Reliability Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Zero-Latency Display</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Layar panggung tetap secepat kilat (&lt;5ms) melalui WebSocket lokal tanpa terpengaruh kecepatan internet Google Drive.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
            <div className="font-bold text-amber-950 flex items-center gap-1.5 mb-1">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>Keamanan Hak Akses</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Input nilai hanya dapat dilakukan juri ber-PIN, mencegah manipulasi dari pihak yang tidak berwenang.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
              <Sheet className="w-4 h-4 text-emerald-700" />
              <span>Siap Dibagikan (Shareable)</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Link spreadsheet dapat dibagikan kepada dewan juri kehormatan, pimpinan madrasah, atau kepala sekolah secara <em>View Only</em>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Webhook Form */}
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-lg p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-emerald-950 mb-1 flex items-center gap-2">
              <CloudCheck className="w-5 h-5 text-emerald-700" />
              <span>Formulir Webhook Google Sheets</span>
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Tempelkan Webhook Web App URL dari Google Apps Script untuk menghubungkan spreadsheet ke aplikasi skoring.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Google Apps Script Web App URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:border-amber-500 focus:outline-none transition shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Google Spreadsheet ID (Opsional / Referensi Panitia)
                </label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:border-amber-500 focus:outline-none transition shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="autoSync" className="text-xs text-slate-800 font-bold cursor-pointer">
                  Sinkronisasi Otomatis Setiap Nilai Berubah (Auto-Sync Real-Time)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan Google Sheets</span>
              </button>

              {savedSuccess && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 p-2.5 rounded-xl text-center font-bold">
                  ✓ Pengaturan berhasil disimpan ke cloud server!
                </div>
              )}
            </form>
          </div>

          {/* Status Box */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px] block mb-1">
              Status Sinkronisasi Terkini:
            </span>
            <div className="flex items-center gap-2 font-mono">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  state.googleSheets.lastSyncStatus === 'success'
                    ? 'bg-emerald-500'
                    : state.googleSheets.lastSyncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : state.googleSheets.lastSyncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-slate-800 font-bold">
                {state.googleSheets.lastSyncMessage || 'Siap digunakan'}
              </span>
            </div>
            {state.googleSheets.lastSyncedAt && (
              <div className="text-[11px] text-slate-500 mt-1">
                Terakhir tersinkron:{' '}
                {new Date(state.googleSheets.lastSyncedAt).toLocaleString('id-ID')}
              </div>
            )}
          </div>
        </div>

        {/* Right: Copyable Apps Script Code & Steps */}
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-500" />
                <span>Script Penghubung (Google Apps Script)</span>
              </h3>
              <button
                onClick={copyScript}
                className="px-3.5 py-1.5 bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-amber-300" /> Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Salin Script
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Salin kode di bawah ini, lalu tempelkan di menu <strong>Ekstensi &gt; Apps Script</strong> pada spreadsheet Google Anda:
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 max-h-64 overflow-y-auto shadow-inner">
              <pre className="text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
                {googleAppsScriptCode}
              </pre>
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Google Sheet Anda akan <strong>secara otomatis membuat 2 lembar tab</strong>:
              tab <strong>Klasemen MSC</strong> (posisi peringkat & skor per babak) dan tab <strong>Log Riwayat Juri</strong> (catatan waktu setiap penambahan skor).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
