import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

export interface RunSymbolResult {
  ok: boolean;
  symbol: string;
  result?: any;
  error?: string;
}

interface UseRunSymbolOptions {
  endpoint?: string; // base endpoint e.g. '/api/run-symbol'
  autoRefresh?: () => void; // callback pour rafraîchir d'autres données (ex: trading snapshot)
  enableToast?: boolean; // afficher toasts succès/erreur
}

interface UseRunSymbolReturn {
  running: string | null;
  lastRuns: Record<string, { ts: string; action: string }>;
  runSymbol: (symbol: string) => Promise<RunSymbolResult | null>;
}

const DEFAULT_ENDPOINT = '/api/run-symbol';

/**
 * Hook pour lancer l'exécution serveur d'un symbole (Netlify function run-symbol)
 * et centraliser l'état d'avancement + derniers résultats.
 */
export function useRunSymbol(options: UseRunSymbolOptions = {}): UseRunSymbolReturn {
  const { endpoint = DEFAULT_ENDPOINT, autoRefresh, enableToast = true } = options;
  const [running, setRunning] = useState<string | null>(null);
  const [lastRuns, setLastRuns] = useState<Record<string, { ts: string; action: string }>>({});
  const { toast } = useToast();

  const runSymbol = useCallback(async (symbol: string): Promise<RunSymbolResult | null> => {
    if (running) return null; // empêcher double déclenchement simultané (peut être ajusté)
    setRunning(symbol);
    try {
      const url = `${endpoint}?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, { method: 'POST' });
      let json: any = null;
      try { json = await res.json(); } catch {}
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const action = json?.result?.reason || json?.result?.message || 'OK';
      setLastRuns(prev => ({ ...prev, [symbol]: { ts: new Date().toLocaleTimeString(), action } }));
      if (autoRefresh) autoRefresh();
      if (enableToast) {
        toast({
          title: `Run ${symbol.split('/')[0]} terminé`,
          description: action,
        });
      }
      return json as RunSymbolResult;
    } catch (e: any) {
      console.warn('[useRunSymbol] error', e);
      setLastRuns(prev => ({ ...prev, [symbol]: { ts: new Date().toLocaleTimeString(), action: 'Erreur' } }));
      if (enableToast) {
        toast({
          title: `Run ${symbol.split('/')[0]} échec`,
          description: e.message || 'Erreur inconnue',
        });
      }
      return { ok: false, symbol, error: e.message };
    } finally {
      setRunning(null);
    }
  }, [endpoint, running, autoRefresh, enableToast, toast]);

  return { running, lastRuns, runSymbol };
}
