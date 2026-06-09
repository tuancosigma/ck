import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isManagerOrAdmin } from "@/lib/auth";

// Managers/admins approve or reject submitted timesheet entries in batch.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ids, action, note } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No entries selected." }, { status: 400 });
  }
  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const result = await prisma.timesheetEntry.updateMany({
    where: { id: { in: ids }, status: "SUBMITTED" },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewNote: action === "REJECT" ? note ?? "Rejected by reviewer" : null,
    },
  });

  return NextResponse.json({ updated: result.count });
}
