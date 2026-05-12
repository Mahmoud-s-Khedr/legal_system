import { describe, expect, it } from "vitest";
import {
  buildDayEventLayout,
  buildIsoForDroppedDate,
  eventTopOffsetPx,
  eventTypeLabel,
  normalizeCreateHearing,
  normalizeCreateTask,
  nowIndicatorOffsetPx
} from "./CalendarPage";

describe("CalendarPage helpers", () => {
  it("keeps event hour/minute when dropping by day", () => {
    const original = new Date("2026-04-21T14:30:00.000Z");
    const result = buildIsoForDroppedDate(
      original.toISOString(),
      new Date("2026-04-25T00:00:00.000Z")
    );

    expect(new Date(result).getUTCDate()).toBe(25);
    expect(new Date(result).getHours()).toBe(original.getHours());
    expect(new Date(result).getMinutes()).toBe(original.getMinutes());
  });

  it("keeps target slot hour when lockToHour is true", () => {
    const result = buildIsoForDroppedDate(
      "2026-04-21T14:30:00.000Z",
      new Date("2026-04-25T09:00:00.000Z"),
      true
    );

    expect(new Date(result).getUTCHours()).toBe(9);
  });

  it("normalizes quick task and hearing payloads", () => {
    expect(
      normalizeCreateTask({
        title: "Call client",
        caseId: "",
        assignedToId: "",
        dueAt: "2026-04-21T10:00"
      } as never)
    ).toMatchObject({ caseId: null, assignedToId: null });

    expect(
      normalizeCreateHearing({
        caseId: "case-1",
        assignedLawyerId: "",
        sessionDatetime: "2026-04-21T10:00",
        nextSessionAt: "",
        notes: "",
        outcome: null
      } as never)
    ).toMatchObject({ assignedLawyerId: null, nextSessionAt: null, notes: null });
  });

  it("maps event type labels", () => {
    const t = (key: string) => key;
    expect(eventTypeLabel("hearing", t)).toBe("calendar.eventTypes.hearing");
    expect(eventTypeLabel("task", t)).toBe("calendar.eventTypes.task");
    expect(eventTypeLabel("invoice", t)).toBe("calendar.eventTypes.invoice");
  });

  it("computes current time indicator offset", () => {
    const offset = nowIndicatorOffsetPx();
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(24 * 56);
  });

  it("keeps event top aligned to scheduled hour", () => {
    expect(eventTopOffsetPx("2026-04-21T09:00:00")).toBe(
      9 * 56
    );
    expect(eventTopOffsetPx("2026-04-21T09:30:00")).toBe(
      9.5 * 56
    );
  });

  it("uses slot-relative offsets for timeline layout", () => {
    const layout = buildDayEventLayout([
      {
        id: "first",
        at: "2026-04-21T10:00:00",
        durationMinutes: 60
      }
    ] as never);

    expect(layout[0]?.top).toBe(10 * 56);
  });

  it("assigns overlapping events into side-by-side lanes", () => {
    const layout = buildDayEventLayout([
      {
        id: "a",
        at: "2026-04-21T09:00:00.000Z",
        durationMinutes: 60
      },
      {
        id: "b",
        at: "2026-04-21T09:30:00.000Z",
        durationMinutes: 60
      },
      {
        id: "c",
        at: "2026-04-21T11:00:00.000Z",
        durationMinutes: 30
      }
    ] as never);

    const a = layout.find((item) => item.event.id === "a");
    const b = layout.find((item) => item.event.id === "b");
    const c = layout.find((item) => item.event.id === "c");
    expect(a?.laneCount).toBe(2);
    expect(b?.laneCount).toBe(2);
    expect(a?.laneIndex).not.toBe(b?.laneIndex);
    expect(c?.laneCount).toBe(1);
  });
});
