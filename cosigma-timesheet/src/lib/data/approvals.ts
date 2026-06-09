// Loads submitted timesheet entries grouped by team member for the manager
// approval interface.

import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/format";
import { getPayrollPeriod } from "@/lib/payroll-period";

export interface ApprovalEntry {
  id: string;
  workDate: string;
  hours: number;
  workMode: string;
  taskType: string;
  description: string | null;
  project: string;
  customer: string;
}

export interface TeamMemberApprovals {
  userId: string;
  name: string;
  email: string;
  role: string;
  totalHours: number;
  entries: ApprovalEntry[];
}

export async function getApprovalsData(): Promise<TeamMemberApprovals[]> {
  const period = getPayrollPeriod(new Date());

  const entries = await prisma.timesheetEntry.findMany({
    where: {
      status: "SUBMITTED",
      workDate: { gte: period.start, lte: period.end },
    },
    include: { user: true, project: true, customer: true },
    orderBy: { workDate: "asc" },
  });

  const byUser = new Map<string, TeamMemberApprovals>();
  for (const e of entries) {
    let group = byUser.get(e.userId);
    if (!group) {
      group = {
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
        role: e.user.role,
        totalHours: 0,
        entries: [],
      };
      byUser.set(e.userId, group);
    }
    group.totalHours += dec(e.hours);
    group.entries.push({
      id: e.id,
      workDate: e.workDate.toISOString(),
      hours: dec(e.hours),
      workMode: e.workMode,
      taskType: e.taskType,
      description: e.description,
      project: e.project.name,
      customer: e.customer.name,
    });
  }

  return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
}
