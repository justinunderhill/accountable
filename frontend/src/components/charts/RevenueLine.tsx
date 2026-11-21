import { Area, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "../../api/types";
import { formatCount, formatMoney, formatMoneyShort, formatMonth } from "../../lib/format";
import { AXIS, ChartTooltip, GRID } from "./ChartTooltip";

const SEA_GREEN = "#06D6A0";

/** Revenue won each month: a Sea Green line with dots and a light fill, labelled at the latest month. */
export function RevenueLine({ months }: { months: Dashboard["months"] }) {
  const data = months.map((m, i) => ({
    ...m,
    label: formatMonth(m.month),
    full: formatMonth(m.month, true),
    last: i === months.length - 1 ? formatMoneyShort(m.revenue_cents) : "",
  }));
  return (
    <div className="chart" data-testid="revenue-chart" role="img" aria-label="Revenue won by month, last 12 months">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 14, right: 56, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} interval={0} />
          <YAxis
            tick={AXIS.tick}
            tickFormatter={(v: number) => formatMoneyShort(v)}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: "rgba(7, 59, 76, 0.45)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const row = active && payload?.[0]?.payload;
              if (!row) return null;
              return (
                <ChartTooltip
                  heading={row.full}
                  value={formatMoney(row.revenue_cents)}
                  detail={`${formatCount(row.deals, "deal")} won`}
                />
              );
            }}
          />
          <Area type="linear" dataKey="revenue_cents" stroke="none" fill={SEA_GREEN} fillOpacity={0.1} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="revenue_cents"
            stroke={SEA_GREEN}
            strokeWidth={2.5}
            dot={{ r: 4, fill: SEA_GREEN, stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: SEA_GREEN, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          >
            <LabelList dataKey="last" position="right" offset={10} className="chart-label" fill="#073B4C" />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
