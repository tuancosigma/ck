import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Return the current user's active project assignments, optionally filtered by
// a search term (project name/code or customer name). Powers form autocomplete.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const assignments = await prisma.userProjectAssignment.findMany({
    where: { userId: user.id, isActive: true },
    include: { project: true, customer: true },
    orderBy: { createdAt: "asc" },
  });

  const projects = assignments
    .map((a) => ({
      projectId: a.projectId,
      customerId: a.customerId,
      name: a.project.name,
      code: a.project.code,
      customerName: a.customer.name,
    }))
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
    );

  return NextResponse.json({ projects });
}
