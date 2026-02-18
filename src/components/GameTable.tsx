import { useState, useMemo } from 'react';
import type { Game, SortField, SortDirection } from '../types/Game';

interface GameTableProps {
  games: Game[];
  minDate: string;
  onMinDateChange: (date: string) => void;
  selectedPrices: number[];
  onPriceFilterChange: (prices: number[]) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-US').format(n);

const fmtPercent = (n: number) =>
  `${n.toFixed(2)}%`;

interface ColDef {
  key: SortField;
  label: string;
  render: (g: Game) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColDef[] = [
  { key: 'gameNumber',            label: 'Game #',             render: g => g.gameNumber,                            align: 'center' },
  { key: 'gameName',              label: 'Game Name',          render: g => g.gameName,                              align: 'left'   },
  { key: 'startDate',             label: 'Start Date',         render: g => g.startDate,                             align: 'center' },
  { key: 'ticketPrice',           label: 'Ticket Price',       render: g => fmt(g.ticketPrice),                      align: 'right'  },
  { key: 'packSize',              label: 'Pack Size',          render: g => fmtNum(g.packSize),                      align: 'right'  },
  { key: 'guaranteedPrizeAmount', label: 'Guaranteed Prize',   render: g => fmt(g.guaranteedPrizeAmount),            align: 'right'  },
  { key: 'packCost',              label: 'Pack Cost',          render: g => fmt(g.packCost),                         align: 'right'  },
  {
    key: 'maxLoss',
    label: 'Max Loss',
    render: g => (
      <span className={g.maxLoss < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
        {fmt(Math.abs(g.maxLoss))}
        {g.maxLoss >= 0 ? ' ✓' : ''}
      </span>
    ),
    align: 'right',
  },
  {
    key: 'maxLossPercent',
    label: 'Max Loss %',
    render: g => (
      <span className={g.maxLoss < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
        {fmtPercent(g.maxLossPercent)}
        {g.maxLoss >= 0 ? ' ✓' : ''}
      </span>
    ),
    align: 'right',
  },
  { key: 'topPrize',              label: 'Top Prize',          render: g => fmt(g.topPrize),                         align: 'right'  },
  {
    key: 'topPrizesRemaining',
    label: 'Top Prizes Left',
    render: g => (
      <span className={g.topPrizesRemaining === 0 ? 'text-red-500 font-semibold' : 'text-gray-900'}>
        {g.topPrizesRemaining === 0 ? '0 ✗' : fmtNum(g.topPrizesRemaining)}
      </span>
    ),
    align: 'right',
  },
  { key: 'totalTickets',          label: 'Total Tickets',      render: g => fmtNum(g.totalTickets),                  align: 'right'  },
  { key: 'overallOdds',           label: 'Overall Odds',       render: g => g.overallOdds,                           align: 'center' },
];

export default function GameTable({ games, minDate, onMinDateChange, selectedPrices, onPriceFilterChange }: GameTableProps) {
  const [sortField, setSortField] = useState<SortField>('ticketPrice');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Get unique price points from all games
  const availablePrices = useMemo(() => {
    const prices = new Set(games.map(g => g.ticketPrice));
    return Array.from(prices).sort((a, b) => a - b);
  }, [games]);

  // Filter games by date and price
  const filtered = useMemo(() => {
    return games.filter(game => {
      // Date filter
      if (game.startDate) {
        const gameDate = new Date(game.startDate);
        const filterDate = new Date(minDate);
        if (gameDate < filterDate) return false;
      }
      
      // Price filter
      if (selectedPrices.length > 0 && !selectedPrices.includes(game.ticketPrice)) {
        return false;
      }
      
      return true;
    });
  }, [games, minDate, selectedPrices]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const handlePriceToggle = (price: number) => {
    if (selectedPrices.includes(price)) {
      onPriceFilterChange(selectedPrices.filter(p => p !== price));
    } else {
      onPriceFilterChange([...selectedPrices, price]);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (field !== sortField) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex gap-6 items-center flex-wrap">
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="minDate" className="text-sm font-medium text-gray-700">
              Start Date ≥
            </label>
            <input
              id="minDate"
              type="date"
              value={minDate}
              onChange={(e) => onMinDateChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Price Filter */}
          <div className="relative">
            <button
              onClick={() => setShowPriceFilter(!showPriceFilter)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              Ticket Price
              {selectedPrices.length > 0 && (
                <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">
                  {selectedPrices.length}
                </span>
              )}
              <span className="text-gray-400">▼</span>
            </button>
            
            {showPriceFilter && (
              <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 min-w-[160px]">
                <div className="space-y-1">
                  {availablePrices.map(price => (
                    <label key={price} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPrices.includes(price)}
                        onChange={() => handlePriceToggle(price)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{fmt(price)}</span>
                    </label>
                  ))}
                </div>
                {selectedPrices.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => onPriceFilterChange([])}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filter Summary */}
          <div className="text-sm text-gray-600">
            Showing {sorted.length} of {games.filter(g => g.status === 'done').length} games
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-3 font-semibold text-gray-700 cursor-pointer select-none 
                              hover:bg-gray-100 whitespace-nowrap
                              ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.label}
                  <SortIcon field={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sorted.map(game => {
              const isLoading = game.status === 'loading';
              const isError   = game.status === 'error';

              return (
                <tr
                  key={game.gameNumber}
                  className={`
                    ${game.topPrizesRemaining === 0 && game.status === 'done' ? 'bg-red-50' : ''}
                    ${isLoading ? 'animate-pulse bg-gray-50' : ''}
                    ${isError ? 'bg-yellow-50' : ''}
                    hover:bg-blue-50 transition-colors
                  `}
                >
                  {COLUMNS.map(col => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 whitespace-nowrap
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {isLoading && col.key !== 'gameNumber' && col.key !== 'gameName' && col.key !== 'startDate' && col.key !== 'ticketPrice'
                        ? <span className="inline-block w-16 h-4 bg-gray-200 rounded animate-pulse" />
                        : isError && col.key === 'packSize'
                          ? <span className="text-yellow-600 text-xs">{game.errorMessage || 'Error loading'}</span>
                          : col.render(game)
                      }
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
