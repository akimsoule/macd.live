import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ title, value, subtitle, trend, icon, className }: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-profit";
      case "down":
        return "text-loss";
      default:
        return "text-neutral";
    }
  };

  const getTrendBg = () => {
    switch (trend) {
      case "up":
        return "bg-gradient-success";
      case "down":
        return "bg-gradient-danger";
      default:
        return "bg-gradient-primary";
    }
  };

  return (
    <Card className={cn("relative overflow-hidden bg-gradient-card shadow-card border-accent", className)}>
      <div className={cn("absolute inset-0 opacity-5", getTrendBg())} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="relative z-10">
        <div className={cn("text-2xl font-bold", getTrendColor())}>{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}