export type ScheduleType = "once" | "daily" | "weekly" | "monthly" | "cron";

export interface ScheduleInput {
  scheduleType: ScheduleType;
  timezone: string;
  runAt?: string | null;
  timeOfDay?: string | null;
  weekdays?: number[] | null;
  dayOfMonth?: number | null;
  cronExpression?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    hour: Number(parts["hour"] === "24" ? "0" : parts["hour"]),
    minute: Number(parts["minute"]),
    weekday: WEEKDAY_INDEX[parts["weekday"] ?? "Sun"] ?? 0,
  };
}

/** Convert a wall-clock time in a timezone into an absolute UTC instant. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(target);

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(guess, timezone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const diff = target - asUtc;
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const chunk of field.split(",")) {
    const [rangePart, stepPart] = chunk.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isFinite(step) || step < 1) continue;

    let start = min;
    let end = max;
    if (rangePart && rangePart !== "*") {
      if (rangePart.includes("-")) {
        const [a, b] = rangePart.split("-");
        start = Number(a);
        end = Number(b);
      } else {
        start = Number(rangePart);
        end = stepPart ? max : Number(rangePart);
      }
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    for (let v = start; v <= end; v += step) {
      if (v >= min && v <= max) values.add(v);
    }
  }
  return [...values].sort((a, b) => a - b);
}

export interface ParsedCron {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  weekdays: number[];
  restrictedDom: boolean;
  restrictedDow: boolean;
}

export function parseCron(expression: string): ParsedCron | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [m, h, dom, mon, dow] = fields as [string, string, string, string, string];
  const parsed: ParsedCron = {
    minutes: parseCronField(m, 0, 59),
    hours: parseCronField(h, 0, 23),
    daysOfMonth: parseCronField(dom, 1, 31),
    months: parseCronField(mon, 1, 12),
    weekdays: parseCronField(dow.replace("7", "0"), 0, 6),
    restrictedDom: dom !== "*",
    restrictedDow: dow !== "*",
  };

  if (
    !parsed.minutes.length ||
    !parsed.hours.length ||
    !parsed.daysOfMonth.length ||
    !parsed.months.length ||
    !parsed.weekdays.length
  ) {
    return null;
  }
  return parsed;
}

function parseTimeOfDay(value?: string | null): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute the next absolute run time for a reminder schedule.
 * Returns null when the schedule has no future occurrence.
 */
export function computeNextRun(input: ScheduleInput, from: Date = new Date()): Date | null {
  const timezone = safeTimezone(input.timezone || "UTC");
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  if (input.scheduleType === "once") {
    if (!input.runAt) return null;
    const runAt = new Date(input.runAt);
    if (Number.isNaN(runAt.getTime()) || runAt.getTime() <= from.getTime()) return null;
    return runAt;
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const base = startsAt && startsAt.getTime() > from.getTime() ? startsAt : from;

  const cron = input.scheduleType === "cron" ? parseCron(input.cronExpression ?? "") : null;
  if (input.scheduleType === "cron" && !cron) return null;

  const tod = parseTimeOfDay(input.timeOfDay);
  const weekdays = (input.weekdays ?? []).filter((d) => d >= 0 && d <= 6);
  const baseParts = getZonedParts(base, timezone);
  const baseDayUtc = Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day);

  for (let offset = 0; offset <= 400; offset += 1) {
    const cursor = new Date(baseDayUtc + offset * 86_400_000);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const weekday = cursor.getUTCDay();

    let dayMatches = true;
    let times: Array<{ hour: number; minute: number }> = [tod];

    if (input.scheduleType === "weekly") {
      dayMatches = weekdays.length === 0 ? true : weekdays.includes(weekday);
    } else if (input.scheduleType === "monthly") {
      const wanted = Math.min(Math.max(input.dayOfMonth ?? 1, 1), 31);
      const effective = Math.min(wanted, daysInMonth(year, month));
      dayMatches = day === effective;
    } else if (cron) {
      const domMatch = cron.daysOfMonth.includes(day);
      const dowMatch = cron.weekdays.includes(weekday);
      const monthMatch = cron.months.includes(month);
      const dayPart =
        cron.restrictedDom && cron.restrictedDow
          ? domMatch || dowMatch
          : (!cron.restrictedDom || domMatch) && (!cron.restrictedDow || dowMatch);
      dayMatches = monthMatch && dayPart;
      times = [];
      for (const hour of cron.hours) {
        for (const minute of cron.minutes) {
          times.push({ hour, minute });
        }
      }
    }

    if (!dayMatches) continue;

    for (const time of times) {
      const candidate = zonedToUtc(year, month, day, time.hour, time.minute, timezone);
      if (candidate.getTime() <= from.getTime()) continue;
      if (endsAt && candidate.getTime() > endsAt.getTime()) return null;
      return candidate;
    }
  }

  return null;
}

/**
 * Preview the next `count` absolute run times for a schedule.
 * Stops early when the schedule has no further occurrence.
 */
export function computeNextRuns(
  input: ScheduleInput,
  count = 5,
  from: Date = new Date(),
): Date[] {
  const runs: Date[] = [];
  let cursor = from;
  for (let i = 0; i < count; i += 1) {
    const next = computeNextRun(input, cursor);
    if (!next) break;
    runs.push(next);
    cursor = next;
    if (input.scheduleType === "once") break;
  }
  return runs;
}



export function describeSchedule(input: ScheduleInput): string {
  const time = input.timeOfDay ?? "09:00";
  switch (input.scheduleType) {
    case "once":
      return input.runAt ? `Once — ${formatInTimezone(new Date(input.runAt), input.timezone)}` : "Once";
    case "daily":
      return `Every day at ${time}`;
    case "weekly": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = (input.weekdays ?? []).map((d) => names[d]).join(", ");
      return `Weekly${days ? ` on ${days}` : ""} at ${time}`;
    }
    case "monthly":
      return `Monthly on day ${input.dayOfMonth ?? 1} at ${time}`;
    case "cron":
      return `Custom cron: ${input.cronExpression ?? ""}`;
    default:
      return "";
  }
}

export function formatInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimezone(timezone),
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];
