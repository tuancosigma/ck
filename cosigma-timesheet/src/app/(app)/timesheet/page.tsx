import { getCurrentUser } from "@/lib/auth";
import { getTimesheetPageData } from "@/lib/data/timesheet";
import { TimesheetView } from "./timesheet-view";

export default async function TimesheetPage() {
  const user = await getCurrentUser();
  const data = await getTimesheetPageData(user!.id, user!.defaultWorkMode);
  return <TimesheetView data={data} />;
}
