// Onsite-compliance calculator for a payroll period.
//
// Rule: an employee must be physically onsite for at least half of the
// Mon-Fri working days in the payroll month (25th -> 24th). A day counts as
// an "onsite day" when the sum of onsiteHours logged that day is >= 4.

import {
  PayrollPeriod,
  getPayrollPeriod,
  toDateKey,
  workingDays,
} from "./payroll-period";

/** Minimal timesheet shape needed for compliance math. */
export interface ComplianceEntry {
  workDate: Date;
  onsiteHours: number;
  hours: number;
}

export interface ComplianceResult {
  period: PayrollPeriod;
  workingDays: number;
  requiredOnsiteDays: number;
  actualOnsiteDays: number;
  complianceRate: number; // 0..1, actual/required (capped at 1)
  rawOnsiteRatio: number; // actualOnsiteDays / workingDays
  isCompliant: boolean;
  totalHours: number;
}

/** Minimum onsite hours in a single day for it to count as an onsite day. */
export const ONSITE_DAY_THRESHOLD = 4;

/** Required onsite ratio of working days. */
export const REQUIRED_ONSITE_RATIO = 0.5;

export function calculateCompliance(
  entries: ComplianceEntry[],
  reference: Date = new Date()
): ComplianceResult {
  const period = getPayrollPeriod(reference);
  const periodWorkingDays = workingDays(period);
  const workingDayKeys = new Set(periodWorkingDays.map(toDateKey));

  // Sum onsite hours per working day.
  const onsiteByDay = new Map<string, number>();
  let totalHours = 0;

  for (const entry of entries) {
    const key = toDateKey(new Date(entry.workDate));
    totalHours += Number(entry.hours) || 0;
    if (!workingDayKeys.has(key)) continue;
    onsiteByDay.set(
      key,
      (onsiteByDay.get(key) ?? 0) + (Number(entry.onsiteHours) || 0)
    );
  }

  let actualOnsiteDays = 0;
  for (const total of onsiteByDay.values()) {
    if (total >= ONSITE_DAY_THRESHOLD) actualOnsiteDays += 1;
  }

  const totalWorkingDays = periodWorkingDays.length;
  const requiredOnsiteDays = Math.ceil(
    totalWorkingDays * REQUIRED_ONSITE_RATIO
  );

  const complianceRate =
    requiredOnsiteDays === 0
      ? 1
      : Math.min(1, actualOnsiteDays / requiredOnsiteDays);

  const rawOnsiteRatio =
    totalWorkingDays === 0 ? 0 : actualOnsiteDays / totalWorkingDays;

  return {
    period,
    workingDays: totalWorkingDays,
    requiredOnsiteDays,
    actualOnsiteDays,
    complianceRate,
    rawOnsiteRatio,
    isCompliant: actualOnsiteDays >= requiredOnsiteDays,
    totalHours,
  };
}
