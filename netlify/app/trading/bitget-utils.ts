import ccxt, { Exchange } from "ccxt";
import { BITGET_CONFIG } from "./config.js";

export interface BitgetAccountInfo {
  totalBalance: number;
  availableBalance: number;
  usedMargin: number;
  freeMargin: number;
  unrealizedPnl: number;
}

export interface BitgetFeeInfo {
  takerFee: number;
  makerFee: number;
}

// Wrapper générique avec retry + timeout exponentiel
export async function retryWithTimeout<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: { retries?: number; timeoutMs?: number; backoffMs?: number } = {}
): Promise<T> {
  const { retries = 2, timeoutMs = 8000, backoffMs = 400 } = options;
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptLabel = `${operationName} (tentative ${attempt + 1}/${retries + 1})`;
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms`)), timeoutMs))
      ]);
      if (attempt > 0) {
        console.log(`✅ Réussi après retry: ${attemptLabel}`);
      }
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Échec ${attemptLabel}: ${err instanceof Error ? err.message : err}`);
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  console.error(`❌ Abandon après ${retries + 1} tentatives pour ${operationName}`);
  throw lastError;
}

// Initialise et retourne une instance de l'exchange Bitget
export async function initializeBitgetExchange(): Promise<Exchange> {
  const exchange = new ccxt.bitget(BITGET_CONFIG);
  
  try {
    await exchange.loadMarkets();
    console.log("✅ Exchange Bitget initialisé avec succès");
    return exchange;
  } catch (error) {
    console.error("❌ Erreur initialisation Bitget:", error);
    throw error;
  }
}

// Récupère les informations du compte de trading
export async function getBitgetAccountInfo(exchange: Exchange): Promise<BitgetAccountInfo> {
  try {
    const balance = await retryWithTimeout('fetchBalance', () => exchange.fetchBalance());
    const usdt = balance.USDT || { total: 0, free: 0, used: 0 };
    
    // Pour les futures, récupération des infos de marge
    const positions = await retryWithTimeout('fetchPositions', () => exchange.fetchPositions());
    const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    
    return {
      totalBalance: usdt.total || 0,
      availableBalance: usdt.free || 0,
      usedMargin: usdt.used || 0,
      freeMargin: usdt.free || 0,
      unrealizedPnl: totalUnrealizedPnl
    };
  } catch (error) {
    console.error("❌ Erreur récupération infos compte:", error);
    throw error;
  }
}

// Récupère les frais de trading actuels pour un symbole
export async function getBitgetFees(exchange: Exchange, symbol: string): Promise<BitgetFeeInfo> {
  try {
    const market = exchange.market(symbol);
    
    // Récupération des frais depuis la structure de marché
    return {
      makerFee: market.maker || 0.0002, // Frais maker par défaut Bitget
      takerFee: market.taker || 0.0006  // Frais taker par défaut Bitget
    };
  } catch (error) {
    console.warn(`⚠️ Erreur récupération frais pour ${symbol}, utilisation des valeurs par défaut:`, error);
    return {
      makerFee: 0.0002,
      takerFee: 0.0006
    };
  }
}

// Calcule la taille de position optimale basée sur le capital disponible
export function calculateOptimalPositionSize(
  accountInfo: BitgetAccountInfo,
  targetNotional: number,
  leverage: number,
  riskPercent: number = 0.02 // 2% de risque par défaut
): { 
  positionSize: number; 
  marginRequired: number; 
  canOpen: boolean; 
  reason?: string 
} {
  const marginRequired = targetNotional / leverage;
  const maxRiskAmount = accountInfo.freeMargin * riskPercent;
  
  // Vérifications de sécurité
  if (marginRequired > accountInfo.freeMargin) {
    return {
      positionSize: 0,
      marginRequired,
      canOpen: false,
      reason: `Marge insuffisante: ${marginRequired} requis, ${accountInfo.freeMargin} disponible`
    };
  }
  
  if (marginRequired > maxRiskAmount * 10) { // Max 10x le risque par trade
    return {
      positionSize: 0,
      marginRequired,
      canOpen: false,
      reason: `Position trop risquée par rapport au capital disponible`
    };
  }
  
  return {
    positionSize: targetNotional,
    marginRequired,
    canOpen: true
  };
}

// Vérifie la santé du compte (ratio de marge, exposition, etc.)
export function checkAccountHealth(accountInfo: BitgetAccountInfo): {
  isHealthy: boolean;
  warnings: string[];
  marginRatio: number;
} {
  const warnings: string[] = [];
  const marginRatio = accountInfo.usedMargin / accountInfo.totalBalance;
  
  // Vérifications de santé
  if (marginRatio > 0.8) {
    warnings.push("⚠️ Utilisation de marge élevée (>80%)");
  }
  
  if (accountInfo.freeMargin < accountInfo.totalBalance * 0.1) {
    warnings.push("⚠️ Marge libre faible (<10% du capital total)");
  }
  
  if (accountInfo.unrealizedPnl < -accountInfo.totalBalance * 0.15) {
    warnings.push("⚠️ Pertes latentes importantes (>15% du capital)");
  }
  
  const isHealthy = warnings.length === 0 && marginRatio < 0.7;
  
  return {
    isHealthy,
    warnings,
    marginRatio
  };
}

// Log des informations de compte pour monitoring
export function logAccountStatus(accountInfo: BitgetAccountInfo): void {
  console.log("📊 ==> STATUT DU COMPTE BITGET <==");
  console.log(`💰 Capital total: ${accountInfo.totalBalance.toFixed(2)} USDT`);
  console.log(`💵 Capital disponible: ${accountInfo.availableBalance.toFixed(2)} USDT`);
  console.log(`🔒 Marge utilisée: ${accountInfo.usedMargin.toFixed(2)} USDT`);
  console.log(`🆓 Marge libre: ${accountInfo.freeMargin.toFixed(2)} USDT`);
  console.log(`📈 PnL latent: ${accountInfo.unrealizedPnl.toFixed(2)} USDT`);
  
  const health = checkAccountHealth(accountInfo);
  console.log(`🏥 Santé du compte: ${health.isHealthy ? '✅ SAIN' : '⚠️ ATTENTION'}`);
  console.log(`📊 Ratio de marge: ${(health.marginRatio * 100).toFixed(1)}%`);
  
  if (health.warnings.length > 0) {
    console.log("🚨 Alertes:");
    health.warnings.forEach(warning => console.log(`  ${warning}`));
  }
}