// Calcul du max drawdown à partir d'une equity simulée.
// On part d'un capital initial fourni et on additionne les pnlUsd des trades dans l'ordre chrono.

export interface DrawdownTrade { pnlUsd: number; exitTime: Date | string; }

export function computeMaxDrawdown(trades: DrawdownTrade[], initialEquity = 1000): number {
  let equity = initialEquity;
  let peak = equity;
  let maxDD = 0; // valeur négative en %
  for (const t of trades) {
    equity += t.pnlUsd;
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak * 100;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD; // ex: -12.5
}
