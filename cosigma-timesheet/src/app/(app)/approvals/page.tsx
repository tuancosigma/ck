import { redirect } from "next/navigation";
import { getCurrentUser, isManagerOrAdmin } from "@/lib/auth";
import { getApprovalsData } from "@/lib/data/approvals";
import { ApprovalsView } from "./approvals-view";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAdmin(user.role)) redirect("/dashboard");

  const teams = await getApprovalsData();
  return <ApprovalsView teams={teams} />;
}
