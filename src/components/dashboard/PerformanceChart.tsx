import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PerformanceData {
  timestamp: string;
  equity: number;
  drawdown: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-accent rounded-lg p-3 shadow-card">
        <p className="font-medium text-card-foreground">{label}</p>
        <p className="text-sm text-profit">
          Equity: ${payload[0].value.toFixed(2)}
        </p>
        {payload[1] && (
          <p className="text-sm text-loss">
            Drawdown: {payload[1].value.toFixed(2)}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function PerformanceChart({ data }: Readonly<PerformanceChartProps>) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="timestamp" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="equity"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="drawdown"
          stroke="hsl(var(--loss))"
          strokeWidth={1}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}