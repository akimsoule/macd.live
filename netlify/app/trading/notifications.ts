import { telegramClient } from './CustomTelegramBot';

const ENABLED = !!process.env.TELEGRAM_KEY && !!process.env.TELEGRAM_GROUP_ID;

function safeSend(text: string) {
  if (!ENABLED) return;
  try { telegramClient.send(text).catch(() => {}); } catch {}
}

export function notifyTradeOpen(params: { symbol: string; side: 'LONG' | 'SHORT'; price: number; leverage: number; notional: number }) {
  const { symbol, side, price, leverage, notional } = params;
  safeSend(`🚀 *Ouverture* ${side} ${symbol}\nPrix: ${price.toFixed(6)}\nLev: x${leverage} Notional: ${notional}`);
}

export function notifyTradeClose(params: { symbol: string; side: 'LONG' | 'SHORT'; entry: number; exit: number; pnlPct: number; pnlUsd: number; reason: string }) {
  const { symbol, side, entry, exit, pnlPct, pnlUsd, reason } = params;
  const direction = pnlUsd >= 0 ? '✅' : '🔻';
  safeSend(`${direction} *Fermeture* ${side} ${symbol}\nEntry: ${entry.toFixed(6)} Exit: ${exit.toFixed(6)}\nPnL: ${pnlUsd >= 0 ? '+' : ''}${pnlUsd.toFixed(2)} USD (${pnlPct.toFixed(2)}%)\nRaison: ${reason}`);
}

export function notifyNoAction(symbol: string, price: number, signal: string | null) {
  safeSend(`ℹ️ ${symbol} aucune action. Prix=${price.toFixed(6)} Signal=${signal || 'NONE'}`);
}

export function notifyStopLoss(symbol: string, side: 'LONG' | 'SHORT', exitPrice: number) {
  safeSend(`🛑 Stop-Loss ${side} ${symbol} @ ${exitPrice.toFixed(6)}`);
}

export function notifyError(context: string, symbol: string, message: string) {
  safeSend(`❌ Erreur ${context} ${symbol}\n${message}`);
}

export function notifyManualRun(symbol: string, result: string) {
  safeSend(`🛠 Run manuel ${symbol}\n${result}`);
}

export function notifyAccountHealth(health: { isHealthy: boolean; marginRatio: number; warnings: string[] }) {
  if (!health) return;
  if (!health.isHealthy) {
    safeSend(`⚠️ Compte *ALERTE*\nMarge: ${(health.marginRatio * 100).toFixed(1)}%\n${health.warnings.slice(0,3).join('\n')}`);
  }
}
