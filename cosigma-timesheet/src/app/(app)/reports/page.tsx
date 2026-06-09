import { getReportOptions, getReport } from "@/lib/data/reports";
import { ReportsView } from "./reports-view";

export default async function ReportsPage() {
  const [options, initial] = await Promise.all([
    getReportOptions(),
    getReport({}),
  ]);
  return <ReportsView options={options} initial={initial} />;
}
