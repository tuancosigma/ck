// Seed data for Cosigma Timesheet. Produces a small but realistic dataset that
// demonstrates both compliant and non-compliant onsite states, missing-day
// alerts, drafts, and leave balances.

import { PrismaClient, WorkMode, TaskType } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  getPayrollPeriod,
  workingDays,
  isWeekend,
} from "../src/lib/payroll-period";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main() {
  console.log("Clearing existing data...");
  await prisma.timesheetEntry.deleteMany();
  await prisma.userProjectAssignment.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.project.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  console.log("Creating users...");
  const admin = await prisma.user.create({
    data: {
      name: "Ava Stone",
      email: "admin@cosigma.com",
      password: hash,
      role: "ADMIN",
      defaultWorkMode: WorkMode.HYBRID,
    },
  });
  const manager = await prisma.user.create({
    data: {
      name: "Marcus Lee",
      email: "manager@cosigma.com",
      password: hash,
      role: "MANAGER",
      defaultWorkMode: WorkMode.ONSITE,
    },
  });
  const employee = await prisma.user.create({
    data: {
      name: "Elena Park",
      email: "employee@cosigma.com",
      password: hash,
      role: "EMPLOYEE",
      defaultWorkMode: WorkMode.HYBRID,
    },
  });

  console.log("Creating customers & projects...");
  const acme = await prisma.customer.create({
    data: { name: "Acme Corp", code: "ACME", description: "Enterprise client" },
  });
  const globex = await prisma.customer.create({
    data: { name: "Globex Inc", code: "GLBX", description: "Fintech client" },
  });
  const internal = await prisma.customer.create({
    data: { name: "Cosigma Internal", code: "INT", description: "Internal R&D" },
  });

  const projects = await Promise.all([
    prisma.project.create({
      data: { customerId: acme.id, name: "Acme Platform", code: "ACME-PLT", type: "EXTERNAL" },
    }),
    prisma.project.create({
      data: { customerId: globex.id, name: "Globex Payments", code: "GLBX-PAY", type: "EXTERNAL" },
    }),
    prisma.project.create({
      data: { customerId: internal.id, name: "Design System", code: "INT-DS", type: "INTERNAL" },
    }),
  ]);

  const period = getPayrollPeriod(new Date());
  const assignStart = new Date(period.start);
  assignStart.setMonth(assignStart.getMonth() - 6);

  console.log("Creating project assignments...");
  const users = [admin, manager, employee];
  for (const u of users) {
    for (const p of projects) {
      const cust =
        p.customerId === acme.id ? acme : p.customerId === globex.id ? globex : internal;
      await prisma.userProjectAssignment.create({
        data: {
          userId: u.id,
          projectId: p.id,
          customerId: cust.id,
          startDate: assignStart,
          isActive: true,
        },
      });
    }
  }

  console.log("Creating timesheet entries...");
  const wd = workingDays(period);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Manager: COMPLIANT -> onsite (8h onsite) on most elapsed working days.
  await seedEntries(manager.id, projects[0], acme.id, wd, today, {
    workMode: WorkMode.ONSITE,
    onsiteRatio: 1,
    skipEvery: 7, // rarely skips
    statusPattern: "APPROVED",
  });

  // Employee: NON-COMPLIANT -> mostly WFH, few onsite days, some missing days,
  // and a couple of drafts to surface the "pending drafts" KPI.
  await seedEntries(employee.id, projects[1], globex.id, wd, today, {
    workMode: WorkMode.HYBRID,
    onsiteRatio: 0.25, // only a quarter of days hit the onsite threshold
    skipEvery: 3, // every 3rd elapsed day missing -> missing alerts
    statusPattern: "MIXED",
  });

  // Admin: a few onsite logs for variety.
  await seedEntries(admin.id, projects[2], internal.id, wd, today, {
    workMode: WorkMode.HYBRID,
    onsiteRatio: 0.6,
    skipEvery: 4,
    statusPattern: "SUBMITTED",
  });

  console.log("Creating leave balances & requests...");
  const year = today.getFullYear();
  for (const u of users) {
    await prisma.leaveBalance.create({
      data: {
        userId: u.id,
        leaveYear: year,
        carriedForwardFromPreviousYear: 3,
        accruedDays: 12,
        usedDays: u.id === employee.id ? 4 : 2,
        remainingDays: u.id === employee.id ? 11 : 13,
        lastResetDate: new Date(year, 0, 1),
      },
    });
  }

  // Approved half-day leave for the employee on an upcoming working day.
  const futureLeave = wd.find((d) => d > today);
  if (futureLeave) {
    await prisma.leaveRequest.create({
      data: {
        userId: employee.id,
        startDate: futureLeave,
        endDate: futureLeave,
        totalDays: 0.5,
        leaveType: "ANNUAL_LEAVE",
        status: "APPROVED",
        isHalfDay: true,
        reason: "Medical appointment",
      },
    });
  }
  await prisma.leaveRequest.create({
    data: {
      userId: employee.id,
      startDate: new Date(year, today.getMonth() + 1, 10),
      endDate: new Date(year, today.getMonth() + 1, 12),
      totalDays: 3,
      leaveType: "ANNUAL_LEAVE",
      status: "PENDING",
      reason: "Family trip",
    },
  });

  console.log("\nSeed complete. Login with:");
  console.log("  admin@cosigma.com / manager@cosigma.com / employee@cosigma.com");
  console.log(`  password: ${PASSWORD}`);
}

interface SeedOpts {
  workMode: WorkMode;
  onsiteRatio: number;
  skipEvery: number;
  statusPattern: "APPROVED" | "SUBMITTED" | "MIXED";
}

const TASKS: TaskType[] = [
  TaskType.DEVELOPMENT,
  TaskType.MEETING,
  TaskType.CODE_REVIEW,
  TaskType.TESTING,
  TaskType.BUG_FIX,
];

async function seedEntries(
  userId: string,
  project: { id: string; customerId: string },
  customerId: string,
  days: Date[],
  today: Date,
  opts: SeedOpts
) {
  const elapsed = days.filter((d) => d <= today && !isWeekend(d));
  let i = 0;
  for (const day of elapsed) {
    i++;
    if (i % opts.skipEvery === 0) continue; // leave a gap -> missing alert

    const hours = 8;
    const onsite = i % Math.max(1, Math.round(1 / opts.onsiteRatio)) === 0 ? 8 : 0;
    const remote = hours - onsite;
    const mode =
      onsite === hours ? WorkMode.ONSITE : remote === hours ? WorkMode.WFH : opts.workMode;

    let status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
    if (opts.statusPattern === "APPROVED") status = "APPROVED";
    else if (opts.statusPattern === "SUBMITTED") status = "SUBMITTED";
    else status = i % 5 === 0 ? "DRAFT" : i % 7 === 0 ? "SUBMITTED" : "APPROVED";

    await prisma.timesheetEntry.create({
      data: {
        userId,
        projectId: project.id,
        customerId,
        workDate: day,
        hours,
        onsiteHours: mode === WorkMode.ONSITE ? hours : mode === WorkMode.WFH ? 0 : onsite,
        remoteHours: mode === WorkMode.WFH ? hours : mode === WorkMode.ONSITE ? 0 : remote,
        workMode: mode,
        taskType: TASKS[i % TASKS.length],
        description: `Worked on ${project.id.slice(0, 4)} deliverables`,
        isBillable: true,
        status,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
