export const START_CAPITAL = 1000;
export const LEVERAGE = 5;
export const STOP_LOSS_PCT = 0.22;
export const TIMEFRAME = "1h";
export const HISTORY_LIMIT = 1000;
export const MAKER_FEE = 0.0002;
export const TAKER_FEE = 0.0006;
export const SLIPPAGE = 0.0002;

export interface SymbolConfig {
  symbol: string;
  notional: number;
  mode: "LONG_ONLY" | "LONG_SHORT";
  allocation: number;
  fast: number;
  slow: number;
  signal: number;
}

export const TARGET_EXPOSURES: Record<string, SymbolConfig> = {
  "IP/USDT:USDT": { 
    symbol: "IP/USDT:USDT", 
    notional: 1250, 
    mode: "LONG_ONLY", 
    allocation: 0.5, 
    fast: 16, 
    slow: 26, 
    signal: 7 
  },
  "PEOPLE/USDT:USDT": { 
    symbol: "PEOPLE/USDT:USDT", 
    notional: 750, 
    mode: "LONG_SHORT", 
    allocation: 0.3, 
    fast: 16, 
    slow: 34, 
    signal: 11 
  },
  "AVNT/USDT:USDT": { 
    symbol: "AVNT/USDT:USDT", 
    notional: 250, 
    mode: "LONG_ONLY", 
    allocation: 0.1, 
    fast: 12, 
    slow: 26, 
    signal: 11 
  },
  "0G/USDT:USDT": { 
    symbol: "0G/USDT:USDT", 
    notional: 250, 
    mode: "LONG_ONLY", 
    allocation: 0.1, 
    fast: 16, 
    slow: 34, 
    signal: 7 
  },
};

// Fallbacks par défaut
export const DEFAULT_FAST = 12;
export const DEFAULT_SLOW = 26;
export const DEFAULT_SIGNAL = 9;

// Configuration Bitget
export const BITGET_CONFIG = {
  enableRateLimit: true,
  options: { defaultType: "swap" },
  // Les clés API seront récupérées depuis les variables d'environnement
  apiKey: process.env.ACCOUNT_API_KEY_MAIN,
  secret: process.env.ACCOUNT_SECRET_KEY_MAIN,
  password: process.env.API_PASS,
  sandbox: false,
};