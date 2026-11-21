import type { ReactNode } from "react";

/** The white tooltip panel every chart uses: a heading, the exact figure, and a line of detail. */
export function ChartTooltip({ heading, value, detail }: { heading: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="tt" role="tooltip">
      <div className="tt-h">{heading}</div>
      <div className="tt-v num">{value}</div>
      {detail && <div className="tt-s">{detail}</div>}
    </div>
  );
}

export const AXIS = {
  tick: { fill: "rgba(7, 59, 76, 0.65)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
  stroke: "#CDD8DB",
};
export const GRID = "#E3EAEC";
