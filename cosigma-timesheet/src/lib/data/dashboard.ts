// Aggregates the data shown on the dashboard for a given user.

import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/format";
import { calculateCompliance, ONSITE_DAY_THRESHOLD } from "@/lib/compliance";
import {
  getPayrollPeriod,
  workingDays,
  workingDaysElapsed,
  toDateKey,
  fromDateKey,
  eachDateKey,
  isWeekend,
  startOfDay,
  endOfDay,
} from "@/lib/payroll-period";

// Sums hours/onsite/remote per YYYY-MM-DD across any timesheet-like rows.
type DecLike = Parameters<typeof dec>[0];
function sumByDay(
  rows: { workDate: Date; hours: DecLike; onsiteHours: DecLike; remoteHours: DecLike }[]
): Map<string, { hours: number; onsite: number; remote: number }> {
  const map = new Map<string, { hours: number; onsite: number; remote: number }>();
  for (const e of rows) {
    const key = toDateKey(e.workDate);
    const cur = map.get(key) ?? { hours: 0, onsite: 0, remote: 0 };
    cur.hours += dec(e.hours);
    cur.onsite += dec(e.onsiteHours);
    cur.remote += dec(e.remoteHours);
    map.set(key, cur);
  }
  return map;
}

export type HeatStatus = "ONSITE" | "WFH" | "HYBRID" | "OTHER" | "MISSING";

export interface HeatDay {
  date: string; // YYYY-MM-DD
  status: HeatStatus;
  hours: number;
}

const TARGET_HOURS_PER_DAY = 8;

