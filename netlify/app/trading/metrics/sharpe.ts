// Calcul du ratio de Sharpe simplifié (annualisé) à partir d'une liste de trades
// Chaque trade possède un champ pnlPct (en %). On assimile chaque trade à un "retour".
// Hypothèse: ~252 périodes annuelles (jours de bourse) – ajustable selon besoin.

export interface SharpeInputs {
  pnlPct: number; // pourcentage
}

export function computeSharpe(trades: SharpeInputs[]): number {
  if (!trades.length) return 0;
  const returns = trades.map(t => t.pnlPct / 100);
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / returns.length;
  if (variance <= 0) return 0;
  const sharpe = (avg / Math.sqrt(variance)) * Math.sqrt(252);
  return Number.isFinite(sharpe) ? sharpe : 0;
}
