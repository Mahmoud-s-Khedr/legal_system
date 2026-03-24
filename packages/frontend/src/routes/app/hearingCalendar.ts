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

export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  // Sunday-start (Egypt): Sunday = 0, no shift needed; other days shift back to Sunday
  const offset = -start.getDay();
  return addDays(start, offset);
}

export function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getVisibleRange(view: CalendarView, focusDate: Date) {
  if (view === "day") {
    return {
      from: startOfDay(focusDate),
      to: endOfDay(focusDate)
    };
  }

  if (view === "week") {
    return {
      from: startOfWeek(focusDate),
      to: endOfWeek(focusDate)
    };
  }

  return {
    from: startOfWeek(startOfMonth(focusDate)),
    to: endOfWeek(endOfMonth(focusDate))
  };
}

export function getMonthGridDays(focusDate: Date) {
  const { from, to } = getVisibleRange("month", focusDate);
  return buildDayRange(from, to);
}

export function getWeekDays(focusDate: Date) {
  const { from, to } = getVisibleRange("week", focusDate);
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
