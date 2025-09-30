// Calcul des séries gagnantes / perdantes max consécutives

export interface StreakTrade { pnlUsd: number }

export interface StreaksResult {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

export function computeStreaks(trades: StreakTrade[]): StreaksResult {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.pnlUsd > 0) {
      curWin++; curLoss = 0; if (curWin > maxWin) maxWin = curWin;
    } else {
      curLoss++; curWin = 0; if (curLoss > maxLoss) maxLoss = curLoss;
    }
  }
  return { maxConsecutiveWins: maxWin, maxConsecutiveLosses: maxLoss };
}
