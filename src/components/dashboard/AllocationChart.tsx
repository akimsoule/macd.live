import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface AllocationData {
  symbol: string;
  allocation: number;
  notional: number;
  pnl: number;
}

interface AllocationChartProps {
  data: AllocationData[];
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(348, 83%, 47%)",
  "hsl(45, 93%, 47%)",
];

export function AllocationChart({ data }: AllocationChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-accent rounded-lg p-3 shadow-card">
          <p className="font-medium text-card-foreground">{data.symbol}</p>
          <p className="text-sm text-muted-foreground">
            Allocation: {(data.allocation * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-muted-foreground">
            Notional: ${data.notional}
          </p>
          <p className={`text-sm font-medium ${data.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            PnL: ${data.pnl.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={120}
          paddingAngle={2}
          dataKey="allocation"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          formatter={(value, entry: any) => (
            <span style={{ color: entry.color }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}