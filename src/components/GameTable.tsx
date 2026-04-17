import { useState, useMemo, useRef, useEffect } from 'react';
import type { Game, SortField, SortDirection } from '../types/Game';

interface GameTableProps {
  games: Game[];
  minDate: string;
  onMinDateChange: (date: string) => void;
  selectedPrices: number[];
  onPriceFilterChange: (prices: number[]) => void;
  sortField: SortField;
  sortDir: SortDirection;
  onSortChange: (field: SortField, dir: SortDirection) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
};

const fmtNumShort = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const fmtPercent = (n: number) => `${n.toFixed(1)}%`;

// Strip leading "1 in " from Texas Lottery odds strings (e.g. "1 in 3.50" → "3.50")
const fmtOdds = (odds: string): string => odds.replace(/^1 in /i, '');

// Format date as M/D/YY, handling MM/DD/YYYY and ISO strings without timezone shifts
const fmtDate = (dateStr: string): string => {
  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${parseInt(slash[1])}/${parseInt(slash[2])}/${slash[3].slice(-2)}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(-2)}`;
};

interface ColDef {
  key: SortField;
  label: string;
  render: (g: Game) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  mobileVisible: boolean;
  frozen?: boolean;
  frozenLeft?: number; // px offset from left edge for sticky positioning
  fixedWidth?: number; // forces cell width (px) so frozen offsets stay accurate
  lastFrozen?: boolean; // adds a right border to visually close the frozen pane
}

// Game Name is the sole frozen column (sticky left-0). Mobile-visible columns lead.
const COLUMNS: ColDef[] = [
  {
    key: 'gameName',
    label: 'Name',
    render: g => (
      <div style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
           title={g.gameName}>
        <a href={g.detailUrl} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
          {g.gameName}
        </a>
      </div>
    ),
    align: 'left',
    mobileVisible: true,
    frozen: true,
    frozenLeft: 0,
    lastFrozen: true,
  },
  { key: 'overallOdds',   label: 'Odds',   render: g => fmtOdds(g.overallOdds),  align: 'center', mobileVisible: true },
  {
    key: 'maxLossPercent',
    label: 'Loss %',
    render: g => (
      <span className={g.maxLoss < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
        {fmtPercent(g.maxLossPercent)}{g.maxLoss >= 0 ? ' ✓' : ''}
      </span>
    ),
    align: 'right',
    mobileVisible: true,
  },
  { key: 'ticketPrice', label: 'Price', render: g => fmt(g.ticketPrice),   align: 'right',  mobileVisible: true },
  { key: 'startDate',   label: 'Start', render: g => fmtDate(g.startDate), align: 'center', mobileVisible: true },
  // Extended columns — hidden on mobile until expanded
  {
    key: 'maxLoss',
    label: 'Max Loss',
    render: g => (
      <span className={g.maxLoss < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
        {fmtShort(Math.abs(g.maxLoss))}{g.maxLoss >= 0 ? ' ✓' : ''}
      </span>
    ),
    align: 'right',
    mobileVisible: false,
  },
  {
    key: 'topPrizesRemaining',
    label: 'Top Left',
    render: g => (
      <span className={g.topPrizesRemaining === 0 ? 'text-red-500 font-semibold' : 'text-gray-900'}>
        {g.topPrizesRemaining === 0 ? '0 ✗' : fmtNumShort(g.topPrizesRemaining)}
      </span>
    ),
    align: 'right',
    mobileVisible: false,
  },
  { key: 'topPrize',              label: 'Top Prize', render: g => fmtShort(g.topPrize),              align: 'right', mobileVisible: false },
  { key: 'packSize',              label: 'Pk Size',   render: g => fmtNumShort(g.packSize),           align: 'right', mobileVisible: false },
  { key: 'packCost',              label: 'Pk Cost',   render: g => fmtShort(g.packCost),              align: 'right', mobileVisible: false },
  { key: 'guaranteedPrizeAmount', label: 'Guar.',     render: g => fmtShort(g.guaranteedPrizeAmount), align: 'right', mobileVisible: false },
  { key: 'totalTickets',          label: 'Tickets',   render: g => fmtNumShort(g.totalTickets),       align: 'right', mobileVisible: false },
];

export default function GameTable({ games, minDate, onMinDateChange, selectedPrices, onPriceFilterChange, sortField, sortDir, onSortChange }: GameTableProps) {
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [colsExpanded, setColsExpanded] = useState(() => window.innerWidth >= 640);
  const priceFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (priceFilterRef.current && !priceFilterRef.current.contains(e.target as Node)) {
        setShowPriceFilter(false);
      }
    }
    if (showPriceFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPriceFilter]);

  const handleSort = (field: SortField) => {
    onSortChange(field, field === sortField && sortDir === 'asc' ? 'desc' : 'asc');
  };

  const availablePrices = useMemo(() => {
    const prices = new Set(games.map(g => g.ticketPrice));
    return Array.from(prices).sort((a, b) => a - b);
  }, [games]);

  const filtered = useMemo(() =>
    games.filter(game => {
      if (game.startDate && new Date(game.startDate) < new Date(minDate)) return false;
      if (selectedPrices.length > 0 && !selectedPrices.includes(game.ticketPrice)) return false;
      return true;
    }),
    [games, minDate, selectedPrices]
  );

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else if (sortField === 'startDate') {
        cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    }),
    [filtered, sortField, sortDir]
  );

  const handlePriceToggle = (price: number) => {
    onPriceFilterChange(
      selectedPrices.includes(price)
        ? selectedPrices.filter(p => p !== price)
        : [...selectedPrices, price]
    );
  };

  const getColClass = (col: ColDef) =>
    col.mobileVisible || colsExpanded ? '' : 'hidden';

  // Inline styles for frozen (sticky-left) cells; keeps left offsets in sync with fixedWidth
  const thStyle = (col: ColDef): React.CSSProperties => ({
    ...(col.frozen ? { position: 'sticky', top: 0, left: col.frozenLeft, zIndex: 20 } : { position: 'sticky', top: 0, zIndex: 10 }),
    ...(col.fixedWidth ? { width: col.fixedWidth, minWidth: col.fixedWidth } : {}),
  });

  const tdStyle = (col: ColDef): React.CSSProperties => ({
    ...(col.frozen ? { position: 'sticky', left: col.frozenLeft, zIndex: 10 } : {}),
    ...(col.fixedWidth ? { width: col.fixedWidth, minWidth: col.fixedWidth } : {}),
  });

  const alignClass = (col: ColDef) =>
    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="minDate" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Start ≥
            </label>
            <input
              id="minDate"
              type="date"
              value={minDate}
              onChange={e => onMinDateChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative" ref={priceFilterRef}>
            <button
              onClick={() => setShowPriceFilter(v => !v)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              Price
              {selectedPrices.length > 0 && (
                <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">
                  {selectedPrices.length}
                </span>
              )}
              <span className="text-gray-400">▼</span>
            </button>

            {showPriceFilter && (
              <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 min-w-[140px]">
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

          <span className="text-sm text-gray-600">
            {sorted.length} of {games.filter(g => g.status === 'done').length} games
          </span>

          <button
            onClick={() => setColsExpanded(v => !v)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium ml-auto"
          >
            {colsExpanded ? '← Fewer cols' : 'More cols →'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={thStyle(col)}
                  className={`px-3 py-3 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap bg-gray-50
                              ${alignClass(col)}
                              ${sortField === col.key ? 'text-blue-700 font-bold underline' : 'text-gray-700 font-semibold'}
                              ${col.lastFrozen ? 'border-r-2 border-gray-300' : ''}
                              ${getColClass(col)}`}
                >
                  {col.label}{sortField === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(game => {
              const isLoading = game.status === 'loading';
              const isError   = game.status === 'error';
              const rowBg = game.topPrizesRemaining === 0 && game.status === 'done'
                ? 'bg-red-50'
                : isLoading ? 'animate-pulse bg-gray-50'
                : isError   ? 'bg-yellow-50'
                : 'bg-white';
              return (
                <tr key={game.gameNumber} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                  {COLUMNS.map(col => (
                    <td
                      key={col.key}
                      style={tdStyle(col)}
                      className={`px-3 py-2 whitespace-nowrap
                        ${alignClass(col)}
                        ${col.frozen ? 'bg-inherit' : ''}
                        ${col.lastFrozen ? 'border-r-2 border-gray-200' : ''}
                        ${getColClass(col)}`}
                    >
                      {isLoading && col.key !== 'gameName' && !col.mobileVisible
                        ? <span className="inline-block w-12 h-4 bg-gray-200 rounded animate-pulse" />
                        : isError && col.key === 'packSize'
                          ? <span className="text-yellow-600 text-xs">{game.errorMessage || 'Error'}</span>
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
