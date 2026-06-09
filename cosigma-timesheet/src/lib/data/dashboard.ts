// Aggregates the data shown on the dashboard for a given user.

import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/format";
import { calculateCompliance } from "@/lib/compliance";
import {
  getPayrollPeriod,
  workingDays,
  workingDaysElapsed,
  toDateKey,
  fromDateKey,
} from "@/lib/payroll-period";

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

  // Approved full-day leave dates are excused from "missing" alerts.
  const leaves = await prisma.leaveRequest.findMany({
    where: { userId, status: "APPROVED", isHalfDay: false },
  });
  const excused = new Set<string>();
  for (const lv of leaves) {
    const cur = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    while (cur <= end) {
      excused.add(toDateKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  const loggedDays = new Set(entries.map((e) => toDateKey(e.workDate)));
  const missingDays = workingDaysElapsed(period)
    .map(toDateKey)
    .filter((key) => !loggedDays.has(key) && !excused.has(key));

  const targetHours = workingDaysElapsed(period).length * TARGET_HOURS_PER_DAY;

  // Per working-day hours (total + onsite) for the bar chart.
  const hoursByDay = new Map<string, { hours: number; onsite: number }>();
  for (const e of entries) {
    const key = toDateKey(e.workDate);
    const cur = hoursByDay.get(key) ?? { hours: 0, onsite: 0 };
    cur.hours += dec(e.hours);
    cur.onsite += dec(e.onsiteHours);
    hoursByDay.set(key, cur);
  }
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
  for (const [key, v] of hoursByDay) {
    const d = fromDateKey(key);
    if (d <= new Date() && v.hours > 0 && v.hours < TARGET_HOURS_PER_DAY) {
      warnings.push({
        id: `low-${key}`,
        message: `Only ${v.hours}h logged on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — below the 8h target`,
      });
    }
  }

  const onsiteDaysRemaining = Math.max(
    0,
    compliance.requiredOnsiteDays - compliance.actualOnsiteDays
  );

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
  };
}
