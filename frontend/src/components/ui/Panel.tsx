import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}

/** A white, rounded panel with an optional title row. */
export function Panel({ title, sub, action, flush, className, children }: PanelProps) {
  return (
    <section className={`panel${flush ? " panel-flush" : ""}${className ? ` ${className}` : ""}`}>
      {(title || action) && (
        <div className={`panel-head${flush ? " panel-head-flush" : ""}`}>
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {sub && <p className="panel-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
