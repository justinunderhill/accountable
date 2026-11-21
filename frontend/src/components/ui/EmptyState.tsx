import type { ReactNode } from "react";

export function EmptyState({ line, action }: { line: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-line">{line}</p>
      {action}
    </div>
  );
}
