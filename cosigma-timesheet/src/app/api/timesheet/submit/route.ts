import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Move the user's own DRAFT/REJECTED entries to SUBMITTED for review.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No entries selected." }, { status: 400 });
  }

  const result = await prisma.timesheetEntry.updateMany({
    where: {
      id: { in: ids },
      userId: user.id,
      status: { in: ["DRAFT", "REJECTED"] },
    },
    data: { status: "SUBMITTED", reviewNote: null },
  });

  return NextResponse.json({ submitted: result.count });
}
