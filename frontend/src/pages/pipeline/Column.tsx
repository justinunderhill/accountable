import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { memo, useMemo } from "react";
import { Link } from "react-router";
import type { Deal, Stage } from "../../api/types";
import { StageDot } from "../../components/ui/Badge";
import { formatMoney } from "../../lib/format";
import { isClosedStage, stageName } from "../../lib/stages";
import { columnTotals } from "./boardState";
import { DealCard } from "./DealCard";

export const columnId = (stage: Stage) => `column:${stage}`;

/** Won and Lost show this many of their most recent cards (spec, Concerns 9). */
export const CLOSED_CARDS_SHOWN = 100;

/**
 * The cards a column shows. Open columns show every card. Won and Lost, which
 * grow with every closed deal, show their 100 most recent by close date, kept
 * in board order. The column's totals still count every card.
 */
export function visibleCards(stage: Stage, deals: Deal[]): Deal[] {
  if (!isClosedStage(stage) || deals.length <= CLOSED_CARDS_SHOWN) return deals;
  const recent = new Set(
    [...deals]
      .sort((a, b) => (a.close_date === b.close_date ? a.position - b.position : a.close_date < b.close_date ? 1 : -1))
      .slice(0, CLOSED_CARDS_SHOWN)
      .map((d) => d.id),
  );
  return deals.filter((d) => recent.has(d.id));
}

interface ColumnProps {
  stage: Stage;
  deals: Deal[];
  onAdd: (stage: Stage) => void;
  onOpen: (deal: Deal) => void;
}

export const Column = memo(function Column({ stage, deals, onAdd, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(stage) });
  const totals = columnTotals(deals);
  const shown = useMemo(() => visibleCards(stage, deals), [stage, deals]);
  const ids = useMemo(() => shown.map((d) => d.id), [shown]);
  const hidden = deals.length - shown.length;
  const name = stageName(stage);

  return (
    <section className={`col col-${stage}${isOver ? " over" : ""}`} aria-label={`${name} column`} data-stage={stage}>
      <header className="col-head">
        <div className="col-title">
          <StageDot stage={stage} />
          <h2 className="col-name">{name}</h2>
          <span className="col-count num" aria-label={`${totals.count} deals`}>
            {totals.count}
          </span>
          <button type="button" className="col-add" aria-label={`Add a deal in ${name}`} onClick={() => onAdd(stage)}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="col-figs">
          <span className="num col-total" data-testid="column-total">
            {formatMoney(totals.total_cents)}
          </span>
          <span className="col-exp">
            Expected <span className="num" data-testid="column-expected">{formatMoney(totals.expected_cents)}</span>
          </span>
        </div>
      </header>
      <SortableContext id={columnId(stage)} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="col-list">
          {shown.map((deal) => (
            <DealCard key={deal.id} deal={deal} onOpen={onOpen} />
          ))}
          {deals.length === 0 && <p className="col-empty">Drop a deal here</p>}
          {hidden > 0 && (
            <Link className="col-more" to={`/deals?stage=${stage}`}>
              Showing the {CLOSED_CARDS_SHOWN} most recent. All {deals.length.toLocaleString("en-US")}{" "}
              {name.toLowerCase()} deals are in the table
            </Link>
          )}
        </div>
      </SortableContext>
    </section>
  );
});
