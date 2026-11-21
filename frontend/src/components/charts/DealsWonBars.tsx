import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "../../api/types";
import { formatCount, formatMonth } from "../../lib/format";
import { AXIS, ChartTooltip, GRID } from "./ChartTooltip";

const MARIGOLD = "#FFC145";

/** Deals won each month, as Marigold bars. */
export function DealsWonBars({ months }: { months: Dashboard["months"] }) {
  const data = months.map((m) => ({ ...m, label: formatMonth(m.month), full: formatMonth(m.month, true) }));
  return (
    <div className="chart" data-testid="deals-chart" role="img" aria-label="Deals won by month, last 12 months">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} interval={0} />
          <YAxis tick={AXIS.tick} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip
            cursor={{ fill: "rgba(7, 59, 76, 0.05)" }}
            content={({ active, payload }) => {
              const row = active && payload?.[0]?.payload;
              if (!row) return null;
              return <ChartTooltip heading={row.full} value={`${formatCount(row.deals, "deal")} won`} />;
            }}
          />
          <Bar dataKey="deals" fill={MARIGOLD} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
