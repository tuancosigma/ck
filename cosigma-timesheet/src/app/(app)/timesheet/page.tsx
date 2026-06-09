import { getCurrentUser } from "@/lib/auth";
import { getTimesheetPageData } from "@/lib/data/timesheet";
import { TimesheetView } from "./timesheet-view";

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  const data = await getTimesheetPageData(user!.id, user!.defaultWorkMode);
  const { date } = await searchParams;
  return <TimesheetView data={data} initialDate={date} />;
}
