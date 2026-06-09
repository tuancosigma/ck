import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateTimesheetEntry } from "@/lib/timesheet-validation";
import { fromDateKey } from "@/lib/payroll-period";
import { WorkMode } from "@prisma/client";

// Derive the onsite/remote split from the selected work mode. HYBRID trusts
// the supplied split; WFH/ONSITE are auto-calculated from the total.
function resolveSplit(mode: WorkMode, hours: number, onsite: number, remote: number) {
  if (mode === "WFH") return { onsiteHours: 0, remoteHours: hours };
  if (mode === "ONSITE") return { onsiteHours: hours, remoteHours: 0 };
  return { onsiteHours: onsite, remoteHours: remote };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      id,
      projectId,
      workDate,
      hours,
      description,
      taskType,
      workMode,
      onsiteHours = 0,
      remoteHours = 0,
      isBillable = true,
      isOvertime = false,
      status = "DRAFT",
    } = body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 400 });
    }

    const totalHours = Number(hours);
    const split = resolveSplit(
      workMode as WorkMode,
      totalHours,
      Number(onsiteHours),
      Number(remoteHours)
    );
    const date = fromDateKey(String(workDate));

    const validation = await validateTimesheetEntry({
      userId: user.id,
      projectId,
      customerId: project.customerId,
      workDate: date,
      hours: totalHours,
      workMode: workMode as WorkMode,
      onsiteHours: split.onsiteHours,
      remoteHours: split.remoteHours,
      isOvertime,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(" "), errors: validation.errors },
        { status: 422 }
      );
    }

    const data = {
      userId: user.id,
      projectId,
      customerId: project.customerId,
      workDate: date,
      hours: totalHours,
      description: description ?? null,
      taskType,
      workMode,
      onsiteHours: split.onsiteHours,
      remoteHours: split.remoteHours,
      isBillable,
      isOvertime,
      status,
    };

    const entry = id
      ? await prisma.timesheetEntry.update({
          where: { id, userId: user.id },
          data,
        })
      : await prisma.timesheetEntry.create({ data });

    return NextResponse.json({ id: entry.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save entry." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.timesheetEntry.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
