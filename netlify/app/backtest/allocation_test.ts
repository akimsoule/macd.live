// Backtest d'allocation multi-symbole avec gestion du risque cross margin
// Objectif: capital initial 1000$, exposition cible ~2500$ (levier effectif 2.5x),
// buffer de marge libre ~500$.
// Allocation:
//  IP/USDT (LONG_ONLY)  : 50% => 1250$
//  PEOPLE/USDT (LONG/SHORT) : 30% => 750$
//  AVNT/USDT (LONG/SHORT)   : 10% => 250$
//  0G/USDT (LONG/SHORT)     : 10% => 250$
// Stop-loss souple: fermeture si perte latente atteint 22% (entre 20–25%).
// Sortie standard: signal inverse MACD.
// Levier utilisé: 5x (marge utilisée totale ≈ 500$ laissant 500$ buffer).

import ccxt, { Exchange } from "ccxt";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  qty: number; // quantité (notional / price)
  notional: number; // exposition cible
  margin: number; // marge immobilisée
  stopLossPct: number; // ex: 0.22
  entryIndex: number;
}
interface Trade {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number; // sur marge
  pnlUsd: number; // réalisé
  reason: string; // TP/SL/Signal
  barsHeld: number;
}

// Config
const START_CAPITAL = 1000;
const LEVERAGE = 5; // 5x -> exposition totale visée 2500 => marge 500
interface SymbolConfig {
  notional: number;
  mode: "LONG_ONLY" | "LONG_SHORT";
  allocation: number;
  fast: number;
  slow: number;
  signal: number;
}
const TARGET_EXPOSURES: Record<string, SymbolConfig> = {
  // Crypto  Fast Slow Signal Style
  "IP/USDT:USDT": {
    notional: 1250,
    mode: "LONG_ONLY",
    allocation: 0.5,
    fast: 16,
    slow: 26,
    signal: 7,
  },
  "PEOPLE/USDT:USDT": {
    notional: 750,
    mode: "LONG_SHORT",
    allocation: 0.3,
    fast: 16,
    slow: 34,
    signal: 11,
  },
  "AVNT/USDT:USDT": {
    notional: 250,
    mode: "LONG_ONLY",
    allocation: 0.1,
    fast: 12,
    slow: 26,
    signal: 11,
  },
  "0G/USDT:USDT": {
    notional: 250,
    mode: "LONG_ONLY",
    allocation: 0.1,
    fast: 16,
    slow: 34,
    signal: 7,
  },
};
const STOP_LOSS_PCT = 0.22; // 22% (entre 20 et 25)
// Fallback si jamais paramètre manquant
const DEFAULT_FAST = 12,
  DEFAULT_SLOW = 26,
  DEFAULT_SIGNAL = 9;
const TIMEFRAME = "1h";
const HISTORY_LIMIT = 1000; // ~25 jours
const MAKER_FEE = 0.0002;
const TAKER_FEE = 0.0006;
const SLIPPAGE = 0.0002; // 2 bps

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = values[i] * k + prev * (1 - k);
    out.push(v);
    prev = v;
  }
  return out;
}

function macd(closes: number[], fast: number, slow: number, signalP: number) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signal = ema(macdLine, signalP);
  const hist = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, hist };
}

function detectCross(
  prevMacd: number,
  prevSig: number,
  macd: number,
  sig: number
): "BULL" | "BEAR" | null {
  if (prevMacd < prevSig && macd > sig) return "BULL";
  if (prevMacd > prevSig && macd < sig) return "BEAR";
  return null;
}

async function fetchOHLCV(
  exchange: Exchange,
  symbol: string
): Promise<Candle[]> {
  try {
    const raw = await exchange.fetchOHLCV(
      symbol,
      TIMEFRAME,
      undefined,
      HISTORY_LIMIT
    );
    return raw.map((r) => ({
      time: (r[0] as number) ?? 0,
      open: (r[1] as number) ?? 0,
      high: (r[2] as number) ?? 0,
      low: (r[3] as number) ?? 0,
      close: (r[4] as number) ?? 0,
      volume: (r[5] as number) ?? 0,
    }));
  } catch (e) {
    console.warn(`⚠️  OHLCV fail ${symbol}:`, e);
    return [];
  }
}

