import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = await getDashboardData(user!.id);
  return <DashboardView data={data} userName={user!.name} />;
}
