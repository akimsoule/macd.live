import { TARGET_EXPOSURES, START_CAPITAL } from './config';
import { initializeBitgetExchange, getBitgetAccountInfo } from './bitget-utils';
import { tradingHistory } from './trading-history';
import { prisma } from './db';

interface Cached<T> { data: T; expires: number }
const CACHE_TTL_MS = 10_000; // 10s
let lastSnapshot: Cached<any> | null = null;

async function loadMetrics(prisma: any) {
  let metrics = tradingHistory.calculateMetrics();
  if (prisma) {
    try {
      const latest = await prisma.metricSnapshot.findFirst({ orderBy: { timestamp: 'desc' } });
      if (latest) metrics = {
        totalTrades: latest.totalTrades,
        winningTrades: latest.winningTrades,
        losingTrades: latest.losingTrades,
        winRate: latest.winRate,
        totalPnl: latest.totalPnl,
        maxDrawdown: latest.maxDrawdown,
        sharpeRatio: latest.sharpeRatio,
        averageWin: latest.averageWin,
        averageLoss: latest.averageLoss,
        profitFactor: latest.profitFactor,
        maxConsecutiveWins: latest.maxConsecutiveWins,
        maxConsecutiveLosses: latest.maxConsecutiveLosses
      };
    } catch {}
  }
  return metrics;
}

async function loadTrades(prisma: any) {
  let trades = tradingHistory.getAllTrades();
  if (prisma) {
    try {
      const dbTrades = await prisma.trade.findMany({ orderBy: { exitTime: 'desc' }, take: 200 });
      if (dbTrades.length) trades = dbTrades.map((t: any) => ({
        symbol: t.symbol,
        side: t.side,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        pnlPct: t.pnlPct,
        pnlUsd: t.pnlUsd,
        reason: t.reason,
        barsHeld: t.barsHeld,
        openTime: t.entryTime.toISOString(),
        closeTime: t.exitTime.toISOString(),
        margin: t.margin,
        fees: t.fees
      }));
    } catch {}
  }
  return trades;
}

export async function getTradingSnapshot() {
  const now = Date.now();
  if (lastSnapshot && lastSnapshot.expires > now) return lastSnapshot.data;

  const symbols = Object.keys(TARGET_EXPOSURES);
  const exchange = await initializeBitgetExchange();
  const accountInfo = await getBitgetAccountInfo(exchange);

  const currentPositions: Record<string, any> = {};
  await Promise.all(symbols.map(async symbol => {
    try {
      const positions = await exchange.fetchPositions([symbol]);
      currentPositions[symbol] = positions.find(p => p.symbol === symbol && (p.contracts ?? 0) > 0) || null;
    } catch { currentPositions[symbol] = null; }
  }));

  const metrics = await loadMetrics(prisma);

  const allocation = symbols.map(symbol => {
    const cfg = TARGET_EXPOSURES[symbol];
    const pos = currentPositions[symbol];
    return {
      symbol: symbol.replace(':USDT',''),
      allocation: cfg.allocation,
      notional: cfg.notional,
      pnl: pos ? (pos.unrealizedPnl || 0) : 0,
      trades: metrics.totalTrades, // approximatif global
      status: pos ? (pos.side?.toUpperCase()) : 'NONE'
    };
  });

  const trades = await loadTrades(prisma);

  const initialCapital = START_CAPITAL;
  const totalPnl = metrics.totalPnl;
  const totalPnlPct = initialCapital ? (totalPnl / initialCapital) * 100 : 0;

  const marginRatio = accountInfo.usedMargin / accountInfo.totalBalance;
  const warnings: string[] = [];
  if (marginRatio > 0.8) warnings.push('⚠️ Utilisation de marge élevée (>80%)');
  if (accountInfo.freeMargin < accountInfo.totalBalance * 0.1) warnings.push('⚠️ Marge libre faible (<10%)');
  if (accountInfo.unrealizedPnl < -accountInfo.totalBalance * 0.15) warnings.push('⚠️ Pertes latentes importantes (>15%)');

  const snapshot = {
    summary: {
      initialCapital,
      finalEquity: accountInfo.totalBalance,
      totalPnl,
      totalPnlPct,
      totalTrades: metrics.totalTrades,
      winningTrades: metrics.winningTrades,
      losingTrades: metrics.losingTrades,
      winRate: metrics.winRate,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      lastUpdate: new Date().toISOString()
    },
    allocation,
    performance: [], // Option: equity history si besoin
    trades,
    accountHealth: {
      isHealthy: warnings.length === 0 && marginRatio < 0.7,
      warnings,
      marginRatio: marginRatio * 100
    }
  };

  lastSnapshot = { data: snapshot, expires: Date.now() + CACHE_TTL_MS };
  return snapshot;
}

export function invalidateTradingSnapshotCache() {
  lastSnapshot = null;
}
