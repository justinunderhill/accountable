import { format, parseISO } from "date-fns";

// One formatter, made once: toLocaleString builds a new one on every call, which
// shows up when a board renders thousands of cards.
const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Whole US dollars from cents, such as "$12,500". */
export function formatMoney(cents: number): string {
  const dollars = Math.round(cents / 100);
  const sign = dollars < 0 ? "-" : "";
  return sign + "$" + WHOLE.format(Math.abs(dollars));
}

/** A short amount for tiles and chart axes: "$0", "$850", "$40k", "$1.2M". */
export function formatMoneyShort(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars === 0) return "$0";
  if (Math.abs(dollars) < 1000) return formatMoney(cents);
  const thousands = Math.round(dollars / 1000);
  if (Math.abs(thousands) < 1000) return `$${thousands}k`;
  const millions = (dollars / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `$${millions}M`;
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function formatCount(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** "2026-11-21" as "Nov 21, 2026". Dates are read as local, so they never shift a day. */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

/** "2026-11-21" as "Nov 21". */
export function formatShortDate(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** "2026-11-19T14:30:00" as "Nov 19, 2026, 2:30 PM". */
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy, h:mm a");
}

/** "2026-11-21" as "Saturday, November 21". */
export function formatLongDate(iso: string): string {
  return format(parseISO(iso), "EEEE, MMMM d");
}

/** "2026-03" as "Mar", or "March 2026" in full. */
export function formatMonth(month: string, full = false): string {
  return format(parseISO(`${month}-01`), full ? "MMMM yyyy" : "MMM");
}

/** "2025-12" as "Dec 2025". */
export function formatMonthYear(month: string): string {
  return format(parseISO(`${month}-01`), "MMM yyyy");
}

export function centsToDollars(cents: number): number {
  return Math.round(cents / 100);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars) * 100;
}

/** Two initials for an avatar: "Maria Lopez" -> "ML". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
