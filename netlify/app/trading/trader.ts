import { Exchange } from "ccxt";
import { 
  TARGET_EXPOSURES, 
  LEVERAGE, 
  STOP_LOSS_PCT, 
  TIMEFRAME, 
  HISTORY_LIMIT, 
  MAKER_FEE, 
  TAKER_FEE, 
  SLIPPAGE,
  DEFAULT_FAST,
  DEFAULT_SLOW,
  DEFAULT_SIGNAL,
  SymbolConfig 
} from "./config.js";
import { 
  initializeBitgetExchange,
  getBitgetAccountInfo,
  calculateOptimalPositionSize,
  logAccountStatus,
  BitgetAccountInfo,
  retryWithTimeout,
  getBitgetFees
} from "./bitget-utils.js";
import { recordTrade } from './trading-history';
import { 
  notifyTradeOpen, 
  notifyTradeClose, 
  notifyNoAction, 
  notifyStopLoss, 
  notifyError
} from './notifications';
import { recomputeAndPersistMetrics } from './metrics-db';

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
  qty: number;
  notional: number;
  margin: number;
  stopLossPct: number;
  entryTime: number;
}

interface TradeResult {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  reason: string;
  success: boolean;
}

interface TradingState {
  currentBalance: number;
  currentPosition: Position | null;
  lastMacd: number;
  lastSignal: number;
}

// Calcul de l'EMA
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

// Calcul du MACD
function macd(closes: number[], fast: number, slow: number, signalP: number) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signal = ema(macdLine, signalP);
  const hist = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, hist };
}

// Détection des croisements MACD
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

// Récupération des données OHLCV
async function fetchOHLCV(
  exchange: Exchange,
  symbol: string
): Promise<Candle[]> {
  try {
    const raw = await retryWithTimeout('fetchOHLCV', () => exchange.fetchOHLCV(
      symbol,
      TIMEFRAME,
      undefined,
      HISTORY_LIMIT
    ), { retries: 2, timeoutMs: 10000 });
    return raw.map((r) => ({
      time: (r[0] as number) ?? 0,
      open: (r[1] as number) ?? 0,
      high: (r[2] as number) ?? 0,
      low: (r[3] as number) ?? 0,
      close: (r[4] as number) ?? 0,
      volume: (r[5] as number) ?? 0,
    }));
  } catch (e) {
    console.error(`❌ Erreur récupération OHLCV pour ${symbol}:`, e);
    throw e;
  }
}

// Récupération du solde depuis Bitget
async function getCurrentBalance(exchange: Exchange): Promise<BitgetAccountInfo> {
  try {
    return await getBitgetAccountInfo(exchange);
  } catch (e) {
    console.error("❌ Erreur récupération balance:", e);
    throw e;
  }
}

// Récupération des positions ouvertes
async function getCurrentPositions(exchange: Exchange, symbol: string): Promise<Position | null> {
  try {
  const positions = await retryWithTimeout('fetchPositionsSymbol', () => exchange.fetchPositions([symbol]));
    const pos = positions.find(p => p.symbol === symbol && (p.contracts ?? 0) > 0);
    
    if (!pos) return null;
    
    return {
      symbol: pos.symbol || symbol,
      side: pos.side?.toUpperCase() as "LONG" | "SHORT",
      entryPrice: pos.entryPrice ?? 0,
      qty: pos.contracts ?? 0,
      notional: pos.notional ?? 0,
      margin: pos.initialMargin ?? 0,
      stopLossPct: STOP_LOSS_PCT,
      entryTime: pos.timestamp ?? Date.now()
    };
  } catch (e) {
    console.error(`❌ Erreur récupération positions pour ${symbol}:`, e);
    return null;
  }
}

