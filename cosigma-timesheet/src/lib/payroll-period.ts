// Payroll period helpers. A payroll month runs from the 25th of the previous
// month through the 24th of the current month (inclusive).

export interface PayrollPeriod {
  /** Inclusive first day (25th of the prior calendar month). */
  start: Date;
  /** Inclusive last day (24th of the anchor calendar month). */
  end: Date;
  /** Human label, e.g. "Jun 2026". */
  label: string;
}

/** Start of day in local time. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** End of day in local time. */
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Resolve the payroll period that a given date belongs to.
 * Dates on/after the 25th roll into the next month's period.
 */
export function getPayrollPeriod(reference: Date = new Date()): PayrollPeriod {
  const ref = startOfDay(reference);
  const day = ref.getDate();

  // Anchor month is the month whose 24th closes the period.
  let anchorYear = ref.getFullYear();
  let anchorMonth = ref.getMonth();
  if (day >= 25) {
    anchorMonth += 1;
    if (anchorMonth > 11) {
      anchorMonth = 0;
      anchorYear += 1;
    }
  }

  const end = startOfDay(new Date(anchorYear, anchorMonth, 24));
  const start = startOfDay(new Date(anchorYear, anchorMonth - 1, 25));

  const label = end.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return { start, end: endOfDay(end), label };
}

/** Build a payroll period from an explicit anchor month (0-based) and year. */
export function getPayrollPeriodForMonth(
  anchorYear: number,
  anchorMonth: number
): PayrollPeriod {
  const end = startOfDay(new Date(anchorYear, anchorMonth, 24));
  const start = startOfDay(new Date(anchorYear, anchorMonth - 1, 25));
  const label = end.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return { start, end: endOfDay(end), label };
}

/** True for Saturday/Sunday. */
export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** All calendar days within the period (inclusive). */
export function eachDay(period: PayrollPeriod): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(period.start);
  const last = startOfDay(period.end);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Mon-Fri working days within the period. */
export function workingDays(period: PayrollPeriod): Date[] {
  return eachDay(period).filter((d) => !isWeekend(d));
}

/** Count of working days up to and including the reference (capped at period end). */
export function workingDaysElapsed(
  period: PayrollPeriod,
  reference: Date = new Date()
): Date[] {
  const ref = startOfDay(reference);
  return workingDays(period).filter((d) => d <= ref);
}

/** Format a Date as YYYY-MM-DD (local). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local start-of-day Date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
