// Utilitaire pour gérer l'historique des trades et les métriques de performance
// Ce fichier sera utilisé pour stocker et récupérer l'historique des trades

interface TradeRecord {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  reason: string;
  barsHeld: number;
  entryTime: string;
  exitTime: string;
  margin: number;
  fees: number;
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

interface EquitySnapshot {
  timestamp: string;
  equity: number;
  drawdown: number;
  totalPnl: number;
}

// Simulation d'une base de données simple (en production, utiliser une vraie DB)
class TradingHistory {
  private trades: TradeRecord[] = [];
  private equityHistory: EquitySnapshot[] = [];
  private readonly initialCapital = 1000;

  // Enregistre un nouveau trade
  addTrade(trade: Omit<TradeRecord, 'id'>): string {
    const id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullTrade: TradeRecord = { ...trade, id };
    this.trades.push(fullTrade);
    
    // Mise à jour de l'historique d'équité
    this.updateEquityHistory();
    
    console.log(`✅ Trade enregistré: ${trade.symbol} ${trade.side} PnL: ${trade.pnlUsd.toFixed(2)} USDT`);

    // Tentative de persistance Prisma (meilleure-effort)
    import('../trading/db.js').then(({ prisma }) => {
  prisma.trade.create({
        data: {
          id,
          symbol: trade.symbol,
          side: trade.side,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            pnlPct: trade.pnlPct,
            pnlUsd: trade.pnlUsd,
            reason: trade.reason,
            barsHeld: trade.barsHeld,
            entryTime: new Date(trade.entryTime),
            exitTime: new Date(trade.exitTime),
            margin: trade.margin,
            fees: trade.fees,
            success: true
        }
  }).catch((e: unknown) => console.warn('⚠️ Échec persistance trade Prisma:', (e as any)?.message || e));
      // Snapshot equity (dernier)
      const lastEq = this.equityHistory[this.equityHistory.length - 1];
      if (lastEq) {
        prisma.equitySnapshot.upsert({
          where: { timestamp: new Date(lastEq.timestamp) },
          update: { equity: lastEq.equity, drawdown: lastEq.drawdown, totalPnl: lastEq.totalPnl },
          create: { equity: lastEq.equity, drawdown: lastEq.drawdown, totalPnl: lastEq.totalPnl, timestamp: new Date(lastEq.timestamp) }
  }).catch((e: unknown) => console.warn('⚠️ Échec persistance equity Prisma:', (e as any)?.message || e));
      }
    }).catch(() => {/* Prisma indisponible en environnement actuel */});
    return id;
  }

  // Récupère tous les trades
  getAllTrades(): TradeRecord[] {
    return [...this.trades].sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());
  }

  // Récupère les trades par symbole
  getTradesBySymbol(symbol: string): TradeRecord[] {
    return this.trades.filter(trade => trade.symbol === symbol);
  }

  // Calcule les métriques de performance
  calculateMetrics(): PerformanceMetrics {
    if (this.trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0
      };
    }

