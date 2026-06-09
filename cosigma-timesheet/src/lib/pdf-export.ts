// Client-side PDF generation for the report hub. Produces a clean, branded
// document: header band, entry-log table, and a compliance/summary panel.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate, fmtHours, fmtPct } from "./format";
import type { ReportResult } from "./data/reports";

const INDIGO: [number, number, number] = [99, 102, 241];
const SLATE: [number, number, number] = [30, 41, 59];

export function exportReportPdf(report: ReportResult, contextLabel: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band.
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Cosigma Timesheet Report", 40, 35);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Payroll Period: ${report.periodLabel}  ·  ${contextLabel}`, 40, 54);
  doc.text(`Generated ${new Date().toLocaleString("en-US")}`, pageWidth - 40, 54, {
    align: "right",
  });

  // Entry log table.
  autoTable(doc, {
    startY: 90,
    head: [["Date", "Employee", "Customer", "Project", "Task", "Mode", "Onsite", "Hours", "Status"]],
    body: report.lines.map((l) => [
      fmtDate(l.workDate),
      l.user,
      l.customer,
      l.project,
      l.taskType.replace("_", " "),
      l.workMode,
      fmtHours(l.onsiteHours),
      fmtHours(l.hours),
      l.status,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: SLATE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    theme: "striped",
    margin: { left: 40, right: 40 },
  });

  // Summary panel.
  // @ts-expect-error lastAutoTable is added by the autotable plugin at runtime
  const afterTable: number = doc.lastAutoTable?.finalY ?? 120;
  const s = report.summary;
  const summaryY = afterTable + 24;

  doc.setFillColor(248, 249, 252);
  doc.roundedRect(40, summaryY, pageWidth - 80, 90, 6, 6, "F");
  doc.setTextColor(...SLATE);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 56, summaryY + 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const stats: [string, string][] = [
    ["Total Hours", fmtHours(s.totalHours)],
    ["Onsite Hours", fmtHours(s.onsiteHours)],
    ["Remote Hours", fmtHours(s.remoteHours)],
    ["Billable Hours", fmtHours(s.billableHours)],
    ["Entries", String(s.entryCount)],
    ["Compliance", fmtPct(s.complianceRate)],
    ["Onsite Days", `${s.actualOnsiteDays}/${s.requiredOnsiteDays}`],
    ["Status", s.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"],
  ];
  const colW = (pageWidth - 110) / 4;
  stats.forEach(([label, value], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 56 + col * colW;
    const y = summaryY + 46 + row * 22;
    doc.setTextColor(120, 130, 150);
    doc.text(label, x, y);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 90, y);
    doc.setFont("helvetica", "normal");
  });

  doc.save(`cosigma-report-${report.periodLabel.replace(" ", "-")}.pdf`);
}
