import React, { useState } from 'react';
import { useScoreboard } from './hooks/useScoreboard.ts';
import { Navbar } from './components/Navbar.tsx';
import { StageDisplay } from './components/StageDisplay.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { BuzzerView } from './components/BuzzerView.tsx';
import { GoogleSheetsView } from './components/GoogleSheetsView.tsx';
import { SupabaseView } from './components/SupabaseView.tsx';
import { ExportView } from './components/ExportView.tsx';
import { ApiDocsView } from './components/ApiDocsView.tsx';
import { BigEventOverlay } from './components/BigEventOverlay.tsx';
import { IslamicDecorations } from './components/IslamicDecorations.tsx';
import { Loader2 } from 'lucide-react';
import { MuhsinLogo } from './components/MuhsinLogo.tsx';

export default function App() {
  const { state, isConnected, isSyncing, connectionType, actions } = useScoreboard();
  const [currentTab, setCurrentTab] = useState<string>('stage');

  if (!state) {
    return (
      <div className="min-h-screen bg-[#faf9f5] bg-islamic-pattern text-slate-900 flex flex-col items-center justify-center p-6 relative">
        <IslamicDecorations />
        <div className="bg-white p-8 rounded-3xl border-2 border-amber-300 shadow-xl flex flex-col items-center z-10">
          <MuhsinLogo className="w-24 h-24 ring-4 ring-emerald-600/30 shadow-xl mb-4 animate-pulse rounded-full" />
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-emerald-950">
            MUHSIN SMART COMPETITION
          </h1>
          <p className="text-xs text-slate-600 mt-2 flex items-center gap-2 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>Menghubungkan ke Real-Time WebSocket Server...</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f5] bg-islamic-pattern text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-emerald-950 relative overflow-x-hidden">
      {/* Authentic Islamic Corner Geometric Motifs */}
      <IslamicDecorations />

      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isConnected={isConnected}
        connectionType={connectionType}
        competitionTitle={state.competitionTitle}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 md:p-6 relative z-10">
        {currentTab === 'stage' && (
          <StageDisplay
            state={state}
            onTimerAction={(action, sec) => actions.controlTimer(action, sec)}
            onResetBuzzer={() => actions.resetBuzzer()}
            isAdminQuickAccess={true}
          />
        )}

        {currentTab === 'admin' && (
          <AdminPanel
            state={state}
            onAddScore={(teamId, delta, note, targetRoundId) => actions.addScore(teamId, delta, note, targetRoundId)}
            onOverrideScore={(teamId, newScore, note) => actions.overrideScore(teamId, newScore, note)}
            onTimerControl={(action, sec) => actions.controlTimer(action, sec)}
            onResetBuzzer={() => actions.resetBuzzer()}
            onToggleBuzzerLock={(locked) => actions.toggleBuzzerLock(locked)}
            onSwitchRound={(roundId) => actions.switchRound(roundId)}
            onManageTeam={(action, team) => actions.manageTeam(action, team)}
            onManageRound={(action, round, roundId) => actions.manageRound(action, round, roundId)}
            onResetMatch={(type) => actions.resetMatch(type)}
            onTriggerBigEvent={(type, options) => actions.triggerBigEvent(type, options)}
            onDismissBigEvent={() => actions.dismissBigEvent()}
            onCreateSession={(name, stage, activate, preset) => actions.createSession(name, stage, activate, preset)}
            onActivateSession={(sessionId) => actions.activateSession(sessionId)}
            onDuplicateSession={(sessionId, name) => actions.duplicateSession(sessionId, name)}
            onDeleteSession={(sessionId) => actions.deleteSession(sessionId)}
            onUpdateSession={(sessionId, updates) => actions.updateSession(sessionId, updates)}
          />
        )}

        {currentTab === 'buzzer' && (
          <BuzzerView state={state} onBuzzIn={(teamId) => actions.buzzIn(teamId)} />
        )}

        {currentTab === 'supabase' && (
          <SupabaseView
            state={state}
            onSaveConfig={(url, anonKey, auto) => actions.saveSupabaseConfig(url, anonKey, auto)}
            onTriggerSync={() => actions.syncSupabase()}
            isSyncing={isSyncing}
          />
        )}

        {currentTab === 'sheets' && (
          <GoogleSheetsView
            state={state}
            onSaveConfig={(url, id, auto) => actions.saveGoogleSheetsConfig(url, id, auto)}
            onTriggerSync={() => actions.syncGoogleSheets()}
            isSyncing={isSyncing}
          />
        )}

        {currentTab === 'export' && <ExportView state={state} />}

        {currentTab === 'api' && <ApiDocsView state={state} />}
      </main>

      {/* Big Event Visual Alert Overlay (Tension & Celebration) */}
      <BigEventOverlay
        event={state.bigEventOverlay ?? null}
        onDismiss={actions.dismissBigEvent}
      />

      {/* Footer in Harmonious White & Gold */}
      <footer className="border-t border-amber-300/80 bg-white/95 backdrop-blur-sm px-4 py-3.5 text-center text-xs text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 <strong>Muhsin Smart Competition</strong> — Sistem Skoring Digital Cerdas Cermat
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> WebSockets Aktif
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-medium">Google Sheets Cloud Sync Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
