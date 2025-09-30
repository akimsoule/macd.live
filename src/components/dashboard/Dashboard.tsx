import { useMemo } from "react";
import { MetricCard } from "./MetricCard";
import { AllocationChart } from "./AllocationChart";
import { PerformanceChart } from "./PerformanceChart";
import { TradesTable } from "./TradesTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity, Target, AlertTriangle } from "lucide-react";
import { useTradingData } from "@/hooks/useTradingData";
import { useRunSymbol } from "@/hooks/useRunSymbol";

export function Dashboard() {
  const { data, loading, error, refresh, isStale } = useTradingData();

  const lastUpdateLabel = useMemo(() => {
    if (!data?.summary.lastUpdate) return '—';
    try {
      return new Date(data.summary.lastUpdate).toLocaleString('fr-FR');
    } catch {
      return data.summary.lastUpdate;
    }
  }, [data?.summary.lastUpdate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des données en temps réel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-2">Erreur lors du chargement des données</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <button 
            onClick={() => refresh()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trading Dashboard</h1>
            <p className="text-muted-foreground">Système de Trading Automatisé - Données en Temps Réel</p>
            <p className="text-xs text-muted-foreground mt-1">
              Dernière mise à jour: {lastUpdateLabel} {isStale && <span className="text-amber-500">(stale)</span>}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={refresh}
              className="text-sm px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'MAJ...' : 'Rafraîchir'}
            </button>
            {/* Indicateur de santé du compte */}
            {data.accountHealth && (
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                data.accountHealth.isHealthy 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  data.accountHealth.isHealthy ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium">
                  {data.accountHealth.isHealthy ? 'Compte Sain' : 'Attention'}
                </span>
              </div>
            )}
            
            <div className="flex items-center space-x-2 bg-gradient-primary rounded-lg px-4 py-2 shadow-glow">
              <Target className="w-5 h-5 text-primary-foreground" />
              <span className="text-primary-foreground font-medium">Levier 5x</span>
            </div>
          </div>
        </div>

  {/* Contrôles manuels exécution symbole */}
  <ManualRunSymbols refreshSnapshot={refresh} />

        {/* Alertes de santé du compte */}
        {data.accountHealth && data.accountHealth.warnings.length > 0 && (
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Alertes de Compte</h3>
                  <ul className="mt-2 space-y-1">
                    {data.accountHealth.warnings.map((warning) => (
                      <li key={warning} className="text-sm text-yellow-700 dark:text-yellow-300">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métriques principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Capital Final"
            value={`$${data.summary.finalEquity.toFixed(2)}`}
            subtitle={`Initial: $${data.summary.initialCapital}`}
            trend="up"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <MetricCard
            title="PnL Total"
            value={`${data.summary.totalPnl > 0 ? '+' : ''}$${data.summary.totalPnl.toFixed(2)}`}
            subtitle={`${data.summary.totalPnlPct.toFixed(2)}%`}
            trend={data.summary.totalPnl >= 0 ? "up" : "down"}
            icon={data.summary.totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          />
          <MetricCard
            title="Taux de Réussite"
            value={`${data.summary.winRate.toFixed(1)}%`}
            subtitle={`${data.summary.winningTrades}W / ${data.summary.losingTrades}L`}
            trend={data.summary.winRate >= 50 ? "up" : "down"}
            icon={<Activity className="w-4 h-4" />}
          />
          <MetricCard
            title="Drawdown Max"
            value={`${data.summary.maxDrawdown.toFixed(2)}%`}
            subtitle="Perte maximale"
            trend="down"
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-card shadow-card border-accent">
            <CardHeader>
              <CardTitle className="text-card-foreground">Allocation des Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart data={data.allocation} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-accent">
            <CardHeader>
              <CardTitle className="text-card-foreground">Performance Temporelle</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart data={data.performance} />
            </CardContent>
          </Card>
        </div>

        {/* Tableau des trades */}
        <TradesTable trades={data.trades} />
      </div>
    </div>
  );
}

// Composant interne: boutons d'exécution manuelle des symboles
function ManualRunSymbols({ refreshSnapshot }: Readonly<{ refreshSnapshot: () => Promise<void> }>) {
  const symbols = ['PEOPLE/USDT:USDT','AVAX/USDT:USDT','AVNT/USDT:USDT','0G/USDT:USDT'];
  const { running, lastRuns, runSymbol } = useRunSymbol({ autoRefresh: () => { void refreshSnapshot(); }, endpoint: '/api/run-symbol', enableToast: true });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Exécution Manuelle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {symbols.map(sym => {
            const short = sym.split('/')[0];
            const info = lastRuns[sym];
            return (
              <button
                key={sym}
                onClick={() => runSymbol(sym)}
                disabled={!!running}
                className={`text-xs px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors flex flex-col items-center ${running===sym ? 'opacity-70' : ''}`}
              >
                <span>{short}</span>
                {running === sym ? <span className="animate-pulse text-[10px]">run...</span> : <span className="text-[10px] text-muted-foreground">{info ? info.action : 'idle'}</span>}
                {info && <span className="text-[9px] text-muted-foreground">{info.ts}</span>}
              </button>
            );
          })}
        </div>
        {running && <p className="text-xs text-muted-foreground">Exécution en cours: {running}</p>}
      </CardContent>
    </Card>
  );
}