// Exécution d'un ordre
async function executeOrder(
  exchange: Exchange,
  symbol: string,
  side: "buy" | "sell",
  amount: number,
  price?: number
): Promise<any> {
  try {
    const orderType = price ? "limit" : "market";
  const order = await retryWithTimeout('createOrder', () => exchange.createOrder(symbol, orderType, side, amount, price));
    console.log(`✅ Ordre ${side} exécuté pour ${symbol}: ${amount} @ ${price || 'market'}`);
    return order;
  } catch (e) {
    console.error(`❌ Erreur exécution ordre ${side} pour ${symbol}:`, e);
    throw e;
  }
}

// Fermeture d'une position
async function closePosition(
  exchange: Exchange,
  position: Position,
  exitPrice: number,
  reason: string
): Promise<TradeResult> {
  try {
    const side = position.side === "LONG" ? "sell" : "buy";
  await executeOrder(exchange, position.symbol, side, position.qty, exitPrice);
    
    const pnlPriceMove = position.side === "LONG"
      ? (exitPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - exitPrice) / position.entryPrice;
    
    const pnlOnMargin = pnlPriceMove * LEVERAGE;
    const grossUsd = position.margin * pnlOnMargin;
    // Frais dynamiques sur l'aller + retour (approx: taker à l'ouverture + taker à la fermeture)
    let fees = position.notional * (MAKER_FEE + TAKER_FEE);
    try {
      const feeInfo = await getBitgetFees(exchange, position.symbol);
      fees = position.notional * (feeInfo.takerFee + feeInfo.takerFee); // assumption deux ordres taker
    } catch (feeErr) {
      console.warn('⚠️ Impossible de récupérer frais dynamiques, utilisation fallback statique:', (feeErr as any)?.message || feeErr);
    }
    const netUsd = grossUsd - fees;
    
    const result: TradeResult = {
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPct: (netUsd / position.margin) * 100,
      pnlUsd: netUsd,
      reason,
      success: true
    };
  recordTrade(result, { margin: position.margin, fees });
  notifyTradeClose({
    symbol: result.symbol,
    side: result.side,
    entry: result.entryPrice,
    exit: result.exitPrice,
    pnlPct: result.pnlPct,
    pnlUsd: result.pnlUsd,
    reason: result.reason
  });
  // Mise à jour snapshot métriques (best-effort)
  recomputeAndPersistMetrics().catch(e => console.warn('⚠️ recompute metrics échoué:', (e as any)?.message || e));
    return result;
  } catch (e) {
    console.error(`❌ Erreur fermeture position ${position.symbol}:`, e);
    return {
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      pnlPct: 0,
      pnlUsd: 0,
      reason: `ERROR: ${e}`,
      success: false
    };
  }
}

// Ouverture d'une position
async function openPosition(
  exchange: Exchange,
  symbol: string,
  side: "LONG" | "SHORT",
  entryPrice: number,
  config: SymbolConfig,
  accountInfo: BitgetAccountInfo
): Promise<Position | null> {
  try {
    const positionCalc = calculateOptimalPositionSize(accountInfo, config.notional, LEVERAGE);
    
    if (!positionCalc.canOpen) {
      console.warn(`⚠️ Impossible d'ouvrir position ${symbol}: ${positionCalc.reason}`);
      return null;
    }
    
    const notional = positionCalc.positionSize;
    const qty = notional / entryPrice;
    const orderSide = side === "LONG" ? "buy" : "sell";
    
    await executeOrder(exchange, symbol, orderSide, qty, entryPrice);
    
    return {
      symbol,
      side,
      entryPrice,
      qty,
      notional,
      margin: positionCalc.marginRequired,
      stopLossPct: STOP_LOSS_PCT,
      entryTime: Date.now()
    };
  } catch (e) {
    console.error(`❌ Erreur ouverture position ${symbol}:`, e);
    return null;
  }
}

