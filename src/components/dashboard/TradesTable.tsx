import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Trade {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  reason: string;
  barsHeld: number;
}

interface TradesTableProps {
  trades: Trade[];
}

export function TradesTable({ trades }: TradesTableProps) {
  const getSideBadgeVariant = (side: "LONG" | "SHORT") => {
    return side === "LONG" ? "default" : "secondary";
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? "text-profit" : "text-loss";
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "STOP_LOSS":
        return "destructive";
      case "SIGNAL_FLIP":
        return "default";
      case "FORCE_CLOSE_END":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-accent">
      <CardHeader>
        <CardTitle className="text-card-foreground">Historique des Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow className="border-accent">
                <TableHead className="text-muted-foreground">Symbole</TableHead>
                <TableHead className="text-muted-foreground">Côté</TableHead>
                <TableHead className="text-muted-foreground">Prix Entrée</TableHead>
                <TableHead className="text-muted-foreground">Prix Sortie</TableHead>
                <TableHead className="text-muted-foreground">PnL %</TableHead>
                <TableHead className="text-muted-foreground">PnL USD</TableHead>
                <TableHead className="text-muted-foreground">Raison</TableHead>
                <TableHead className="text-muted-foreground">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade, index) => (
                <TableRow key={index} className="border-accent hover:bg-accent/50">
                  <TableCell className="font-medium text-card-foreground">
                    {trade.symbol.replace("/USDT:USDT", "")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSideBadgeVariant(trade.side)}>
                      {trade.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    ${trade.entryPrice.toFixed(6)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    ${trade.exitPrice.toFixed(6)}
                  </TableCell>
                  <TableCell className={getPnlColor(trade.pnlPct)}>
                    {trade.pnlPct > 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%
                  </TableCell>
                  <TableCell className={getPnlColor(trade.pnlUsd)}>
                    {trade.pnlUsd > 0 ? "+" : ""}${trade.pnlUsd.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getReasonBadge(trade.reason) as any}>
                      {trade.reason.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.barsHeld}h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}