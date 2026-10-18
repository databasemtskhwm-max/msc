import React, { useState } from 'react';
import {
  Calendar,
  Sliders,
  BellRing,
  Sheet,
  Code2,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Wifi,
  Database,
  Zap,
} from 'lucide-react';
import { setAudioMuted, getAudioMuted } from '../utils/audio.ts';
import { MuhsinLogo } from './MuhsinLogo.tsx';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isConnected: boolean;
  connectionType: 'ws' | 'http' | 'channel' | 'sheets' | 'supabase' | 'local';
  competitionTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  isConnected,
  connectionType,
}) => {
  const [muted, setMuted] = useState(getAudioMuted());
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  React.useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const navItems = [
    { id: 'stage', label: 'Papan Skor Panggung', icon: Calendar },
    { id: 'admin', label: 'Panel Juri & Skor', icon: Sliders },
    { id: 'buzzer', label: 'Bel Peserta', icon: BellRing },
    { id: 'supabase', label: 'Database Supabase', icon: Database },
    { id: 'sheets', label: 'Google Sheets (Opsional)', icon: Sheet },
    { id: 'export', label: 'Ekspor PDF / Excel', icon: FileSpreadsheet },
    { id: 'api', label: 'API Papan Skor', icon: Code2 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-amber-400 shadow-xs px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand with Official Logo & Badges */}
        <div className="flex items-center gap-3">
          <div className="relative group shrink-0">
            <MuhsinLogo className="w-11 h-11 ring-2 ring-emerald-600/40 shadow-md" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black tracking-tight text-emerald-950 text-base md:text-xl">
                MUHSIN SMART COMPETITION
              </span>
              <span className="text-[10px] md:text-[11px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#064e3b] text-white shadow-2xs">
                MTs KH. A. WAHAB MUHSIN
              </span>
              <span className="text-[10px] md:text-[11px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow-2xs">
                CERDAS CERMAT
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1.5 font-mono">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  {connectionType === 'supabase' ? (
                    <Zap className="w-3 h-3 text-amber-500 fill-current inline" />
                  ) : (
                    <Wifi className="w-3 h-3 inline" />
                  )}
                  {isConnected
                    ? connectionType === 'supabase'
                      ? 'Supabase Realtime'
                      : connectionType === 'ws'
                      ? 'WebSocket Live'
                      : connectionType === 'sheets'
                      ? 'Sheets Cloud'
                      : 'Lokal Aktif'
                    : 'Menghubungkan...'}
                </span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 hidden sm:inline font-medium">
                Papan Skor Digital Real-Time
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Pill Rows) */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/70 font-semibold'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls (Sound & Fullscreen) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleSound}
            title={muted ? 'Aktifkan Suara Bel & Efek' : 'Senyapkan Suara'}
            className={`p-2 rounded-xl text-xs border transition cursor-pointer shadow-xs ${
              muted
                ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
          </button>

          <button
            onClick={toggleFullscreen}
            title="Layar Penuh (F11 / Projector Mode)"
            className="p-2 rounded-xl text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