// Gestion du stop-loss
async function handleStopLoss(
  exchange: Exchange,
  position: Position,
  currentPrice: number
): Promise<TradeResult | null> {
  const adverse = position.side === "LONG"
    ? currentPrice <= position.entryPrice * (1 - position.stopLossPct)
    : currentPrice >= position.entryPrice * (1 + position.stopLossPct);
  
  if (adverse) {
    const exitPrice = currentPrice * (1 - Math.sign(position.side === "LONG" ? 1 : -1) * SLIPPAGE);
    console.log(`🛑 Stop-loss déclenché pour ${position.symbol}`);
    return await closePosition(exchange, position, exitPrice, "STOP_LOSS");
  }
  
  return null;
}

// Gestion signal haussier (BULL)
async function handleBullSignal(
  exchange: Exchange,
  symbol: string,
  currentPrice: number,
  currentPosition: Position | null,
  config: SymbolConfig,
  accountInfo: BitgetAccountInfo
): Promise<TradeResult | null> {
  // Fermeture position short si elle existe
  if (currentPosition && currentPosition.side === "SHORT") {
    const exitPrice = currentPrice * (1 - SLIPPAGE);
    console.log(`🔄 Fermeture SHORT pour ${symbol} (signal BULL)`);
    const result = await closePosition(exchange, currentPosition, exitPrice, "SIGNAL_FLIP");
    
    // Tentative d'ouverture LONG si autorisé
    if (config.mode === "LONG_ONLY" || config.mode === "LONG_SHORT") {
      const entryPrice = currentPrice * (1 + SLIPPAGE);
      const newPosition = await openPosition(exchange, symbol, "LONG", entryPrice, config, accountInfo);
      if (newPosition) {
        console.log(`📈 Position LONG ouverte pour ${symbol}`);
        notifyTradeOpen({ symbol, side: 'LONG', price: entryPrice, leverage: LEVERAGE, notional: newPosition.notional });
      }
    }
    
    return result;
  }
  
  // Ouverture LONG si pas de position et mode autorisé
  if (!currentPosition && (config.mode === "LONG_ONLY" || config.mode === "LONG_SHORT")) {
    const entryPrice = currentPrice * (1 + SLIPPAGE);
    const newPosition = await openPosition(exchange, symbol, "LONG", entryPrice, config, accountInfo);
    if (newPosition) {
      console.log(`📈 Position LONG ouverte pour ${symbol}`);
      notifyTradeOpen({ symbol, side: 'LONG', price: entryPrice, leverage: LEVERAGE, notional: newPosition.notional });
      const opened: TradeResult = {
        symbol,
        side: "LONG",
        entryPrice,
        exitPrice: 0,
        pnlPct: 0,
        pnlUsd: 0,
        reason: "POSITION_OPENED",
        success: true
      };
      // On n'enregistre pas encore car trade pas fermé; pourrait stocker ouverture future
      return opened;
    }
  }
  
  return null;
}

// Gestion signal baissier (BEAR)
async function handleBearSignal(
  exchange: Exchange,
  symbol: string,
  currentPrice: number,
  currentPosition: Position | null,
  config: SymbolConfig,
  accountInfo: BitgetAccountInfo
): Promise<TradeResult | null> {
  // Fermeture position long si elle existe
  if (currentPosition && currentPosition.side === "LONG") {
    const exitPrice = currentPrice * (1 + SLIPPAGE);
    console.log(`🔄 Fermeture LONG pour ${symbol} (signal BEAR)`);
    const result = await closePosition(exchange, currentPosition, exitPrice, "SIGNAL_FLIP");
    
    // Tentative d'ouverture SHORT si autorisé
    if (config.mode === "LONG_SHORT") {
      const entryPrice = currentPrice * (1 - SLIPPAGE);
      const newPosition = await openPosition(exchange, symbol, "SHORT", entryPrice, config, accountInfo);
      if (newPosition) {
        console.log(`📉 Position SHORT ouverte pour ${symbol}`);
        notifyTradeOpen({ symbol, side: 'SHORT', price: entryPrice, leverage: LEVERAGE, notional: newPosition.notional });
      }
    }
    
    return result;
  }
  
  // Ouverture SHORT si pas de position et mode autorisé
  if (!currentPosition && config.mode === "LONG_SHORT") {
    const entryPrice = currentPrice * (1 - SLIPPAGE);
    const newPosition = await openPosition(exchange, symbol, "SHORT", entryPrice, config, accountInfo);
    if (newPosition) {
      console.log(`📉 Position SHORT ouverte pour ${symbol}`);
      notifyTradeOpen({ symbol, side: 'SHORT', price: entryPrice, leverage: LEVERAGE, notional: newPosition.notional });
      const opened: TradeResult = {
        symbol,
        side: "SHORT",
        entryPrice,
        exitPrice: 0,
        pnlPct: 0,
        pnlUsd: 0,
        reason: "POSITION_OPENED",
        success: true
      };
      return opened;
    }
  }
  
  return null;
}