async function run() {
  const exchange = new ccxt.bitget({
    enableRateLimit: true,
    options: { defaultType: "swap" },
  });
  await exchange.loadMarkets();

  const symbols = Object.keys(TARGET_EXPOSURES);
  console.log(`▶️  Lancement test allocation sur ${symbols.length} symboles`);

  let equity = START_CAPITAL;
  let freeMargin = START_CAPITAL; // marge disponible
  let usedMargin = 0; // marge immobilisée
  const positions: Record<string, Position | null> = Object.fromEntries(
    symbols.map((s) => [s, null])
  );
  const trades: Trade[] = [];

  // Récupère les données
  const dataMap: Record<string, Candle[]> = {};
  for (const s of symbols) {
    dataMap[s] = await fetchOHLCV(exchange, s);
  }

  // Détermine la longueur minimale commune
  const minLen = Math.min(...symbols.map((s) => dataMap[s].length));
  if (!isFinite(minLen) || minLen < 50) {
    console.error("❌ Données insuffisantes.");
    return;
  }
  console.log(`📊 Longueur commune: ${minLen} barres`);

  // Pré-calcul MACD par symbole (paramètres dédiés)
  const macdMap: Record<string, ReturnType<typeof macd>> = {};
  for (const s of symbols) {
    const closes = dataMap[s].map((c) => c.close);
    const cfg = TARGET_EXPOSURES[s];
    macdMap[s] = macd(
      closes,
      cfg.fast ?? DEFAULT_FAST,
      cfg.slow ?? DEFAULT_SLOW,
      cfg.signal ?? DEFAULT_SIGNAL
    );
  }

  const marginTargetPerSymbol: Record<string, number> = {};
  for (const [sym, cfg] of Object.entries(TARGET_EXPOSURES)) {
    marginTargetPerSymbol[sym] = cfg.notional / LEVERAGE; // ex: 1250/5 = 250
  }
  const totalPlannedMargin = Object.values(marginTargetPerSymbol).reduce(
    (a, b) => a + b,
    0
  );
  console.log(
    `🧮 Marge planifiée: ${totalPlannedMargin.toFixed(2)} (buffer attendu ${(
      START_CAPITAL - totalPlannedMargin
    ).toFixed(2)})`
  );

  const maxSlow = Math.max(...symbols.map((s) => TARGET_EXPOSURES[s].slow));
  for (let i = maxSlow + 2; i < minLen; i++) {
    // on saute le warmup EMA
    for (const sym of symbols) {
      const candles = dataMap[sym];
      const m = macdMap[sym];
      const prevIdx = i - 1;
      const cross = detectCross(
        m.macdLine[prevIdx],
        m.signal[prevIdx],
        m.macdLine[i],
        m.signal[i]
      );
      const price = candles[i].close;
      const cfg = TARGET_EXPOSURES[sym];
      let pos = positions[sym];

      // Mise à jour stop-loss (vérification)
      if (pos) {
        const adverse =
          pos.side === "LONG"
            ? price <= pos.entryPrice * (1 - pos.stopLossPct)
            : price >= pos.entryPrice * (1 + pos.stopLossPct);
        if (adverse) {
          const exitPrice =
            price * (1 - Math.sign(pos.side === "LONG" ? 1 : -1) * SLIPPAGE); // glissement
          const pnlPriceMove =
            pos.side === "LONG"
              ? (exitPrice - pos.entryPrice) / pos.entryPrice
              : (pos.entryPrice - exitPrice) / pos.entryPrice;
          const pnlOnMargin = pnlPriceMove * LEVERAGE;
          const grossUsd = pos.margin * pnlOnMargin;
          const fees = pos.notional * (MAKER_FEE + TAKER_FEE); // approx entrée + sortie
          const netUsd = grossUsd - fees;
          equity += netUsd; // ajuster equity
          usedMargin -= pos.margin;
          freeMargin = equity - usedMargin;
          trades.push({
            symbol: sym,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice,
            pnlPct: (netUsd / pos.margin) * 100,
            pnlUsd: netUsd,
            reason: "STOP_LOSS",
            barsHeld: i - pos.entryIndex,
          });
          positions[sym] = null;
          pos = null;
          continue; // on passe au symbole suivant (évite ré-ouvrir dans la même barre)
        }
      }

      // Gestion des signaux
      if (cross === "BULL") {
        // fermeture éventuelle short
        if (pos && pos.side === "SHORT") {
          const exitPrice = price * (1 - SLIPPAGE);
          const pnlPriceMove = (pos.entryPrice - exitPrice) / pos.entryPrice; // short gain si baisse
          const pnlOnMargin = pnlPriceMove * LEVERAGE;
          const grossUsd = pos.margin * pnlOnMargin;
          const fees = pos.notional * (MAKER_FEE + TAKER_FEE);
          const netUsd = grossUsd - fees;
          equity += netUsd;
          usedMargin -= pos.margin;
          freeMargin = equity - usedMargin;
          trades.push({
            symbol: sym,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice,
            pnlPct: (netUsd / pos.margin) * 100,
            pnlUsd: netUsd,
            reason: "SIGNAL_FLIP",
            barsHeld: i - pos.entryIndex,
          });
          positions[sym] = null;
          pos = null;
        }
        // ouverture long si mode autorise et pas déjà position
        if (!pos && (cfg.mode === "LONG_ONLY" || cfg.mode === "LONG_SHORT")) {
          const targetMargin = marginTargetPerSymbol[sym];
          if (freeMargin >= targetMargin) {
            const entryPrice = price * (1 + SLIPPAGE);
            const notional = targetMargin * LEVERAGE;
            const qty = notional / entryPrice;
            usedMargin += targetMargin;
            freeMargin = equity - usedMargin;
            positions[sym] = {
              symbol: sym,
              side: "LONG",
              entryPrice,
              qty,
              notional,
              margin: targetMargin,
              stopLossPct: STOP_LOSS_PCT,
              entryIndex: i,
            };
          }
        }
      } else if (cross === "BEAR") {
        // fermeture éventuelle long
        if (pos && pos.side === "LONG") {
          const exitPrice = price * (1 + SLIPPAGE);
          const pnlPriceMove = (exitPrice - pos.entryPrice) / pos.entryPrice; // long gain si hausse
          const pnlOnMargin = pnlPriceMove * LEVERAGE;
          const grossUsd = pos.margin * pnlOnMargin;
          const fees = pos.notional * (MAKER_FEE + TAKER_FEE);
          const netUsd = grossUsd - fees;
          equity += netUsd;
          usedMargin -= pos.margin;
          freeMargin = equity - usedMargin;
          trades.push({
            symbol: sym,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice,
            pnlPct: (netUsd / pos.margin) * 100,
            pnlUsd: netUsd,
            reason: "SIGNAL_FLIP",
            barsHeld: i - pos.entryIndex,
          });
          positions[sym] = null;
          pos = null;
        }
        // ouverture short si mode long/short
        if (!pos && TARGET_EXPOSURES[sym].mode === "LONG_SHORT") {
          const targetMargin = marginTargetPerSymbol[sym];
          if (freeMargin >= targetMargin) {
            const entryPrice = price * (1 - SLIPPAGE);
            const notional = targetMargin * LEVERAGE;
            const qty = notional / entryPrice;
            usedMargin += targetMargin;
            freeMargin = equity - usedMargin;
            positions[sym] = {
              symbol: sym,
              side: "SHORT",
              entryPrice,
              qty,
              notional,
              margin: targetMargin,
              stopLossPct: STOP_LOSS_PCT,
              entryIndex: i,
            };
          }
        }
      }
    }
  }

  // Ferme toute position restante à la fin
  for (const sym of symbols) {
    const pos = positions[sym];
    if (!pos) continue;
    const candles = dataMap[sym];
    const lastPrice = candles[minLen - 1].close;
    const exitPrice =
      lastPrice * (pos.side === "LONG" ? 1 - SLIPPAGE : 1 + SLIPPAGE);
    const priceMove =
      pos.side === "LONG"
        ? (exitPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - exitPrice) / pos.entryPrice;
    const pnlOnMargin = priceMove * LEVERAGE;
    const grossUsd = pos.margin * pnlOnMargin;
    const fees = pos.notional * (MAKER_FEE + TAKER_FEE);
    const netUsd = grossUsd - fees;
    equity += netUsd;
    usedMargin -= pos.margin;
    freeMargin = equity - usedMargin;
    trades.push({
      symbol: sym,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      pnlPct: (netUsd / pos.margin) * 100,
      pnlUsd: netUsd,
      reason: "FORCE_CLOSE_END",
      barsHeld: minLen - 1 - pos.entryIndex,
    });
  }

  // Résumé
  const wins = trades.filter((t) => t.pnlUsd > 0).length;
  const losses = trades.filter((t) => t.pnlUsd <= 0).length;

  console.log("\n===== RÉSUMÉ TEST ALLOCATION =====");
  console.log(`Capital initial : ${START_CAPITAL.toFixed(2)} USDT`);
  console.log(`Capital final   : ${equity.toFixed(2)} USDT`);
  console.log(
    `PnL net         : ${(equity - START_CAPITAL).toFixed(2)} USDT (${(
      (equity / START_CAPITAL - 1) *
      100
    ).toFixed(2)}%)`
  );
  console.log(
    `Trades          : ${trades.length} (Gagnants ${wins} / Perdants ${losses})`
  );
  console.log(
    `Marge max planifiée : ${totalPlannedMargin.toFixed(
      2
    )} USDT (buffer min théorique ${(
      START_CAPITAL - totalPlannedMargin
    ).toFixed(2)})`
  );

  // Par symbole
  const bySymbol: Record<string, { pnlUsd: number; trades: number }> = {};
  for (const t of trades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnlUsd: 0, trades: 0 };
    bySymbol[t.symbol].pnlUsd += t.pnlUsd;
    bySymbol[t.symbol].trades += 1;
  }
  console.log("\nDétails par symbole:");
  for (const sym of symbols) {
    const d = bySymbol[sym] || { pnlUsd: 0, trades: 0 };
    const alloc = TARGET_EXPOSURES[sym];
    console.log(
      ` - ${sym} alloc ${(alloc.allocation * 100).toFixed(0)}% notional ${
        alloc.notional
      } | trades ${d.trades} | PnL ${d.pnlUsd.toFixed(2)} USDT`
    );
  }

  // Export log CSV (optionnel simple)
  const csvLines = [
    "symbol,side,entryPrice,exitPrice,pnlPct,pnlUsd,reason,barsHeld",
  ];
  for (const t of trades) {
    csvLines.push(
      [
        t.symbol,
        t.side,
        t.entryPrice.toFixed(6),
        t.exitPrice.toFixed(6),
        t.pnlPct.toFixed(2),
        t.pnlUsd.toFixed(4),
        t.reason,
        t.barsHeld,
      ].join(",")
    );
  }
  const fs = await import("fs");
  fs.writeFileSync("allocation_trades.csv", csvLines.join("\n"));
  console.log("\n📝 Fichier allocation_trades.csv écrit.");
}

run().catch((e) => console.error("Erreur run allocation test", e));
