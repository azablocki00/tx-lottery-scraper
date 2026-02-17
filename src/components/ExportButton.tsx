import type { Game } from '../types/Game';
import { exportToXlsx } from '../utils/exportXlsx';

interface ExportButtonProps {
  games: Game[];
  disabled?: boolean;
}

export default function ExportButton({ games, disabled }: ExportButtonProps) {
  const doneGames = games.filter(g => g.status === 'done');

  const handleExport = () => {
    if (doneGames.length === 0) return;
    exportToXlsx(doneGames);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || doneGames.length === 0}
      className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 
                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export XLSX ({doneGames.length} games)
    </button>
  );
}