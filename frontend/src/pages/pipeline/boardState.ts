import type { Deal, Pipeline, Stage } from "../../api/types";
import { isLate } from "../../lib/dates";
import { STAGE_KEYS, defaultProbability, isClosedStage, isOpenStage } from "../../lib/stages";

/** The board's cards, by stage, in card order. */
export type Columns = Record<Stage, Deal[]>;

export interface Totals {
  count: number;
  total_cents: number;
  expected_cents: number;
}

export interface BoardTotals {
  open_cents: number;
  expected_cents: number;
  open_count: number;
}

export interface Move {
  id: number;
  stage: Stage;
  index: number;
}

export function toColumns(pipeline: Pipeline): Columns {
  const columns = emptyColumns();
  for (const column of pipeline.columns) columns[column.stage] = column.deals;
  return columns;
}

function emptyColumns(): Columns {
  return Object.fromEntries(STAGE_KEYS.map((s) => [s, []])) as unknown as Columns;
}

export function columnTotals(cards: Deal[]): Totals {
  return {
    count: cards.length,
    total_cents: cards.reduce((sum, d) => sum + d.value_cents, 0),
    expected_cents: cards.reduce((sum, d) => sum + d.expected_cents, 0),
  };
}

/** The open pipeline across the board. Won and Lost aren't counted. */
export function boardTotals(columns: Columns): BoardTotals {
  const open = STAGE_KEYS.filter(isOpenStage).flatMap((s) => columns[s]);
  const totals = columnTotals(open);
  return { open_cents: totals.total_cents, expected_cents: totals.expected_cents, open_count: totals.count };
}

export function locate(columns: Columns, id: number): { stage: Stage; index: number } | null {
  for (const stage of STAGE_KEYS) {
    const index = columns[stage].findIndex((d) => d.id === id);
    if (index >= 0) return { stage, index };
  }
  return null;
}

/**
 * Move a card the way the server will, so the board can show it straight away:
 * a new stage brings its usual probability, and Won or Lost bring today's date.
 * `index` is the card's place in the target column once it has been taken out.
 */
export function moveCard(columns: Columns, move: Move, today: string): Columns {
  const from = locate(columns, move.id);
  if (!from) return columns;
  let card = columns[from.stage][from.index];
  if (move.stage !== from.stage) {
    const probability = defaultProbability(move.stage);
    const close_date = isClosedStage(move.stage) ? today : card.close_date;
    card = {
      ...card,
      stage: move.stage,
      probability,
      probability_by_hand: false,
      close_date,
      expected_cents: Math.floor((card.value_cents * probability) / 100),
      late: isLate(move.stage, close_date, today),
    };
  }
  const next = { ...columns, [from.stage]: columns[from.stage].filter((d) => d.id !== move.id) };
  const target = [...next[move.stage]];
  target.splice(Math.max(0, Math.min(move.index, target.length)), 0, card);
  next[move.stage] = target;
  return next;
}

/**
 * The board as shown, kept ahead of the server.
 *
 * Each move shows at once and is sent to the server in turn, one at a time,
 * so two quick drags can't arrive out of order. After each move settles,
 * `onSettled` runs, so the rest of the app can refetch. If a move fails, the
 * queue is dropped and the board goes back to the last state the server confirmed.
 */
export class Board {
  shown: Columns;
  private confirmed: Columns;
  private queue: Move[] = [];
  private running: Promise<void> | null = null;

  constructor(
    columns: Columns,
    private today: string,
    private send: (move: Move) => Promise<unknown>,
    private onChange: (columns: Columns) => void = () => {},
    private onError: (error: unknown, move: Move) => void = () => {},
    private onSettled: () => void = () => {},
  ) {
    this.shown = columns;
    this.confirmed = columns;
  }

  get busy(): boolean {
    return this.running !== null;
  }

  /** Take the server's state, unless moves are still on their way. */
  reset(columns: Columns, today = this.today): void {
    this.today = today;
    if (this.busy) return;
    this.confirmed = columns;
    this.setShown(columns);
  }

  move(move: Move): void {
    this.setShown(moveCard(this.shown, move, this.today));
    this.queue.push(move);
    if (!this.running) this.running = this.drain();
  }

  /** Resolves once every queued move has settled. */
  async settled(): Promise<void> {
    while (this.running) await this.running;
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const move = this.queue.shift()!;
      try {
        await this.send(move);
        this.confirmed = moveCard(this.confirmed, move, this.today);
      } catch (error) {
        this.queue = [];
        this.setShown(this.confirmed);
        this.onError(error, move);
      }
      if (this.queue.length === 0) {
        // The last move clears `running` first, so the refetch it starts can reset
        // the board, and this loop ends before any new move starts another.
        this.running = null;
        this.onSettled();
        return;
      }
      this.onSettled();
    }
    this.running = null;
  }

  private setShown(columns: Columns): void {
    this.shown = columns;
    this.onChange(columns);
  }
}