export interface DashboardData {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  compliance: {
    rate: number;
    requiredOnsiteDays: number;
    actualOnsiteDays: number;
    onsiteDaysRemaining: number;
    workingDays: number;
    isCompliant: boolean;
  };
  totalHours: number;
  targetHours: number;
  underTarget: boolean;
  pendingDrafts: number;
  remainingLeave: number;
  missingDays: string[]; // YYYY-MM-DD of elapsed working days with no log
  // Per working-day hours for the dashboard bar chart.
  dailyHours: { date: string; hours: number; onsite: number; isToday: boolean }[];
  // Sliding policy-violation banners.
  warnings: { id: string; message: string }[];
  recentEntries: {
    id: string;
    workDate: string;
    hours: number;
    project: string;
    customer: string;
    status: string;
    workMode: string;
  }[];
  // Last ~6 months of Mon-Fri days for the attendance heatmap.
  heatmap: HeatDay[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const period = getPayrollPeriod(new Date());

  const entries = await prisma.timesheetEntry.findMany({
    where: { userId, workDate: { gte: period.start, lte: period.end } },
    include: { project: true, customer: true },
    orderBy: { workDate: "desc" },
  });

  const compliance = calculateCompliance(
    entries.map((e) => ({
      workDate: e.workDate,
      onsiteHours: dec(e.onsiteHours),
      hours: dec(e.hours),
    }))
  );

  const totalHours = entries.reduce((sum, e) => sum + dec(e.hours), 0);

  const pendingDrafts = entries.filter(
    (e) => e.status === "DRAFT" || e.status === "REJECTED"
  ).length;

  // Remaining annual leave for the current year.
  const year = new Date().getFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveYear: { userId, leaveYear: year } },
  });

  // Approved leave dates. Full-day leave is excused from "missing" alerts; any
  // leave (incl. half-day, which is legitimately < 8h) is excused from the
  // low-hours warnings below.
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId, status: "APPROVED" },
  });
  const excused = new Set<string>(); // full-day leave
  const anyLeaveDays = new Set<string>(); // full + half day leave
  for (const lv of leaves) {
    for (const key of eachDateKey(lv.startDate, lv.endDate)) {
      anyLeaveDays.add(key);
      if (!lv.isHalfDay) excused.add(key);
    }
  }

  const loggedDays = new Set(entries.map((e) => toDateKey(e.workDate)));
  const missingDays = workingDaysElapsed(period)
    .map(toDateKey)
    .filter((key) => !loggedDays.has(key) && !excused.has(key));

  const targetHours = workingDaysElapsed(period).length * TARGET_HOURS_PER_DAY;

  // Per working-day hours (total + onsite + remote) for the bar chart.
  const hoursByDay = sumByDay(entries);
  const todayKey = toDateKey(new Date());
  const dailyHours = workingDays(period).map((d) => {
    const key = toDateKey(d);
    const v = hoursByDay.get(key) ?? { hours: 0, onsite: 0 };
    return { date: key, hours: v.hours, onsite: v.onsite, isToday: key === todayKey };
  });

  // Policy-violation banners: under-target days + hybrid split mismatches.
  const warnings: { id: string; message: string }[] = [];
  for (const e of entries) {
    const h = dec(e.hours);
    if (e.workMode === "HYBRID") {
      const split = dec(e.onsiteHours) + dec(e.remoteHours);
      if (Math.abs(split - h) > 0.01) {
        warnings.push({
          id: `split-${e.id}`,
          message: `Hybrid split mismatch on ${e.workDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — onsite+remote ≠ ${h}h`,
        });
      }
    }
  }
  // Low-hours warnings only apply to elapsed Mon-Fri working days (dailyHours is
  // already weekend-free) that aren't covered by approved leave.
  const now = new Date();
  for (const d of dailyHours) {
    if (
      d.hours > 0 &&
      d.hours < TARGET_HOURS_PER_DAY &&
      fromDateKey(d.date) <= now &&
      !anyLeaveDays.has(d.date)
    ) {
      warnings.push({
        id: `low-${d.date}`,
        message: `Only ${d.hours}h logged on ${fromDateKey(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — below the 8h target`,
      });
    }
  }

  const onsiteDaysRemaining = Math.max(
    0,
    compliance.requiredOnsiteDays - compliance.actualOnsiteDays
  );

  // Attendance heatmap: last ~6 months of Mon-Fri days, classified by mode.
  const heatStart = startOfDay(new Date());
  heatStart.setMonth(heatStart.getMonth() - 6);
  const heatEntries = await prisma.timesheetEntry.findMany({
    where: { userId, workDate: { gte: heatStart, lte: endOfDay(new Date()) } },
    select: { workDate: true, hours: true, onsiteHours: true, remoteHours: true },
  });
  const heatByDay = sumByDay(heatEntries);
  const heatmap: HeatDay[] = [];
  const heatCursor = startOfDay(heatStart);
  const heatEnd = startOfDay(new Date());
  while (heatCursor <= heatEnd) {
    if (!isWeekend(heatCursor)) {
      const key = toDateKey(heatCursor);
      const v = heatByDay.get(key);
      let status: HeatStatus = "MISSING";
      if (v) {
        if (v.onsite >= ONSITE_DAY_THRESHOLD) status = "ONSITE";
        else if (v.remote >= ONSITE_DAY_THRESHOLD) status = "WFH";
        else if (v.onsite > 0 && v.remote > 0) status = "HYBRID";
        else if (v.hours > 0) status = "OTHER";
      }
      heatmap.push({ date: key, status, hours: v?.hours ?? 0 });
    }
    heatCursor.setDate(heatCursor.getDate() + 1);
  }

  return {
    periodLabel: period.label,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    compliance: {
      rate: compliance.complianceRate,
      requiredOnsiteDays: compliance.requiredOnsiteDays,
      actualOnsiteDays: compliance.actualOnsiteDays,
      onsiteDaysRemaining,
      workingDays: compliance.workingDays,
      isCompliant: compliance.isCompliant,
    },
    totalHours,
    targetHours,
    underTarget: totalHours < targetHours,
    pendingDrafts,
    remainingLeave: dec(balance?.remainingDays),
    missingDays,
    dailyHours,
    warnings: warnings.slice(0, 5),
    recentEntries: entries.slice(0, 8).map((e) => ({
      id: e.id,
      workDate: e.workDate.toISOString(),
      hours: dec(e.hours),
      project: e.project.name,
      customer: e.customer.name,
      status: e.status,
      workMode: e.workMode,
    })),
    heatmap,
  };
}
