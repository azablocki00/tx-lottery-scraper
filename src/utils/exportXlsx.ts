import * as XLSX from 'xlsx';
import type { Game } from '../types/Game';

export function exportToXlsx(games: Game[], filename = 'texas-lottery-comparison.xlsx') {
  const headers = [
    'Game #',
    'Game Name',
    'Start Date',
    'Ticket Price',
    'Pack Size',
    'Guaranteed Total Prize Amount',
    'Pack Cost',
    'Max Loss (Guaranteed)',
    'Top Prize',
    'Top Prizes Remaining',
    'Total Tickets',
    'Overall Odds',
  ];

  const rows = games.map(g => [
    g.gameNumber,
    g.gameName,
    g.startDate,
    g.ticketPrice,
    g.packSize,
    g.guaranteedPrizeAmount,
    g.packCost,
    g.maxLoss,
    g.topPrize,
    g.topPrizesRemaining,
    g.totalTickets,
    g.overallOdds,
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },   // Game #
    { wch: 30 },  // Game Name
    { wch: 12 },  // Start Date
    { wch: 12 },  // Ticket Price
    { wch: 10 },  // Pack Size
    { wch: 28 },  // Guaranteed Total
    { wch: 12 },  // Pack Cost
    { wch: 18 },  // Max Loss
    { wch: 14 },  // Top Prize
    { wch: 18 },  // Top Prizes Remaining
    { wch: 14 },  // Total Tickets
    { wch: 16 },  // Overall Odds
  ];

  // Apply currency format to dollar columns (cols D, F, G, H, I = indices 3,5,6,7,8)
  const currencyIndices = [3, 5, 6, 7, 8];
  const totalRows = rows.length + 1;
  currencyIndices.forEach(colIdx => {
    for (let row = 2; row <= totalRows; row++) {
      const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].z = '$#,##0.00';
      }
    }
  });

  // Bold header row
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) ws[cellRef] = { v: headers[c], t: 's' };
    if (!ws[cellRef].s) ws[cellRef].s = {};
    ws[cellRef].s.font = { bold: true };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TX Lottery Games');
  XLSX.writeFile(wb, filename);
}