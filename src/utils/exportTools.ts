import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ScoreboardState } from '../types/scoreboard.ts';
import { rankTeams } from './scoringLogic.ts';

export function exportScoreboardPDF(state: ScoreboardState) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const ranked = rankTeams(state.teams);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 42, 'F');

  // Title
  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(state.competitionTitle, 105, 16, { align: 'center' });

  // Subtitle
  doc.setTextColor(226, 232, 240); // slate-200
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(state.competitionSubtitle, 105, 24, { align: 'center' });

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(9);
  doc.text(`BERITA ACARA REKAPITULASI RESMI & SKOR AKHIR - ${dateFormatted} | ${timeFormatted} WIB`, 105, 32, {
    align: 'center',
  });

  // Active round indicator
  const activeRound = state.rounds.find((r) => r.id === state.currentRoundId)?.name || 'Semua Babak Selesai';
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Status Kompetisi: ${activeRound}`, 14, 50);

  // Table Data
  const tableHead = [
    ['Peringkat', 'Kode Regu', 'Nama Sekolah / Tim', 'Babak Wajib', 'Lemparan', 'Babak Penawaran', 'Babak Rebutan', 'Total Skor', 'Status'],
  ];

  const tableBody = ranked.map((t) => {
    let rankBadge = `${t.rank}`;
    if (t.rank === 1) rankBadge = 'Juara 1';
    else if (t.rank === 2) rankBadge = 'Juara 2';
    else if (t.rank === 3) rankBadge = 'Juara 3';
    else if (t.rank === 4) rankBadge = 'Harapan 1';

    return [
      rankBadge,
      t.code,
      t.name,
      `${t.roundScores['round-wajib'] ?? 0}`,
      `${t.roundScores['round-lemparan'] ?? 0}`,
      `${t.roundScores['round-penawaran'] ?? 0}`,
      `${t.roundScores['round-rebutan'] ?? 0}`,
      `${t.score}`,
      t.rank === 1 ? 'Lolos / Menang' : 'Selesai',
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 56,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] },
      8: { halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : 120;

  // Add recent scoring audit summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Catatan & Riwayat Terakhir Penjurian:', 14, currentY);

  const auditHead = [['Waktu', 'Regu', 'Perubahan Skor', 'Skor Akhir', 'Keterangan']];
  const auditBody = state.history.slice(0, 5).map((h) => [
    new Date(h.timestamp).toLocaleTimeString('id-ID'),
    h.teamName || '-',
    h.delta >= 0 ? `+${h.delta}` : `${h.delta}`,
    `${h.newScore}`,
    h.note || '-',
  ]);

  autoTable(doc, {
    head: auditHead,
    body: auditBody,
    startY: currentY + 4,
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [71, 85, 105],
    },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'left' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'left' },
    },
  });

  currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 20 : 200;

  // Check if we need a new page for signatures
  if (currentY > 230) {
    doc.addPage();
    currentY = 40;
  }

  // Official Signatures
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Disahkan di tempat kegiatan pada ${dateFormatted}`, 105, currentY, { align: 'center' });

  const leftSignX = 45;
  const rightSignX = 165;

  doc.text('Ketua Dewan Juri,', leftSignX, currentY + 12, { align: 'center' });
  doc.text('Ketua Panitia Pelaksana,', rightSignX, currentY + 12, { align: 'center' });

  // Signature lines
  doc.line(leftSignX - 30, currentY + 38, leftSignX + 30, currentY + 38);
  doc.line(rightSignX - 30, currentY + 38, rightSignX + 30, currentY + 38);

  doc.setFont('helvetica', 'bold');
  doc.text('( ............................................ )', leftSignX, currentY + 44, { align: 'center' });
  doc.text('( ............................................ )', rightSignX, currentY + 44, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('NIP / ID: ...................................', leftSignX, currentY + 49, { align: 'center' });
  doc.text('Muhsin Smart Competition 2026', rightSignX, currentY + 49, { align: 'center' });

  // Footer stamp
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen ini digenerate secara otomatis oleh Sistem Papan Skor Muhsin Smart Competition dengan validasi real-time.', 105, 290, {
    align: 'center',
  });

  doc.save(`Hasil_Skor_Muhsin_Smart_Competition_${now.toISOString().slice(0, 10)}.pdf`);
}

export function exportScoreboardExcel(state: ScoreboardState) {
  const ranked = rankTeams(state.teams);
  const now = new Date();

  // Sheet 1: Klasemen Akhir
  const leaderboardData = ranked.map((t) => ({
    'Peringkat': t.rank,
    'Kode Regu': t.code,
    'Nama Sekolah / Tim': t.name,
    'Babak I (Wajib)': t.roundScores['round-wajib'] ?? 0,
    'Babak Lemparan': t.roundScores['round-lemparan'] ?? 0,
    'Babak II (Penawaran)': t.roundScores['round-penawaran'] ?? 0,
    'Babak III (Rebutan)': t.roundScores['round-rebutan'] ?? 0,
    'TOTAL SKOR AKHIR': t.score,
    'Status': t.rank === 1 ? 'Juara 1' : t.rank === 2 ? 'Juara 2' : t.rank === 3 ? 'Juara 3' : 'Peserta',
  }));

  // Sheet 2: Riwayat Audit Skor
  const historyData = state.history.map((h) => ({
    'ID': h.id,
    'Waktu': new Date(h.timestamp).toLocaleString('id-ID'),
    'Aksi': h.action,
    'Nama Regu': h.teamName,
    'Perubahan Skor (Delta)': h.delta,
    'Skor Sebelumnya': h.prevScore,
    'Skor Sesudahnya': h.newScore,
    'ID Babak': h.roundId,
    'Catatan Juri': h.note || '',
  }));

  const wb = XLSX.utils.book_new();
  const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
  const wsHistory = XLSX.utils.json_to_sheet(historyData);

  // Set column widths
  wsLeaderboard['!cols'] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
  ];

  wsHistory['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 15 },
    { wch: 25 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Klasemen Skor');
  XLSX.utils.book_append_sheet(wb, wsHistory, 'Log Riwayat Penjurian');

  XLSX.writeFile(wb, `Muhsin_Smart_Competition_Rekap_${now.toISOString().slice(0, 10)}.xlsx`);
}
