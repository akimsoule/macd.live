import { useState, useEffect, useCallback, useRef } from "react";

export interface TradingSummary {
  initialCapital: number;
  finalEquity: number;
  totalPnl: number;
  totalPnlPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  lastUpdate?: string;
}

export interface AllocationItem {
  symbol: string;
  allocation: number;
  notional: number;
  pnl: number;
  trades: number;
  status?: "LONG" | "SHORT" | "NONE";
}

export interface PerformancePoint {
  timestamp: string;
  equity: number;
  drawdown: number;
}

export interface TradeItem {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  reason: string;
  barsHeld: number;
}

export interface AccountHealth {
  isHealthy: boolean;
  warnings: string[];
  marginRatio: number; // en %
}

export interface TradingData {
  summary: TradingSummary;
  allocation: AllocationItem[];
  performance: PerformancePoint[];
  trades: TradeItem[];
  accountHealth?: AccountHealth;
}

interface UseTradingDataOptions {
  pollIntervalMs?: number; // par défaut 5 min
  immediate?: boolean; // déclenche un fetch immédiat
  endpoint?: string; // endpoint override
}

interface UseTradingDataResult {
  data: TradingData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastFetched: number | null;
  isStale: boolean;
}

const DEFAULT_ENDPOINT = "/api/trading-data";
const DEFAULT_POLL = 5 * 60 * 1000; // 5 min

export function useTradingData(
  options: UseTradingDataOptions = {}
): UseTradingDataResult {
  const {
    pollIntervalMs = DEFAULT_POLL,
    immediate = true,
    endpoint = DEFAULT_ENDPOINT,
  } = options;

  const [data, setData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // Essai principal
      const token = localStorage.getItem("auth_token");
      const baseHeaders: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) baseHeaders["Authorization"] = `Bearer ${token}`;
      let res = await fetch(endpoint, {
        signal: controller.signal,
        headers: baseHeaders,
      });
      // Si on obtient du HTML (ex: fallback index.html), tenter endpoint fonctions direct
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        // fallback vers ancienne route (compat)
        try {
          const fallbackHeaders = { ...baseHeaders };
          res = await fetch("/.netlify/functions/trading-data", {
            signal: controller.signal,
            headers: fallbackHeaders,
          });
        } catch {}
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const finalCt = res.headers.get("content-type") || "";
      if (!finalCt.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          `Réponse non JSON (content-type=${
            finalCt || "inconnu"
          }) extrait="${text.slice(0, 60)}"`
        );
      }
      const json = await res.json();
      setData(json);
      setLastFetched(Date.now());
    } catch (e: any) {
      if (e.name === "AbortError") return; // fetch annulé
      console.error("[useTradingData] fetch error", e);
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // refresh public
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // auto fetch initial
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData, immediate]);

  // polling
  useEffect(() => {
    if (!pollIntervalMs) return;

    function schedule() {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(async () => {
        await fetchData();
        schedule();
      }, pollIntervalMs);
    }

    schedule();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [pollIntervalMs, fetchData]);

  const isStale = lastFetched
    ? Date.now() - lastFetched > pollIntervalMs * 1.5
    : true;

  return { data, loading, error, refresh, lastFetched, isStale };
}
