// Loads everything the "My Timesheet" page needs: period entries, per-day
// calendar status, assigned projects, leave days, and smart auto-fill defaults.

import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/format";
import {
  getPayrollPeriod,
  eachDay,
  toDateKey,
  isWeekend,
} from "@/lib/payroll-period";

export type DayStatus =
  | "APPROVED"
  | "DRAFT"
  | "SUBMITTED"
  | "REJECTED"
  | "MISSING"
  | "LEAVE"
  | "WEEKEND"
  | "FUTURE";

export interface TimesheetEntryDTO {
  id: string;
  workDate: string;
  hours: number;
  onsiteHours: number;
  remoteHours: number;
  workMode: string;
  taskType: string;
  description: string | null;
  status: string;
  isOvertime: boolean;
  isBillable: boolean;
  projectId: string;
  projectName: string;
  customerName: string;
  reviewNote: string | null;
}

export interface TimesheetPageData {
  periodLabel: string;
  days: { date: string; status: DayStatus; hours: number }[];
  entries: TimesheetEntryDTO[];
  projects: {
    projectId: string;
    customerId: string;
    name: string;
    code: string;
    customerName: string;
  }[];
  defaultWorkMode: string;
  lastProjectId: string | null;
}

export async function getTimesheetPageData(
  userId: string,
  defaultWorkMode: string
): Promise<TimesheetPageData> {
  const period = getPayrollPeriod(new Date());

  const [rawEntries, assignments, leaves] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { userId, workDate: { gte: period.start, lte: period.end } },
      include: { project: true, customer: true },
      orderBy: { workDate: "desc" },
    }),
    prisma.userProjectAssignment.findMany({
      where: { userId, isActive: true },
      include: { project: true, customer: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: period.end },
        endDate: { gte: period.start },
      },
    }),
  ]);

  // Index entries + leaves by day.
  const byDay = new Map<string, (typeof rawEntries)[number][]>();
  for (const e of rawEntries) {
    const key = toDateKey(e.workDate);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(e);
  }
  const leaveDays = new Set<string>();
  for (const lv of leaves) {
    const cur = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    while (cur <= end) {
      leaveDays.add(toDateKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  const todayKey = toDateKey(new Date());
  const days = eachDay(period).map((d) => {
    const key = toDateKey(d);
    const dayEntries = byDay.get(key) ?? [];
    const hours = dayEntries.reduce((s, e) => s + dec(e.hours), 0);
    let status: DayStatus;

    if (dayEntries.length > 0) {
      // Worst-priority status wins so the day flags problems first.
      if (dayEntries.some((e) => e.status === "REJECTED")) status = "REJECTED";
      else if (dayEntries.every((e) => e.status === "APPROVED")) status = "APPROVED";
      else if (dayEntries.some((e) => e.status === "SUBMITTED")) status = "SUBMITTED";
      else status = "DRAFT";
    } else if (leaveDays.has(key)) {
      status = "LEAVE";
    } else if (isWeekend(d)) {
      status = "WEEKEND";
    } else if (key > todayKey) {
      status = "FUTURE";
    } else {
      status = "MISSING";
    }

    return { date: key, status, hours };
  });

  return {
    periodLabel: period.label,
    days,
    entries: rawEntries.map((e) => ({
      id: e.id,
      workDate: toDateKey(e.workDate),
      hours: dec(e.hours),
      onsiteHours: dec(e.onsiteHours),
      remoteHours: dec(e.remoteHours),
      workMode: e.workMode,
      taskType: e.taskType,
      description: e.description,
      status: e.status,
      isOvertime: e.isOvertime,
      isBillable: e.isBillable,
      projectId: e.projectId,
      projectName: e.project.name,
      customerName: e.customer.name,
      reviewNote: e.reviewNote,
    })),
    projects: assignments.map((a) => ({
      projectId: a.projectId,
      customerId: a.customerId,
      name: a.project.name,
      code: a.project.code,
      customerName: a.customer.name,
    })),
    defaultWorkMode,
    lastProjectId: rawEntries[0]?.projectId ?? null,
  };
}
