import { useState, useCallback } from 'react';
import type { Game, GameSummary, GameDetail } from './types/Game';
import GameTable from './components/GameTable';
import LoadingBar from './components/LoadingBar';
import ExportButton from './components/ExportButton';

type AppState = 'idle' | 'fetching-list' | 'fetching-details' | 'done' | 'error';

const BATCH_SIZE = 8; // concurrent detail requests

function computeFields(summary: GameSummary, detail: GameDetail): Game {
  const packCost = summary.ticketPrice * detail.packSize;
  const maxLoss = detail.guaranteedPrizeAmount - packCost;
  const topPrizesRemaining = Math.max(0, detail.topPrizeInGame - detail.topPrizeClaimed);
  return {
    ...summary,
    ...detail,
    packCost,
    maxLoss,
    topPrizesRemaining,
    status: 'done',
  };
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [games, setGames] = useState<Game[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  const loadGames = useCallback(async () => {
    setAppState('fetching-list');
    setGames([]);
    setErrorMsg('');

    // Step 1: Fetch game list
    let summaries: GameSummary[];
    try {
      const res = await fetch('/.netlify/functions/get-games');
      if (!res.ok) throw new Error(`List fetch failed: ${res.status}`);
      const data = await res.json();
      if (!data.games?.length) throw new Error('No games returned from list page');
      summaries = data.games;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch game list');
      setAppState('error');
      return;
    }

    // Initialize games in table as loading skeletons
    const initGames: Game[] = summaries.map(s => ({
      ...s,
      packSize: 0,
      guaranteedPrizeAmount: 0,
      totalTickets: 0,
      overallOdds: '...',
      topPrize: 0,
      topPrizeInGame: 0,
      topPrizeClaimed: 0,
      prizesFound: false,
      packCost: 0,
      maxLoss: 0,
      topPrizesRemaining: 0,
      status: 'loading',
    }));
    setGames(initGames);
    setProgress({ current: 0, total: summaries.length });
    setAppState('fetching-details');

    // Step 2: Fetch details in batches
    let completed = 0;

    for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
      const batch = summaries.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async summary => {
          try {
            const encodedUrl = encodeURIComponent(summary.detailUrl);
            const res = await fetch(`/.netlify/functions/get-game-detail?url=${encodedUrl}`);
            const detail: GameDetail = await res.json();

            if (!res.ok) throw new Error((detail as { error?: string }).error || 'Detail fetch failed');

            const fullGame = computeFields(summary, detail);
            setGames(prev =>
              prev.map(g => g.gameNumber === summary.gameNumber ? fullGame : g)
            );
          } catch (err: unknown) {
            setGames(prev =>
              prev.map(g =>
                g.gameNumber === summary.gameNumber
                  ? { ...g, status: 'error', errorMessage: err instanceof Error ? err.message : 'Failed' }
                  : g
              )
            );
          } finally {
            completed++;
            setProgress(p => ({ ...p, current: completed }));
          }
        })
      );
    }

    setAppState('done');
  }, []);

  const doneCount = games.filter(g => g.status === 'done').length;
  const isLoading = appState === 'fetching-list' || appState === 'fetching-details';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white px-6 py-4 shadow-md">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Texas Lottery Scratch-Off Analyzer</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              Live data from texaslottery.com
              {appState === 'done' && ` · ${doneCount} games loaded`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton games={games} disabled={isLoading} />
            <button
              onClick={loadGames}
              disabled={isLoading}
              className="px-5 py-2 bg-white text-blue-900 font-semibold rounded-lg 
                         hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed 
                         transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </>
              ) : appState === 'done' ? (
                '↺ Refresh'
              ) : (
                '▶ Load Games'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-4">
        {/* Progress bar */}
        {appState === 'fetching-details' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <LoadingBar
              current={progress.current}
              total={progress.total}
              label={`Fetching game details... ${progress.current} of ${progress.total}`}
            />
          </div>
        )}

        {appState === 'fetching-list' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm text-gray-600 text-sm">
            Fetching game list from Texas Lottery...
          </div>
        )}

        {/* Error */}
        {appState === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <strong>Error:</strong> {errorMsg}
            <br />
            <span className="text-sm">This usually means the Texas Lottery site is temporarily unreachable or changed its HTML structure.</span>
          </div>
        )}

        {/* Legend */}
        {games.length > 0 && (
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200" /> No top prizes remaining
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-600 font-medium">Red Max Loss</span> = guaranteed net loss if buying full pack
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-600 font-medium">Green Max Loss ✓</span> = pack guaranteed to return at least face value
            </span>
          </div>
        )}

        {/* Idle state */}
        {appState === 'idle' && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🎟️</p>
            <p className="text-xl font-medium text-gray-500">Click "Load Games" to fetch live data</p>
            <p className="text-sm mt-2">
              Pulls all active scratch-off games directly from texaslottery.com
            </p>
          </div>
        )}

        {/* Table */}
        {games.length > 0 && <GameTable games={games} />}
      </main>
    </div>
  );
}