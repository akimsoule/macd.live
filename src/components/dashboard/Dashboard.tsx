import { useState, useEffect } from "react";
import { MetricCard } from "./MetricCard";
import { AllocationChart } from "./AllocationChart";
import { PerformanceChart } from "./PerformanceChart";
import { TradesTable } from "./TradesTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity, Target, AlertTriangle } from "lucide-react";

// Types pour les données
interface BacktestData {
  summary: {
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
  };
  allocation: Array<{
    symbol: string;
    allocation: number;
    notional: number;
    pnl: number;
    trades: number;
  }>;
  performance: Array<{
    timestamp: string;
    equity: number;
    drawdown: number;
  }>;
  trades: Array<{
    symbol: string;
    side: "LONG" | "SHORT";
    entryPrice: number;
    exitPrice: number;
    pnlPct: number;
    pnlUsd: number;
    reason: string;
    barsHeld: number;
  }>;
}

export function Dashboard() {
  const [data, setData] = useState<BacktestData | null>(null);
  const [loading, setLoading] = useState(true);

  // Données de démonstration basées sur le script fourni
  useEffect(() => {
    // Simulation de chargement des données depuis votre backend
    setTimeout(() => {
      const mockData: BacktestData = {
        summary: {
          initialCapital: 1000,
          finalEquity: 1156.78,
          totalPnl: 156.78,
          totalPnlPct: 15.68,
          totalTrades: 47,
          winningTrades: 28,
          losingTrades: 19,
          winRate: 59.57,
          maxDrawdown: -8.45,
          sharpeRatio: 1.24
        },
        allocation: [
          { symbol: "IP/USDT", allocation: 0.5, notional: 1250, pnl: 89.34, trades: 18 },
          { symbol: "PEOPLE/USDT", allocation: 0.3, notional: 750, pnl: 45.67, trades: 15 },
          { symbol: "AVNT/USDT", allocation: 0.1, notional: 250, pnl: 12.89, trades: 8 },
          { symbol: "0G/USDT", allocation: 0.1, notional: 250, pnl: 8.88, trades: 6 }
        ],
        performance: [
          { timestamp: "2024-01-01", equity: 1000, drawdown: 0 },
          { timestamp: "2024-01-15", equity: 1045.23, drawdown: -2.1 },
          { timestamp: "2024-02-01", equity: 1089.67, drawdown: -4.5 },
          { timestamp: "2024-02-15", equity: 1134.45, drawdown: -1.8 },
          { timestamp: "2024-03-01", equity: 1156.78, drawdown: -0.5 }
        ],
        trades: [
          {
            symbol: "IP/USDT:USDT",
            side: "LONG",
            entryPrice: 12.456,
            exitPrice: 13.234,
            pnlPct: 15.67,
            pnlUsd: 39.18,
            reason: "SIGNAL_FLIP",
            barsHeld: 72
          },
          {
            symbol: "PEOPLE/USDT:USDT",
            side: "SHORT",
            entryPrice: 0.0892,
            exitPrice: 0.0856,
            pnlPct: 10.12,
            pnlUsd: 25.30,
            reason: "SIGNAL_FLIP",
            barsHeld: 48
          },
          {
            symbol: "AVNT/USDT:USDT",
            side: "LONG",
            entryPrice: 1.234,
            exitPrice: 1.178,
            pnlPct: -11.34,
            pnlUsd: -28.35,
            reason: "STOP_LOSS",
            barsHeld: 24
          }
        ]
      };
      setData(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Erreur lors du chargement des données</p>
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
            <p className="text-muted-foreground">Backtest Multi-Symbole - Gestion Cross Margin</p>
          </div>
          <div className="flex items-center space-x-2 bg-gradient-primary rounded-lg px-4 py-2 shadow-glow">
            <Target className="w-5 h-5 text-primary-foreground" />
            <span className="text-primary-foreground font-medium">Levier 5x</span>
          </div>
        </div>

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