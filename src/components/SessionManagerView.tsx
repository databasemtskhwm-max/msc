import React, { useState } from 'react';
import type { ScoreboardState, CompetitionSession } from '../types/scoreboard.ts';
import {
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  Copy,
  Trash2,
  Edit2,
  Trophy,
  Users,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface SessionManagerViewProps {
  state: ScoreboardState;
  onCreateSession?: (
    name: string,
    stage?: string,
    activateImmediately?: boolean,
    preset?: 'preset8' | 'initial4' | 'empty'
  ) => Promise<any>;
  onActivateSession?: (sessionId: string) => Promise<any>;
  onDuplicateSession?: (sessionId: string, newName?: string) => Promise<any>;
  onDeleteSession?: (sessionId: string) => Promise<any>;
  onUpdateSession?: (sessionId: string, updates: Partial<CompetitionSession>) => Promise<any>;
  showNotification: (msg: string) => void;
}

export const SessionManagerView: React.FC<SessionManagerViewProps> = ({
  state,
  onCreateSession,
  onActivateSession,
  onDuplicateSession,
  onDeleteSession,
  onUpdateSession,
  showNotification,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSession, setEditingSession] = useState<CompetitionSession | null>(null);

  // Create form state
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionStage, setNewSessionStage] = useState('Penyisihan');
  const [newSessionPreset, setNewSessionPreset] = useState<'preset8' | 'initial4' | 'empty'>('preset8');
  const [activateImmediately, setActivateImmediately] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editStage, setEditStage] = useState('');

  const sessions = state.sessions && state.sessions.length > 0
    ? state.sessions
    : [
        {
          id: state.activeSessionId || 'session-penyisihan-1',
          name: 'Babak Penyisihan - Sesi 1',
          stage: 'Penyisihan',
          status: 'active' as const,
          createdAt: Date.now(),
          teams: state.teams,
          rounds: state.rounds,
          currentRoundId: state.currentRoundId,
          timer: state.timer,
          history: state.history,
          buzzerQueue: state.buzzerQueue,
          isBuzzerLocked: state.isBuzzerLocked,
        },
      ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    if (onCreateSession) {
      await onCreateSession(newSessionName, newSessionStage, activateImmediately, newSessionPreset);
      showNotification(`Sesi "${newSessionName}" berhasil dibuat!`);
      setNewSessionName('');
      setShowCreateModal(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !editName.trim()) return;

    if (onUpdateSession) {
      await onUpdateSession(editingSession.id, {
        name: editName.trim(),
        stage: editStage,
      });
      showNotification(`Sesi "${editName}" diperbarui!`);
      setEditingSession(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Manajemen Sesi Pertandingan
            </h3>
            <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 font-bold px-2.5 py-0.5 rounded-full">
              {sessions.length} Sesi Terdaftar
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simpan beberapa sesi lomba (Penyisihan 1, Penyisihan 2, Semifinal, Final). Sesi aktif langsung tampil di layar panggung dan panel juri.
          </p>
        </div>

        <button
          onClick={() => {
            setNewSessionName(`Babak Penyisihan - Sesi ${sessions.length + 1}`);
            setShowCreateModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Tambah Sesi Lomba</span>
        </button>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {sessions.map((sess) => {
          const isActive = sess.id === state.activeSessionId;
          const teams = sess.teams || [];
          const topTeam = [...teams].sort((a, b) => b.score - a.score)[0];

          return (
            <div
              key={sess.id}
              className={`rounded-2xl border-2 p-4 transition flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-900 border-amber-400 shadow-xl shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Session Header */}
                <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {sess.stage || 'Penyisihan'}
                      </span>
                      {isActive ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 animate-pulse">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SEDANG AKTIF</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {sess.status === 'completed' ? 'Selesai' : 'Mendatang'}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-black text-white mt-1">
                      {sess.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSession(sess);
                        setEditName(sess.name);
                        setEditStage(sess.stage || 'Penyisihan');
                      }}
                      title="Edit Nama Sesi"
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {onDuplicateSession && (
                      <button
                        onClick={async () => {
                          await onDuplicateSession(sess.id, `${sess.name} (Salinan)`);
                          showNotification(`Sesi "${sess.name}" berhasil diduplikasi!`);
                        }}
                        title="Duplikat Sesi Ini"
                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {sessions.length > 1 && onDeleteSession && (
                      <button
                        onClick={async () => {
                          if (confirm(`Yakin ingin menghapus sesi "${sess.name}"?`)) {
                            await onDeleteSession(sess.id);
                            showNotification(`Sesi "${sess.name}" dihapus.`);
                          }
                        }}
                        title="Hapus Sesi"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block">Jumlah Regu:</span>
                    <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{teams.length} Regu Peserta</span>
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 text-[10px] block">Skor Tertinggi:</span>
                    <span className="font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>{topTeam ? `${topTeam.code} (${topTeam.score})` : '0 Pts'}</span>
                    </span>
                  </div>
                </div>

                {/* Team Mini Pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {teams.slice(0, 8).map((t) => (
                    <span
                      key={t.id}
                      className="px-2 py-0.5 text-[10px] font-bold rounded text-slate-950"
                      style={{ backgroundColor: t.color || '#3b82f6' }}
                    >
                      {t.code}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-800/80">
                {isActive ? (
                  <div className="w-full py-2 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Layar Panggung Menampilkan Sesi Ini</span>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      if (onActivateSession) {
                        await onActivateSession(sess.id);
                        showNotification(`Sesi "${sess.name}" kini AKTIF di seluruh layar!`);
                      }
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-amber-400 border border-slate-700 hover:border-emerald-500 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Aktifkan Sesi Ini Sekarang</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE NEW SESSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                <Plus className="w-4 h-4 stroke-[3]" />
              </span>
              <div>
                <h3 className="text-lg font-black text-white">Tambah Sesi Pertandingan</h3>
                <p className="text-xs text-slate-400">Buat sesi baru untuk babak berikutnya</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nama Sesi Lomba
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Babak Penyisihan - Sesi 2"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Kategori Babak
                </label>
                <select
                  value={newSessionStage}
                  onChange={(e) => setNewSessionStage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Penyisihan">Babak Penyisihan</option>
                  <option value="Semifinal">Babak Semifinal</option>
                  <option value="Final">Babak Grand Final</option>
                  <option value="Eksibisi">Pertandingan Eksibisi</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Peserta Regu Awal
                </label>
                <select
                  value={newSessionPreset}
                  onChange={(e) => setNewSessionPreset(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="preset8">Preset 8 Regu Lengkap (Regu A s/d H)</option>
                  <option value="initial4">4 Regu Awal (Regu A s/d D)</option>
                  <option value="empty">Kosong (Input regu manual nanti)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activateNow"
                  checked={activateImmediately}
                  onChange={(e) => setActivateImmediately(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-400 cursor-pointer"
                />
                <label htmlFor="activateNow" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Langsung jadikan sesi aktif di Layar Panggung
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Buat & Simpan Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SESSION MODAL */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1">Edit Informasi Sesi</h3>
            <p className="text-xs text-slate-400 mb-4">Ubah nama atau kategori babak sesi ini</p>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nama Sesi
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Kategori
                </label>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Penyisihan">Babak Penyisihan</option>
                  <option value="Semifinal">Babak Semifinal</option>
                  <option value="Final">Babak Grand Final</option>
                  <option value="Eksibisi">Pertandingan Eksibisi</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