// Fonction principale pour traiter un symbole
export async function runSymbol(symbol: string): Promise<TradeResult | null> {
  console.log(`🚀 Démarrage trading pour ${symbol}`);
  
  try {
    // Initialisation de l'exchange
    const exchange = await initializeBitgetExchange();
    
    // Récupération de la configuration du symbole
    const config = TARGET_EXPOSURES[symbol];
    if (!config) {
      throw new Error(`Configuration non trouvée pour ${symbol}`);
    }
    
    // Récupération des données
    const candles = await fetchOHLCV(exchange, symbol);
    if (candles.length < 50) {
      throw new Error(`Données insuffisantes pour ${symbol}: ${candles.length} barres`);
    }
    
    // Calcul MACD
    const closes = candles.map(c => c.close);
    const macdData = macd(
      closes,
      config.fast ?? DEFAULT_FAST,
      config.slow ?? DEFAULT_SLOW,
      config.signal ?? DEFAULT_SIGNAL
    );
    
    const lastIndex = candles.length - 1;
    const prevIndex = lastIndex - 1;
    
    // Détection du signal
    const cross = detectCross(
      macdData.macdLine[prevIndex],
      macdData.signal[prevIndex],
      macdData.macdLine[lastIndex],
      macdData.signal[lastIndex]
    );
    
    const currentPrice = candles[lastIndex].close;
    
    // Récupération état actuel
    const accountInfo = await getCurrentBalance(exchange);
    const currentPosition = await getCurrentPositions(exchange, symbol);
    
    // Log des informations de compte
    logAccountStatus(accountInfo);
    
    console.log(`📊 ${symbol}: Prix=${currentPrice}, Signal=${cross}, Position=${currentPosition?.side || 'NONE'}`);
    
    // Gestion stop-loss
    if (currentPosition) {
      const stopLossResult = await handleStopLoss(exchange, currentPosition, currentPrice);
      if (stopLossResult) {
        notifyStopLoss(symbol, currentPosition.side, stopLossResult.exitPrice);
        return stopLossResult;
      }
    }
    
    // Gestion des signaux
    if (cross === "BULL") {
      return await handleBullSignal(exchange, symbol, currentPrice, currentPosition, config, accountInfo);
    } else if (cross === "BEAR") {
      return await handleBearSignal(exchange, symbol, currentPrice, currentPosition, config, accountInfo);
    }
    
  console.log(`✅ Aucune action requise pour ${symbol}`);
  notifyNoAction(symbol, currentPrice, cross);
    return null;
    
  } catch (error) {
  console.error(`❌ Erreur lors du trading ${symbol}:`, error);
  notifyError('runSymbol', symbol, (error as any)?.message || String(error));
    return {
      symbol,
      side: "LONG",
      entryPrice: 0,
      exitPrice: 0,
      pnlPct: 0,
      pnlUsd: 0,
      reason: `ERROR: ${error}`,
      success: false
    };
  }
}