import { useState, useCallback, useEffect } from 'react';
import type { Game, GameSummary, GameDetail } from './types/Game';
import GameTable from './components/GameTable';
import LoadingBar from './components/LoadingBar';
import ExportButton from './components/ExportButton';

type AppState = 'idle' | 'fetching-list' | 'fetching-details' | 'done' | 'error';

const BATCH_SIZE = 8; // concurrent detail requests
const CACHE_KEY = 'tx-lottery-games-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  games: Game[];
  timestamp: number;
}

function computeFields(summary: GameSummary, detail: GameDetail): Game {
  const packCost = summary.ticketPrice * detail.packSize;
  const maxLoss = detail.guaranteedPrizeAmount - packCost;
  const maxLossPercent = packCost > 0 ? (Math.abs(maxLoss) / packCost) * 100 : 0;
  const topPrizesRemaining = Math.max(0, detail.topPrizeInGame - detail.topPrizeClaimed);
  return {
    ...summary,
    ...detail,
    packCost,
    maxLoss,
    maxLossPercent,
    topPrizesRemaining,
    status: 'done',
  };
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return 'just now';
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [games, setGames] = useState<Game[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  // Filter state
  const [minDate, setMinDate] = useState('2025-01-01');
  const [selectedPrices, setSelectedPrices] = useState<number[]>([]);

  // Check if data is stale (>24 hours old)
  const isStale = lastUpdated !== null && (Date.now() - lastUpdated > CACHE_DURATION_MS);

  // Load cached data on mount
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data: CachedData = JSON.parse(cached);
        if (data.games && Array.isArray(data.games) && data.games.length > 0) {
          setGames(data.games);
          setLastUpdated(data.timestamp);
          setAppState('done');
        }
      } catch (err) {
        console.error('Failed to load cached data:', err);
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

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
      maxLossPercent: 0,
      topPrizesRemaining: 0,
      status: 'loading',
    }));
    setGames(initGames);
    setProgress({ current: 0, total: summaries.length });
    setAppState('fetching-details');

    // Step 2: Fetch details in batches
    let completed = 0;
    const completedGames: Game[] = [];

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
            completedGames.push(fullGame);
            setGames(prev =>
              prev.map(g => g.gameNumber === summary.gameNumber ? fullGame : g)
            );
          } catch (err: unknown) {
            const errorGame: Game = {
              ...summary,
              packSize: 0,
              guaranteedPrizeAmount: 0,
              totalTickets: 0,
              overallOdds: 'N/A',
              topPrize: 0,
              topPrizeInGame: 0,
              topPrizeClaimed: 0,
              prizesFound: false,
              packCost: 0,
              maxLoss: 0,
              maxLossPercent: 0,
              topPrizesRemaining: 0,
              status: 'error',
              errorMessage: err instanceof Error ? err.message : 'Failed'
            };
            setGames(prev =>
              prev.map(g => g.gameNumber === summary.gameNumber ? errorGame : g)
            );
          } finally {
            completed++;
            setProgress(p => ({ ...p, current: completed }));
          }
        })
      );
    }

    // Save to localStorage
    const timestamp = Date.now();
    const cacheData: CachedData = {
      games: completedGames.length > 0 ? completedGames : initGames,
      timestamp
    };
    
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setLastUpdated(timestamp);
    } catch (err) {
      console.error('Failed to cache data:', err);
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
              {lastUpdated && ` · Last updated ${formatTimeAgo(lastUpdated)}`}
              {appState === 'done' && !lastUpdated && ` · ${doneCount} games loaded`}
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
              ) : (
                '↺ Refresh'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-4">
        {/* Stale Data Warning */}
        {isStale && appState === 'done' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                This data was last updated {formatTimeAgo(lastUpdated!)}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Click the <strong>Refresh</strong> button above to load the latest game information from Texas Lottery.
              </p>
            </div>
          </div>
        )}

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
        {appState === 'idle' && games.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🎟️</p>
            <p className="text-xl font-medium text-gray-500">Click "Refresh" to fetch live data</p>
            <p className="text-sm mt-2">
              Pulls all active scratch-off games directly from texaslottery.com
            </p>
          </div>
        )}

        {/* Table */}
        {games.length > 0 && (
          <GameTable 
            games={games}
            minDate={minDate}
            onMinDateChange={setMinDate}
            selectedPrices={selectedPrices}
            onPriceFilterChange={setSelectedPrices}
          />
        )}
      </main>
    </div>
  );
}
