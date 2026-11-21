import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/client";
import { moveDeal, usePipeline, useToday } from "../api/queries";
import type { Deal, Stage } from "../api/types";
import { DealForm } from "../components/forms/DealForm";
import { PageState } from "../components/ui/PageState";
import { useToast } from "../components/ui/Toast";
import { formatMoney } from "../lib/format";
import { STAGE_KEYS, stageName } from "../lib/stages";
import { stageMessage } from "./DealPage";
import { Board, boardTotals, locate, moveCard, toColumns, type Columns } from "./pipeline/boardState";
import { Column, visibleCards } from "./pipeline/Column";
import { DragActive, DragPreview } from "./pipeline/DealCard";

export function Pipeline() {
  const pipeline = usePipeline();
  const today = useToday();
  const [adding, setAdding] = useState<Stage | null>(null);

  return (
    <main className="main main-board">
      <PageState query={pipeline}>
        {(data) =>
          today ? (
            <BoardView initial={toColumns(data)} serverColumns={data} today={today} onAdd={setAdding} />
          ) : null
        }
      </PageState>
      <DealForm
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        defaults={{ stage: adding ?? "new" }}
      />
    </main>
  );
}

interface BoardViewProps {
  initial: Columns;
  serverColumns: unknown;
  today: string;
  onAdd: (stage: Stage) => void;
}

