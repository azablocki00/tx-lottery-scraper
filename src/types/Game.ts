export interface GameSummary {
  gameNumber: string;
  gameName: string;
  startDate: string;
  ticketPrice: number;
  detailUrl: string;
}

export interface GameDetail {
  packSize: number;
  guaranteedPrizeAmount: number;
  totalTickets: number;
  overallOdds: string;
  topPrize: number;
  topPrizeInGame: number;
  topPrizeClaimed: number;
  prizesFound: boolean;
}

export interface Game extends GameSummary, GameDetail {
  // Calculated fields
  packCost: number;           // ticketPrice * packSize
  maxLoss: number;            // guaranteedPrizeAmount - packCost
  maxLossPercent: number;     // (abs(maxLoss) / packCost) * 100
  topPrizesRemaining: number; // topPrizeInGame - topPrizeClaimed
  status: 'loading' | 'done' | 'error';
  errorMessage?: string;
}

export type SortField = keyof Game;
export type SortDirection = 'asc' | 'desc';
