import { prisma } from './db';
import { tradingHistory } from './trading-history';
import { computeSharpe } from './metrics/sharpe';
import { computeMaxDrawdown } from './metrics/drawdown';
import { computeStreaks } from './metrics/streaks';

/**
 * Module de calcul & persistance des métriques agrégées.
 * Détails:
 *  - Fallback mémoire si Prisma indisponible
 *  - Délègue Sharpe / Drawdown / Streaks à des sous-modules testables
 *  - Upsert sur timestamp (bucket seconde) pour éviter la duplication frénétique
 *  - ProfitFactor borne à 999 si pertes nulles mais gains positifs
 *
 * Améliorations futures possibles:
 *  - Paramétrer le capital initial réel (actuellement implicite dans computeMaxDrawdown via défaut 1000)
 *  - Ajouter un calcul de Sortino ou Calmar
 *  - Stocker aussi l'equity curve compressée (delta cumulés) pour requêtes front plus riches
 */

// Recalcule les métriques (depuis in-memory + DB trades si disponibles) et stocke un snapshot
export async function recomputeAndPersistMetrics() {
  try {
    // 1. Chargement trades (DB -> fallback mémoire)
    let trades: any[];
    try {
      trades = await prisma.trade.findMany();
    } catch {
      trades = tradingHistory.getAllTrades().map(t => ({
        pnlUsd: t.pnlUsd,
        pnlPct: t.pnlPct,
        symbol: t.symbol,
        side: t.side,
        exitTime: new Date(t.exitTime),
        reason: t.reason
      }));
    }
    if (!trades.length) return null;

    // Tri chronologique (influence drawdown + streaks)
    trades.sort((a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime());

    // 2. Agrégats de base
    const winning = trades.filter(t => t.pnlUsd > 0);
    const losing = trades.filter(t => t.pnlUsd <= 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnlUsd, 0);
    const grossProfit = winning.reduce((s, t) => s + t.pnlUsd, 0);
    const grossLossRaw = losing.reduce((s, t) => s + t.pnlUsd, 0);
    const grossLoss = Math.abs(grossLossRaw);
    const averageWin = winning.length ? grossProfit / winning.length : 0;
    const averageLoss = losing.length ? grossLoss / losing.length : 0;
    let profitFactor = 0;
    if (grossLoss > 0) profitFactor = grossProfit / grossLoss; else if (grossProfit > 0) profitFactor = 999;

    // 3. Calculs spécialisés délégués
    const { maxConsecutiveWins, maxConsecutiveLosses } = computeStreaks(trades);
    const sharpeRatio = computeSharpe(trades);
    const maxDrawdown = computeMaxDrawdown(trades);

    // 4. Persistence snapshot
    const snapshot = await prisma.metricSnapshot.upsert({
      where: { timestamp: new Date(new Date().toISOString().slice(0,19)+'Z') },
      update: {},
      create: {
        timestamp: new Date(),
        totalTrades: trades.length,
        winningTrades: winning.length,
        losingTrades: losing.length,
        winRate: winning.length / trades.length * 100,
        totalPnl,
        maxDrawdown,
        sharpeRatio,
        averageWin,
        averageLoss,
        profitFactor,
        maxConsecutiveWins,
        maxConsecutiveLosses
      }
    });
    return snapshot;
  } catch (e) {
    console.warn('⚠️ Échec recompute metrics:', (e as any)?.message || e);
    return null;
  }
}

export async function getLatestMetrics() {
  try {
    const latest = await prisma.metricSnapshot.findFirst({ orderBy: { timestamp: 'desc' } });
    return latest;
  } catch {
    return null;
  }
}
