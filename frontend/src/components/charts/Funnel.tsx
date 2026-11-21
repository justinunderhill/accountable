import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "../../api/types";
import { formatCount, formatMoney, formatMoneyShort } from "../../lib/format";
import { stageInfo } from "../../lib/stages";
import { ChartTooltip } from "./ChartTooltip";

/** The stage name, with its number of deals underneath. */
function StageTick({ x, y, payload, counts }: { x?: number; y?: number; payload?: { value: string }; counts: Map<string, number> }) {
  const name = payload?.value ?? "";
  return (
    <text x={x} y={y} textAnchor="end" fill="#073B4C" fontFamily="Instrument Sans, sans-serif">
      <tspan x={x} dy={-2} fontSize={13} fontWeight={600}>
        {name}
      </tspan>
      <tspan x={x} dy={14} fontSize={11} fill="rgba(7, 59, 76, 0.65)">
        {formatCount(counts.get(name) ?? 0, "deal")}
      </tspan>
    </text>
  );
}

/**
 * How much value reached each stage, from New down to Won. Every bar carries its
 * stage name, its number of deals, its value and its share of New, so color is
 * never the only cue.
 */
export function Funnel({ rows }: { rows: Dashboard["funnel"] }) {
  const data = rows.map((r) => ({
    ...r,
    name: stageInfo(r.stage).name,
    color: stageInfo(r.stage).color,
    label: `${formatMoneyShort(r.value_cents)}  ${r.percent_of_new}%`,
  }));
  const counts = new Map(data.map((r) => [r.name, r.count]));
  return (
    <div className="chart" data-testid="funnel-chart" role="img" aria-label="Sales funnel: value that reached each stage">
      <ResponsiveContainer width="100%" height={rows.length * 44 + 8}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 104, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={96}
            tick={<StageTick counts={counts} />}
          />
          <Tooltip
            cursor={{ fill: "rgba(7, 59, 76, 0.04)" }}
            content={({ active, payload }) => {
              const row = active && payload?.[0]?.payload;
              if (!row) return null;
              return (
                <ChartTooltip
                  heading={`Reached ${row.name}`}
                  value={formatMoney(row.value_cents)}
                  detail={`${formatCount(row.count, "deal")} · ${row.percent_of_new}% of New`}
                />
              );
            }}
          />
          <Bar dataKey="value_cents" radius={[0, 4, 4, 0]} minPointSize={4} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.stage} fill={row.color} />
            ))}
            <LabelList dataKey="label" position="right" offset={10} className="chart-label" fill="#073B4C" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
