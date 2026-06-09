// Server-side validation for timesheet entries. Enforces business rules that
// cannot be trusted from the client.

import { prisma } from "./prisma";
import { endOfDay, isWeekend, startOfDay } from "./payroll-period";
import { WorkMode } from "@prisma/client";

export interface TimesheetInput {
  userId: string;
  projectId: string;
  customerId: string;
  workDate: Date;
  hours: number;
  workMode: WorkMode;
  onsiteHours: number;
  remoteHours: number;
  isOvertime: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Hours allowed for the day (e.g. capped to 4 on a half-day leave). */
  maxHours?: number;
}

const HALF_DAY_CAP = 4;
const FLOAT_TOLERANCE = 0.01;

/**
 * Validate a timesheet entry against weekend, assignment, leave and hour-split
 * rules. Reads live state from the database.
 */
export async function validateTimesheetEntry(
  input: TimesheetInput
): Promise<ValidationResult> {
  const errors: string[] = [];
  const date = startOfDay(new Date(input.workDate));

  // 1. Weekend rule -- only allowed when explicitly flagged as overtime.
  if (isWeekend(date) && !input.isOvertime) {
    errors.push(
      "Entries on weekends are only allowed when marked as overtime."
    );
  }

  // 2. Hour sanity.
  if (input.hours <= 0 || input.hours > 24) {
    errors.push("Total hours must be between 0 and 24.");
  }

  // 3. Onsite + remote must equal total hours (for every work mode the split
  //    is stored, so it must always reconcile).
  const split = (input.onsiteHours ?? 0) + (input.remoteHours ?? 0);
  if (Math.abs(split - input.hours) > FLOAT_TOLERANCE) {
    errors.push(
      `Onsite (${input.onsiteHours}) + remote (${input.remoteHours}) hours must equal total hours (${input.hours}).`
    );
  }

  // 4. Project assignment must be active on the logged date.
  const assignment = await prisma.userProjectAssignment.findFirst({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      isActive: true,
      startDate: { lte: endOfDay(date) },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
  });
  if (!assignment) {
    errors.push(
      "You are not assigned to this project on the selected date."
    );
  }

  // 5. Leave integration -- block on full-day leave, cap on half-day leave.
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      userId: input.userId,
      status: "APPROVED",
      startDate: { lte: endOfDay(date) },
      endDate: { gte: date },
    },
  });

  let maxHours: number | undefined;
  if (leave) {
    if (leave.isHalfDay) {
      maxHours = HALF_DAY_CAP;
      if (input.hours > HALF_DAY_CAP + FLOAT_TOLERANCE) {
        errors.push(
          `You are on half-day leave; max ${HALF_DAY_CAP} hours can be logged.`
        );
      }
    } else {
      errors.push("You are on full-day approved leave for this date.");
    }
  }

  return { valid: errors.length === 0, errors, maxHours };
}
