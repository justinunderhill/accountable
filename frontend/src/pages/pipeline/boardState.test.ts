import { describe, expect, it, vi } from "vitest";
import type { Deal, Stage } from "../../api/types";
import { Board, boardTotals, columnTotals, moveCard, type Columns } from "./boardState";
import { visibleCards } from "./Column";

const TODAY = "2026-11-21";
const DEFAULT: Record<Stage, number> = { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 };

function deal(id: number, stage: Stage, dollars: number, extra: Partial<Deal> = {}): Deal {
  const probability = extra.probability ?? DEFAULT[stage];
  return {
    id,
    name: `Deal ${id}`,
    organization_id: null,
    organization_name: null,
    contact_id: 1,
    contact_name: "Maria Lopez",
    stage,
    value_cents: dollars * 100,
    probability,
    probability_by_hand: probability !== DEFAULT[stage],
    expected_cents: (dollars * 100 * probability) / 100,
    close_date: "2026-12-15",
    late: false,
    position: 0,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

function board(): Columns {
  return {
    new: [deal(1, "new", 1000), deal(2, "new", 2000), deal(3, "new", 3000)],
    qualified: [deal(4, "qualified", 4000)],
    proposal: [deal(5, "proposal", 10_000, { probability: 40 })],
    negotiation: [],
    won: [deal(6, "won", 50_000)],
    lost: [deal(7, "lost", 9_000)],
  };
}

const ids = (columns: Columns, stage: Stage) => columns[stage].map((d) => d.id);

describe("moveCard", () => {
  it("reorders within a column", () => {
    const moved = moveCard(board(), { id: 1, stage: "new", index: 2 }, TODAY);
    expect(ids(moved, "new")).toEqual([2, 3, 1]);
    expect(moved.new[2].probability).toBe(10);
  });

  it("moves between columns and takes the new stage's probability", () => {
    const moved = moveCard(board(), { id: 5, stage: "qualified", index: 0 }, TODAY);
    expect(ids(moved, "proposal")).toEqual([]);
    expect(ids(moved, "qualified")).toEqual([5, 4]);
    const card = moved.qualified[0];
    expect(card.stage).toBe("qualified");
    expect(card.probability).toBe(25);
    expect(card.probability_by_hand).toBe(false);
    expect(card.expected_cents).toBe(250_000);
  });

  it("gives a deal moved to Won or Lost today's date", () => {
    const moved = moveCard(board(), { id: 4, stage: "won", index: 0 }, TODAY);
    expect(moved.won[0]).toMatchObject({ id: 4, stage: "won", probability: 100, close_date: TODAY, late: false });
  });

  it("marks a late card when it leaves Won with an old close date", () => {
    const columns = board();
    columns.won = [deal(6, "won", 50_000, { close_date: "2026-11-01" })];
    const moved = moveCard(columns, { id: 6, stage: "negotiation", index: 0 }, TODAY);
    expect(moved.negotiation[0]).toMatchObject({ late: true, close_date: "2026-11-01" });
  });

  it("doesn't change the columns it was given", () => {
    const columns = board();
    moveCard(columns, { id: 1, stage: "qualified", index: 0 }, TODAY);
    expect(ids(columns, "new")).toEqual([1, 2, 3]);
  });
});

describe("totals", () => {
  it("counts a column", () => {
    expect(columnTotals(board().new)).toEqual({ count: 3, total_cents: 600_000, expected_cents: 60_000 });
  });

  it("leaves Won and Lost out of the board totals", () => {
    expect(boardTotals(board())).toEqual({
      open_cents: (1000 + 2000 + 3000 + 4000 + 10_000) * 100,
      expected_cents: (100 + 200 + 300 + 1000 + 4000) * 100,
      open_count: 5,
    });
  });
});

describe("Board", () => {
  it("shows a move straight away, with new totals, before the server answers", async () => {
    let answer!: () => void;
    const send = vi.fn(() => new Promise<void>((resolve) => (answer = resolve)));
    const onChange = vi.fn();
    const b = new Board(board(), TODAY, send, onChange);

    b.move({ id: 3, stage: "proposal", index: 1 });
    expect(ids(b.shown, "new")).toEqual([1, 2]);
    expect(ids(b.shown, "proposal")).toEqual([5, 3]);
    expect(columnTotals(b.shown.proposal)).toEqual({ count: 2, total_cents: 1_300_000, expected_cents: 550_000 });
    expect(boardTotals(b.shown).expected_cents).toBe((100 + 200 + 1000 + 4000 + 1500) * 100);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(b.busy).toBe(true);

    answer();
    await b.settled();
    expect(b.busy).toBe(false);
    expect(ids(b.shown, "proposal")).toEqual([5, 3]);
  });

  it("takes Won and Lost out of the board totals as soon as a card moves there", () => {
    const b = new Board(board(), TODAY, () => new Promise(() => {}));
    const before = boardTotals(b.shown);
    b.move({ id: 5, stage: "won", index: 0 });
    const after = boardTotals(b.shown);
    expect(after.open_count).toBe(before.open_count - 1);
    expect(after.open_cents).toBe(before.open_cents - 1_000_000);
    expect(after.expected_cents).toBe(before.expected_cents - 400_000);
  });

  it("sends moves one at a time, in order", async () => {
    const sent: number[] = [];
    let inFlight = 0;
    const send = vi.fn(async (move: { id: number }) => {
      inFlight += 1;
      expect(inFlight).toBe(1);
      await new Promise((r) => setTimeout(r, 5));
      sent.push(move.id);
      inFlight -= 1;
    });
    const onSettled = vi.fn();
    const b = new Board(board(), TODAY, send, undefined, undefined, onSettled);
    b.move({ id: 1, stage: "qualified", index: 0 });
    b.move({ id: 2, stage: "qualified", index: 0 });
    b.move({ id: 3, stage: "won", index: 0 });
    await b.settled();
    expect(sent).toEqual([1, 2, 3]);
    expect(onSettled).toHaveBeenCalledTimes(3);
    expect(ids(b.shown, "qualified")).toEqual([2, 1, 4]);
  });

  it("rolls back a failed move and says so", async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();
    const b = new Board(board(), TODAY, () => Promise.reject(new Error("offline")), undefined, onError, onSettled);
    b.move({ id: 1, stage: "negotiation", index: 0 });
    expect(ids(b.shown, "negotiation")).toEqual([1]);

    await b.settled();
    expect(ids(b.shown, "new")).toEqual([1, 2, 3]);
    expect(ids(b.shown, "negotiation")).toEqual([]);
    expect(boardTotals(b.shown)).toEqual(boardTotals(board()));
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { id: 1, stage: "negotiation", index: 0 });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("keeps moves that succeeded before one that failed", async () => {
    const send = vi.fn(async (move: { id: number }) => {
      if (move.id === 2) throw new Error("nope");
    });
    const b = new Board(board(), TODAY, send);
    b.move({ id: 1, stage: "qualified", index: 0 });
    b.move({ id: 2, stage: "qualified", index: 0 });
    await b.settled();
    expect(ids(b.shown, "qualified")).toEqual([1, 4]);
    expect(ids(b.shown, "new")).toEqual([2, 3]);
  });

  it("ignores the server's state while moves are on their way", () => {
    const b = new Board(board(), TODAY, () => new Promise(() => {}));
    b.move({ id: 1, stage: "won", index: 0 });
    b.reset(board());
    expect(ids(b.shown, "won")).toEqual([1, 6]);
  });
});

describe("visibleCards", () => {
  const many = (stage: Stage, n: number) =>
    Array.from({ length: n }, (_, i) =>
      deal(100 + i, stage, 1000, { position: i, close_date: `2026-${String((i % 12) + 1).padStart(2, "0")}-01` }),
    );

  it("shows every card in an open column", () => {
    expect(visibleCards("new", many("new", 250))).toHaveLength(250);
  });

  it("shows the 100 most recent Won or Lost cards, in board order", () => {
    const cards = many("won", 250);
    const shown = visibleCards("won", cards);
    expect(shown).toHaveLength(100);
    const oldestShown = shown.reduce((min, d) => (d.close_date < min ? d.close_date : min), "9999");
    expect(cards.filter((d) => !shown.includes(d)).every((d) => d.close_date <= oldestShown)).toBe(true);
    expect(shown.map((d) => d.position)).toEqual([...shown.map((d) => d.position)].sort((a, b) => a - b));
  });

  it("shows all of a short Won column", () => {
    expect(visibleCards("lost", many("lost", 40))).toHaveLength(40);
  });
});
