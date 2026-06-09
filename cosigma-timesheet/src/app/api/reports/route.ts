import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getReport } from "@/lib/data/reports";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const report = await getReport({
    customerId: searchParams.get("customerId") || undefined,
    projectId: searchParams.get("projectId") || undefined,
    userId: searchParams.get("userId") || undefined,
    period: searchParams.get("period") || undefined,
  });

  return NextResponse.json(report);
}
