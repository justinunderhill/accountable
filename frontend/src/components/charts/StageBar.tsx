import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dashboard } from "../../api/types";
import { formatCount, formatMoney } from "../../lib/format";
import { stageInfo } from "../../lib/stages";
import { ChartTooltip } from "./ChartTooltip";

interface StageBarProps {
  rows: Dashboard["open_by_stage"];
  /** The thin bar in the figures panel: no legend. */
  compact?: boolean;
}

/**
 * The open pipeline as one bar split by stage, with a 2px white gap between
 * segments. The full version has a legend naming each stage with its value.
 */
export function StageBar({ rows, compact }: StageBarProps) {
  const total = rows.reduce((sum, r) => sum + r.value_cents, 0);
  const datum = Object.fromEntries(rows.map((r) => [r.stage, r.value_cents]));
  const height = compact ? 8 : 20;
  return (
    <div className={compact ? "stagebar stagebar-compact" : "stagebar"}>
      <div
        className="stagebar-bar"
        data-testid={compact ? undefined : "stage-bar"}
        role="img"
        aria-label={`Open pipeline by stage: ${rows.map((r) => `${stageInfo(r.stage).name} ${formatMoney(r.value_cents)}`).join(", ")}`}
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={[datum]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
            <XAxis type="number" hide domain={[0, Math.max(total, 1)]} />
            <YAxis type="category" hide />
            {!compact && (
              <Tooltip
                shared={false}
                cursor={false}
                content={({ active, payload }) => {
                  const entry = active && payload?.[0];
                  if (!entry) return null;
                  const row = rows.find((r) => r.stage === entry.dataKey);
                  if (!row) return null;
                  const share = total ? Math.round((row.value_cents * 100) / total) : 0;
                  return (
                    <ChartTooltip
                      heading={stageInfo(row.stage).name}
                      value={formatMoney(row.value_cents)}
                      detail={`${formatCount(row.count, "deal")} · ${share}% of open value`}
                    />
                  );
                }}
              />
            )}
            {rows.map((r) => (
              <Bar
                key={r.stage}
                dataKey={r.stage}
                stackId="open"
                fill={stageInfo(r.stage).color}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!compact && (
        <ul className="sb-legend">
          {rows.map((r) => (
            <li key={r.stage}>
              <span
                className={`sw${r.stage === "lost" ? " dot-lost" : ""}`}
                style={{ background: stageInfo(r.stage).color }}
                aria-hidden="true"
              />
              <span className="sb-name">{stageInfo(r.stage).name}</span>
              <span className="sb-val num">{formatMoney(r.value_cents)}</span>
              <span className="sb-count">{formatCount(r.count, "deal")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
