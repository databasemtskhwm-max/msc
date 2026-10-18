import React, { useState } from 'react';
import type { ScoreboardState } from '../types/scoreboard.ts';
import { rankTeams } from '../utils/scoringLogic.ts';
import { exportScoreboardPDF, exportScoreboardExcel } from '../utils/exportTools.ts';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Trophy,
  CheckCircle,
  Printer,
  Sparkles,
} from 'lucide-react';
import { MuhsinLogo } from './MuhsinLogo.tsx';

interface ExportViewProps {
  state: ScoreboardState;
}

export const ExportView: React.FC<ExportViewProps> = ({ state }) => {
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const ranked = rankTeams(state.teams);
  const currentRound = state.rounds.find((r) => r.id === state.currentRoundId) || state.rounds[0];

  const handleExportPDF = () => {
    setDownloadingPDF(true);
    try {
      exportScoreboardPDF(state);
    } finally {
      setTimeout(() => setDownloadingPDF(false), 1000);
    }
  };

  const handleExportExcel = () => {
    setDownloadingExcel(true);
    try {
      exportScoreboardExcel(state);
    } finally {
      setTimeout(() => setDownloadingExcel(false), 1000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ekspor Data Otomatis & Berita Acara</span>
          </div>
          <h2 className="text-xl font-black text-white">Ekspor Hasil Akhir Lomba</h2>
          <p className="text-xs text-slate-400 mt-1">
            Unduh rekapitulasi nilai resmi dalam format PDF standar kejuaraan dan file Excel (.xlsx)
            untuk dokumentasi panitia.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={downloadingPDF}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{downloadingPDF ? 'Membuat PDF...' : 'Unduh Berita Acara (PDF)'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={downloadingExcel}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{downloadingExcel ? 'Membuat Excel...' : 'Unduh Rekap Lengkap (Excel)'}</span>
          </button>
        </div>
      </div>

      {/* Printable Preview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <MuhsinLogo className="w-12 h-12 ring-2 ring-emerald-500/40 shadow-md" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Pratinjau Hasil Lomba (Live Preview)
              </span>
              <h3 className="text-lg font-black text-white">{state.competitionTitle}</h3>
              <p className="text-xs text-slate-400">{state.competitionSubtitle}</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Table Preview */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3 text-center">Peringkat</th>
                <th className="p-3 text-center">Kode</th>
                <th className="p-3">Nama Sekolah / Peserta</th>
                <th className="p-3 text-center">Babak Wajib</th>
                <th className="p-3 text-center">Babak Penawaran</th>
                <th className="p-3 text-center">Babak Rebutan</th>
                <th className="p-3 text-center font-black text-amber-400">Total Skor</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {ranked.map((team) => (
                <tr
                  key={team.id}
                  className={`hover:bg-slate-800/40 transition ${
                    team.rank === 1 ? 'bg-amber-500/5 font-bold' : ''
                  }`}
                >
                  <td className="p-3 text-center font-black">
                    {team.rank === 1 ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        <Trophy className="w-3 h-3" /> Juara 1
                      </span>
                    ) : team.rank === 2 ? (
                      <span className="text-slate-300">Juara 2</span>
                    ) : team.rank === 3 ? (
                      <span className="text-amber-600">Juara 3</span>
                    ) : (
                      <span className="text-slate-500">Peringkat {team.rank}</span>
                    )}
                  </td>
                  <td className="p-3 text-center font-bold text-white">{team.code}</td>
                  <td className="p-3 font-sans font-bold text-slate-200">{team.name}</td>
                  <td className="p-3 text-center text-slate-300">
                    {team.roundScores['round-wajib'] ?? 0}
                  </td>
                  <td className="p-3 text-center text-slate-300">
                    {team.roundScores['round-penawaran'] ?? team.roundScores['round-lemparan'] ?? 0}
                  </td>
                  <td className="p-3 text-center text-slate-300">
                    {team.roundScores['round-rebutan'] ?? 0}
                  </td>
                  <td className="p-3 text-center text-base font-black text-amber-400">
                    {team.score}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        team.rank === 1
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {team.rank === 1 ? 'PEMENANG' : 'SELESAI'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formal Signatures Mockup preview in app */}
        <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-2 text-center text-xs text-slate-400">
          <div>
            <p>Mengetahui,</p>
            <p className="font-bold text-slate-200 mt-1">Ketua Dewan Juri</p>
            <div className="h-16 flex items-end justify-center">
              <span className="text-slate-500 italic text-[11px]">[Tanda Tangan & Cap]</span>
            </div>
            <p className="font-bold text-white mt-1">( ............................................ )</p>
          </div>

          <div>
            <p>Disahkan oleh,</p>
            <p className="font-bold text-slate-200 mt-1">Ketua Panitia Muhsin Smart Competition</p>
            <div className="h-16 flex items-end justify-center">
              <span className="text-slate-500 italic text-[11px]">[Tanda Tangan & Cap]</span>
            </div>
            <p className="font-bold text-white mt-1">( ............................................ )</p>
          </div>
        </div>
      </div>
    </div>
  );
};
