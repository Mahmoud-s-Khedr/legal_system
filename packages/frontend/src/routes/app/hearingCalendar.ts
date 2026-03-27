export type CalendarView = "month" | "week" | "day";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function resolveWeekStartIndex(locale: string) {
  const value = locale.toLowerCase();
  if (value.startsWith("ar")) {
    return 6; // Saturday in Arabic locales.
  }
  if (value.startsWith("fr")) {
    return 1; // Monday for French locales.
  }
  return 0; // Sunday default.
}

export function startOfWeek(date: Date, weekStartsOn = 0) {
  const start = startOfDay(date);
  const day = start.getDay();
  const offset = -((day - weekStartsOn + 7) % 7);
  return addDays(start, offset);
}

export function endOfWeek(date: Date, weekStartsOn = 0) {
  return endOfDay(addDays(startOfWeek(date, weekStartsOn), 6));
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getVisibleRange(view: CalendarView, focusDate: Date, weekStartsOn = 0) {
  if (view === "day") {
    return {
      from: startOfDay(focusDate),
      to: endOfDay(focusDate)
    };
  }

  if (view === "week") {
    return {
      from: startOfWeek(focusDate, weekStartsOn),
      to: endOfWeek(focusDate, weekStartsOn)
    };
  }

  return {
    from: startOfWeek(startOfMonth(focusDate), weekStartsOn),
    to: endOfWeek(endOfMonth(focusDate), weekStartsOn)
  };
}

export function getMonthGridDays(focusDate: Date, weekStartsOn = 0) {
  const { from, to } = getVisibleRange("month", focusDate, weekStartsOn);
  return buildDayRange(from, to);
}

export function getWeekDays(focusDate: Date, weekStartsOn = 0) {
  const { from, to } = getVisibleRange("week", focusDate, weekStartsOn);
  return buildDayRange(from, to);
}

export function buildDayRange(from: Date, to: Date) {
  const days: Date[] = [];
  let cursor = startOfDay(from);

  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function getDayKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function slotDateTime(date: Date, hour = 9) {
  const slot = new Date(date);
  slot.setHours(hour, 0, 0, 0);
  return toDateTimeLocalValue(slot.toISOString());
}

export function shiftFocusDate(view: CalendarView, focusDate: Date, direction: -1 | 1) {
  if (view === "day") {
    return addDays(focusDate, direction);
  }

  if (view === "week") {
    return addDays(focusDate, direction * 7);
  }

  return new Date(focusDate.getFullYear(), focusDate.getMonth() + direction, 1);
}

export function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

export function addMinutes(date: Date, amount: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + amount);
  return next;
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function hourSlots(day: Date) {
  const start = startOfDay(day);
  return Array.from({ length: 24 }, (_, index) => addMinutes(start, index * 60));
}