function BoardView({ initial, serverColumns, today, onAdd }: BoardViewProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [shown, setShown] = useState<Columns>(initial);
  // While dragging, the board follows the pointer; the server hears about it on drop.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragActive = useRef(false);
  const lastDrop = useRef(0);

  const boardRef = useRef<Board | null>(null);
  if (boardRef.current === null) {
    boardRef.current = new Board(
      initial,
      today,
      (move) => moveDeal(move.id, move.stage, move.index),
      setShown,
      (error) =>
        toast.error(
          error instanceof ApiError
            ? `That move didn't save: ${error.message}`
            : "That move didn't save, so the card went back. Please try again.",
        ),
      () => queryClient.invalidateQueries(),
    );
  }
  const board = boardRef.current;

  // Take the server's latest state whenever it arrives, unless a drag or a move is under way.
  useEffect(() => {
    if (!dragColumns) board.reset(initial, today);
    // `serverColumns` changes identity only when fresh data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverColumns, today]);

  const columns = dragColumns ?? shown;
  const totals = boardTotals(columns);
  const activeDeal = activeId !== null ? findDeal(columns, activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space picks a card up and puts it down; Enter opens the deal.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const containerOf = useCallback(
    (cols: Columns, id: string | number): Stage | null => {
      if (typeof id === "string" && id.startsWith("column:")) return id.slice(7) as Stage;
      return locate(cols, Number(id))?.stage ?? null;
    },
    [],
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    dragActive.current = true;
    setActiveId(Number(active.id));
    setDragColumns(board.shown);
  };

  // Moving over another column carries the card into it, so the placeholder shows where it will land.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setDragColumns((cols) => {
      if (!cols) return cols;
      const from = containerOf(cols, active.id);
      const to = containerOf(cols, over.id);
      if (!from || !to || from === to) return cols;
      const overIndex = cols[to].findIndex((d) => d.id === Number(over.id));
      // Over the column itself: just after the last card it shows.
      const shown = visibleCards(to, cols[to]);
      let index = overIndex >= 0 ? overIndex : shown.length ? cols[to].indexOf(shown[shown.length - 1]) + 1 : 0;
      const activeRect = active.rect.current.translated;
      if (overIndex >= 0 && activeRect && activeRect.top > over.rect.top + over.rect.height / 2) index += 1;
      return moveCard(cols, { id: Number(active.id), stage: to, index }, today);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDrop.current = Date.now();
    dragActive.current = false;
    const id = Number(active.id);
    let finalCols = dragColumns;
    setActiveId(null);
    setDragColumns(null);
    if (!over || !finalCols) return;

    // Within a column, the sortable list says where it landed.
    const stage = containerOf(finalCols, active.id);
    if (!stage) return;
    const oldIndex = finalCols[stage].findIndex((d) => d.id === id);
    const overIndex = finalCols[stage].findIndex((d) => d.id === Number(over.id));
    if (overIndex >= 0 && overIndex !== oldIndex) {
      finalCols = { ...finalCols, [stage]: arrayMove(finalCols[stage], oldIndex, overIndex) };
    }

    const before = locate(board.shown, id);
    const after = locate(finalCols, id)!;
    if (before && before.stage === after.stage && before.index === after.index) return;
    board.move({ id, stage: after.stage, index: after.index });

    if (before && before.stage !== after.stage) {
      const deal = findDeal(board.shown, id)!;
      toast.success(stageMessage(deal.name, deal.stage, deal.close_date));
    }
  };

  const onOpen = useCallback(
    (deal: Deal) => {
      // A click that ends a drag isn't a request to open the deal.
      if (Date.now() - lastDrop.current < 250) return;
      navigate(`/deals/${deal.id}`);
    },
    [navigate],
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${dealName(board.shown, active.id)}.`,
      onDragOver: ({ active, over }) =>
        over ? `${dealName(board.shown, active.id)} is over ${describeTarget(dragColumnsRef.current ?? board.shown, over.id)}.` : "",
      onDragEnd: ({ active, over }) =>
        over ? `Dropped ${dealName(board.shown, active.id)}.` : `${dealName(board.shown, active.id)} was put back.`,
      onDragCancel: ({ active }) => `Moving ${dealName(board.shown, active.id)} was cancelled.`,
    }),
    [board],
  );
  const dragColumnsRef = useRef<Columns | null>(null);
  dragColumnsRef.current = dragColumns;

  return (
    <>
      <div className="page-top board-top">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="greet" id="board-help">
            Drag a card to change its stage, or to move it up or down its column.
          </p>
        </div>
        <section className="panel board-totals" aria-label="Open pipeline totals">
          <div className="bt">
            <span className="bt-l">Open pipeline</span>
            <span className="bt-v num" data-testid="board-open">
              {formatMoney(totals.open_cents)}
            </span>
          </div>
          <div className="bt">
            <span className="bt-l">Expected revenue</span>
            <span className="bt-v num" data-testid="board-expected">
              {formatMoney(totals.expected_cents)}
            </span>
          </div>
          <div className="bt">
            <span className="bt-l">Open deals</span>
            <span className="bt-v num" data-testid="board-count">
              {totals.open_count}
            </span>
          </div>
          <span className="bt-note">Won and Lost aren't counted</span>
        </section>
        <button type="button" className="btn btn-primary" onClick={() => onAdd("new")}>
          <Plus size={16} aria-hidden="true" />
          New deal
        </button>
      </div>
      <p className="sr-only" id="board-keys">
        Press Space to pick up a card, the arrow keys to move it, Space to drop it and Escape to cancel. Press Enter
        to open the deal.
      </p>
      <DragActive.Provider value={dragActive}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          dragActive.current = false;
          setActiveId(null);
          setDragColumns(null);
        }}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "" } }}
      >
        <div className="board">
          {STAGE_KEYS.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              deals={columns[stage]}
              onAdd={onAdd}
              onOpen={onOpen}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{activeDeal ? <DragPreview deal={activeDeal} /> : null}</DragOverlay>
      </DndContext>
      </DragActive.Provider>
    </>
  );
}

function findDeal(columns: Columns, id: number): Deal | null {
  const at = locate(columns, id);
  return at ? columns[at.stage][at.index] : null;
}

function dealName(columns: Columns, id: string | number): string {
  return findDeal(columns, Number(id))?.name ?? "the deal";
}

function describeTarget(columns: Columns, id: string | number): string {
  if (typeof id === "string" && id.startsWith("column:")) return `the ${stageName(id.slice(7) as Stage)} column`;
  const at = locate(columns, Number(id));
  return at ? `position ${at.index + 1} in ${stageName(at.stage)}` : "the board";
}