    const winningTrades = this.trades.filter(t => t.pnlUsd > 0);
    const losingTrades = this.trades.filter(t => t.pnlUsd <= 0);
    const totalPnl = this.trades.reduce((sum, t) => sum + t.pnlUsd, 0);
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnlUsd, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlUsd, 0));
    
    const averageWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
    
    // Calcul du profit factor
    let profitFactor = 0;
    if (grossLoss > 0) {
      profitFactor = grossProfit / grossLoss;
    } else if (grossProfit > 0) {
      profitFactor = 999; // Valeur très élevée quand il n'y a que des gains
    }
    
    // Calcul du drawdown maximum
    const maxDrawdown = this.calculateMaxDrawdown();
    
    // Calcul du ratio de Sharpe (simplifié)
    const returns = this.trades.map(t => t.pnlPct / 100);
    const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) / returns.length;
    const sharpeRatio = variance > 0 ? (averageReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0; // Annualisé
    
    // Calcul des séries consécutives
    const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateConsecutiveStreaks();

    return {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / this.trades.length) * 100,
      totalPnl,
      maxDrawdown,
      sharpeRatio,
      averageWin,
      averageLoss,
      profitFactor,
      maxConsecutiveWins,
      maxConsecutiveLosses
    };
  }

  // Calcule le drawdown maximum
  private calculateMaxDrawdown(): number {
    if (this.equityHistory.length === 0) return 0;

    let maxEquity = this.initialCapital;
    let maxDrawdown = 0;

    for (const snapshot of this.equityHistory) {
      if (snapshot.equity > maxEquity) {
        maxEquity = snapshot.equity;
      }
      const currentDrawdown = ((snapshot.equity - maxEquity) / maxEquity) * 100;
      if (currentDrawdown < maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    return maxDrawdown;
  }

  // Calcule les séries consécutives de gains/pertes
  private calculateConsecutiveStreaks(): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of this.trades) {
      if (trade.pnlUsd > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      }
    }

    return { maxConsecutiveWins, maxConsecutiveLosses };
  }

  // Met à jour l'historique d'équité
  private updateEquityHistory(): void {
    const totalPnl = this.trades.reduce((sum, t) => sum + t.pnlUsd, 0);
    const currentEquity = this.initialCapital + totalPnl;
    
    // Calcul du drawdown actuel
    const maxEquity = Math.max(this.initialCapital, ...this.equityHistory.map(h => h.equity));
    const drawdown = maxEquity > 0 ? ((currentEquity - maxEquity) / maxEquity) * 100 : 0;

    this.equityHistory.push({
      timestamp: new Date().toISOString(),
      equity: currentEquity,
      drawdown,
      totalPnl
    });

    // Garde seulement les 1000 derniers points pour éviter une croissance excessive
    if (this.equityHistory.length > 1000) {
      this.equityHistory = this.equityHistory.slice(-1000);
    }
  }

  // Récupère l'historique d'équité
  getEquityHistory(): EquitySnapshot[] {
    return [...this.equityHistory];
  }

  // Récupère les métriques par symbole
  getSymbolMetrics(): Record<string, { trades: number; pnl: number; winRate: number }> {
    const symbolMetrics: Record<string, { trades: number; pnl: number; winRate: number }> = {};

    for (const trade of this.trades) {
      if (!symbolMetrics[trade.symbol]) {
        symbolMetrics[trade.symbol] = { trades: 0, pnl: 0, winRate: 0 };
      }
      
      symbolMetrics[trade.symbol].trades++;
      symbolMetrics[trade.symbol].pnl += trade.pnlUsd;
    }

    // Calcul du taux de réussite par symbole
    for (const symbol in symbolMetrics) {
      const symbolTrades = this.getTradesBySymbol(symbol);
      const winningTrades = symbolTrades.filter(t => t.pnlUsd > 0).length;
      symbolMetrics[symbol].winRate = symbolTrades.length > 0 ? (winningTrades / symbolTrades.length) * 100 : 0;
    }

    return symbolMetrics;
  }

  // Exporte les données pour sauvegarde
  export(): { trades: TradeRecord[]; equityHistory: EquitySnapshot[] } {
    return {
      trades: this.trades,
      equityHistory: this.equityHistory
    };
  }

  // Importe des données depuis une sauvegarde
  import(data: { trades: TradeRecord[]; equityHistory: EquitySnapshot[] }): void {
    this.trades = data.trades || [];
    this.equityHistory = data.equityHistory || [];
  }
}

// Instance singleton pour l'application
export const tradingHistory = new TradingHistory();

// Fonction utilitaire pour ajouter un trade depuis les fonctions de trading
export function recordTrade(result: {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  reason: string;
  success: boolean;
}, additionalData?: {
  barsHeld?: number;
  entryTime?: string;
  margin?: number;
  fees?: number;
}): string | null {
  if (!result.success) return null;

  return tradingHistory.addTrade({
    symbol: result.symbol,
    side: result.side,
    entryPrice: result.entryPrice,
    exitPrice: result.exitPrice,
    pnlPct: result.pnlPct,
    pnlUsd: result.pnlUsd,
    reason: result.reason,
    barsHeld: additionalData?.barsHeld || 0,
    entryTime: additionalData?.entryTime || new Date().toISOString(),
    exitTime: new Date().toISOString(),
    margin: additionalData?.margin || 0,
    fees: additionalData?.fees || 0
  });
}

export type { TradeRecord, PerformanceMetrics, EquitySnapshot };