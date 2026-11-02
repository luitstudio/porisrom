import { ValidatorConstraint, type ValidatorConstraintInterface } from "class-validator";

export const MIN_WORK_ASSIGNMENT_BUDGET = 1;
export const WORK_ASSIGNMENT_TIME_ZONE = "Asia/Kolkata";

export function dateKeyInTimeZone(date: Date, timeZone = WORK_ASSIGNMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

export function tomorrowDateKey(now = new Date(), timeZone = WORK_ASSIGNMENT_TIME_ZONE) {
  return addDaysToDateKey(dateKeyInTimeZone(now, timeZone), 1);
}

export function isDueDateAtLeastTomorrow(value: string, now = new Date()) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return dateKeyInTimeZone(parsed) >= tomorrowDateKey(now);
}

@ValidatorConstraint({ name: "isDueDateAtLeastTomorrow", async: false })
export class IsDueDateAtLeastTomorrowConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === "string" && isDueDateAtLeastTomorrow(value);
  }

  defaultMessage() {
    return "Due date must be at least tomorrow";
  }
}
