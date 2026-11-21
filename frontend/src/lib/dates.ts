import { addDays as addDaysToDate, format, parseISO } from "date-fns";
import { isOpenStage, type Stage } from "./stages";

// Dates stay as "YYYY-MM-DD" strings and are compared as strings, which sort
// correctly. They're only turned into Date objects with parseISO, which reads
// them as local time, so they never shift by a day. "Today" comes from the
// backend; the frontend never decides it.

export const COMING_UP_DAYS = 7;

export function addDays(iso: string, days: number): string {
  return format(addDaysToDate(parseISO(iso), days), "yyyy-MM-dd");
}

/** An open deal whose close date is before today. */
export function isLate(stage: Stage, closeDate: string, today: string): boolean {
  return isOpenStage(stage) && closeDate < today;
}

export type FollowUpState = "overdue" | "coming_up" | "later" | "done";

/** Where a follow-up stands. Coming up runs from today to 7 days from today, inclusive. */
export function followUpState(followUpDate: string, done: boolean, today: string): FollowUpState {
  if (done) return "done";
  if (followUpDate < today) return "overdue";
  if (followUpDate <= addDays(today, COMING_UP_DAYS)) return "coming_up";
  return "later";
}

/** The browser's local date and time as "YYYY-MM-DDTHH:mm", for a datetime-local input. */
export function nowForInput(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd'T'HH:mm");
}

/** "Good morning" up to noon, "Good afternoon" to 6 PM, then "Good evening". */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
