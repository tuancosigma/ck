// Report query layer: filter options + filtered timesheet lines with summary.

import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/format";
import { calculateCompliance } from "@/lib/compliance";
import { getPayrollPeriodForMonth } from "@/lib/payroll-period";
import type { Prisma } from "@prisma/client";

export interface ReportFilters {
  customerId?: string;
  projectId?: string;
  userId?: string;
  /** Anchor month "YYYY-M" (1-based month). */
  period?: string;
}

export interface ReportOptions {
  customers: { id: string; name: string }[];
  projects: { id: string; name: string; customerId: string }[];
  users: { id: string; name: string }[];
  periods: { value: string; label: string }[];
}

export interface ReportLine {
  id: string;
  workDate: string;
  user: string;
  customer: string;
  project: string;
  taskType: string;
  workMode: string;
  hours: number;
  onsiteHours: number;
  status: string;
}

export interface ReportResult {
  lines: ReportLine[];
  summary: {
    totalHours: number;
    onsiteHours: number;
    remoteHours: number;
    billableHours: number;
    entryCount: number;
    complianceRate: number;
    requiredOnsiteDays: number;
    actualOnsiteDays: number;
    isCompliant: boolean;
  };
  periodLabel: string;
}

export async function getReportOptions(): Promise<ReportOptions> {
  const [customers, projects, users] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Offer the last 6 payroll periods as choices.
  const periods: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const p = getPayrollPeriodForMonth(d.getFullYear(), d.getMonth());
    periods.push({ value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: p.label });
  }

  return {
    customers: customers.map((c) => ({ id: c.id, name: c.name })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, customerId: p.customerId })),
    users: users.map((u) => ({ id: u.id, name: u.name })),
    periods,
  };
}

export async function getReport(filters: ReportFilters): Promise<ReportResult> {
  const now = new Date();
  let anchorYear = now.getFullYear();
  let anchorMonth = now.getMonth();
  if (filters.period) {
    const [y, m] = filters.period.split("-").map(Number);
    anchorYear = y;
    anchorMonth = m - 1;
  }
  const period = getPayrollPeriodForMonth(anchorYear, anchorMonth);

  const where: Prisma.TimesheetEntryWhereInput = {
    workDate: { gte: period.start, lte: period.end },
  };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.userId) where.userId = filters.userId;

  const entries = await prisma.timesheetEntry.findMany({
    where,
    include: { user: true, project: true, customer: true },
    orderBy: [{ workDate: "asc" }, { userId: "asc" }],
  });

  const lines: ReportLine[] = entries.map((e) => ({
    id: e.id,
    workDate: e.workDate.toISOString(),
    user: e.user.name,
    customer: e.customer.name,
    project: e.project.name,
    taskType: e.taskType,
    workMode: e.workMode,
    hours: dec(e.hours),
    onsiteHours: dec(e.onsiteHours),
    status: e.status,
  }));

  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const onsiteHours = lines.reduce((s, l) => s + l.onsiteHours, 0);
  const billableHours = entries
    .filter((e) => e.isBillable)
    .reduce((s, e) => s + dec(e.hours), 0);

  // Compliance only meaningful for a single user filter.
  const comp = calculateCompliance(
    entries.map((e) => ({
      workDate: e.workDate,
      onsiteHours: dec(e.onsiteHours),
      hours: dec(e.hours),
    })),
    period.start
  );

  return {
    lines,
    periodLabel: period.label,
    summary: {
      totalHours,
      onsiteHours,
      remoteHours: totalHours - onsiteHours,
      billableHours,
      entryCount: lines.length,
      complianceRate: comp.complianceRate,
      requiredOnsiteDays: comp.requiredOnsiteDays,
      actualOnsiteDays: comp.actualOnsiteDays,
      isCompliant: comp.isCompliant,
    },
  };
}
