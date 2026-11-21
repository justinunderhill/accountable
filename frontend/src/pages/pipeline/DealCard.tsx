import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createContext, memo, useContext, type CSSProperties, type KeyboardEvent } from "react";
import type { Deal } from "../../api/types";
import { LateBadge } from "../../components/ui/Badge";
import { formatMoney, formatShortDate, initials } from "../../lib/format";

interface CardBodyProps {
  deal: Deal;
}

/** What a card shows. Shared by the card on the board and the copy that follows the pointer. */
export const CardBody = memo(function CardBody({ deal }: CardBodyProps) {
  return (
    <>
      <div className="card-name">{deal.name}</div>
      <div className="card-org">{deal.organization_name ?? "No organization"}</div>
      <div className="card-row">
        <span className="card-value num">{formatMoney(deal.value_cents)}</span>
        <span className="card-right">
          {deal.late && <LateBadge />}
          <span className="card-prob num" title={deal.probability_by_hand ? "Probability set by hand" : undefined}>
            {deal.probability}%{deal.probability_by_hand ? "*" : ""}
          </span>
        </span>
      </div>
      <div className="card-foot">
        <span className="card-contact">
          <span className="av" aria-hidden="true">
            {initials(deal.contact_name)}
          </span>
          {deal.contact_name}
        </span>
        <span className="card-date num">{formatShortDate(deal.close_date)}</span>
      </div>
    </>
  );
});

function cardClass(deal: Deal, extra = ""): string {
  return ["card", deal.late && "late", deal.stage === "won" && "card-won", deal.stage === "lost" && "card-lost", extra]
    .filter(Boolean)
    .join(" ");
}

/**
 * Whether a drag is under way, as a ref: cards read it when a key is pressed,
 * so starting a drag doesn't re-render every card on the board.
 */
export const DragActive = createContext<{ current: boolean }>({ current: false });

interface DealCardProps {
  deal: Deal;
  onOpen: (deal: Deal) => void;
}

/** A card on the board: drag it to move it, click it or press Enter to open the deal. */
export const DealCard = memo(function DealCard({ deal, onOpen }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const dragActive = useContext(DragActive);
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !dragActive.current) {
      event.preventDefault();
      onOpen(deal);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClass(deal, isDragging ? "ph" : "")}
      data-deal-id={deal.id}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      aria-roledescription="deal card"
      aria-label={`${deal.name}, ${formatMoney(deal.value_cents)}${deal.late ? ", late" : ""}`}
      aria-describedby="board-keys"
      onClick={() => onOpen(deal)}
    >
      <CardBody deal={deal} />
    </div>
  );
});

/** The copy of a card that follows the pointer while dragging. */
export function DragPreview({ deal }: { deal: Deal }) {
  return (
    <div className={cardClass(deal, "card-overlay")}>
      <CardBody deal={deal} />
    </div>
  );
}
