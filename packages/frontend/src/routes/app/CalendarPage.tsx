import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateHearingDto,
  CreateTaskDto,
  HearingListResponseDto,
  TaskListResponseDto,
  UserListResponseDto,
  CaseListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  Form,
  Modal,
  Popover,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  message
} from "antd";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "../../lib/api";
import { toCaseSelectOption } from "../../lib/caseOptions";
import { useInvoices } from "../../lib/billing";
import {
  DATE_PICKER_DATETIME_FORMAT,
  fromDatePickerValue,
  toDatePickerValue
} from "../../lib/dateInput";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  selectLabelFilter,
  formatDate,
  formatDateTime
} from "./ui";
import {
  applyEventFilters,
  type CalendarEvent,
  type CalendarEventSource,
  type CalendarMobileMode,
  getEventDayKey,
  normalizeHearingEvents,
  normalizeInvoiceEvents,
  normalizeTaskEvents
} from "./calendarEvents";
import {
  addDays,
  getDayKey,
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  hourSlots,
  isSameDay,
  resolveWeekStartIndex,
  shiftFocusDate,
  slotDateTime,
  startOfDay,
  toDateTimeLocalValue,
  type CalendarView
} from "./hearingCalendar";

const SLOT_HEIGHT = 56;
const DAY_NAMES_START_SUNDAY = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];

export function buildIsoForDroppedDate(
  originalIso: string,
  targetDate: Date,
  lockToHour = false
) {
  const original = new Date(originalIso);
  const next = new Date(targetDate);
  if (!lockToHour) {
    next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  }
  return next.toISOString();
}

function CalendarEventPill({
  event,
  onOpen,
  compact = false
}: {
  event: CalendarEvent;
  onOpen: (event: CalendarEvent) => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `event:${event.id}` });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1
  } as const;

  const color =
    event.sourceType === "hearing"
      ? "var(--calendar-event-hearing)"
      : event.sourceType === "task"
        ? "var(--calendar-event-task)"
        : "var(--calendar-event-invoice)";

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`calendar-event-pill ${compact ? "calendar-event-pill-compact" : ""}`}
      type="button"
      onClick={() => onOpen(event)}
      {...listeners}
      {...attributes}
      aria-label={`${event.title} ${formatDateTime(event.at)}`}
    >
      <span className="calendar-event-dot" style={{ backgroundColor: color }} />
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function DroppableDayCell({
  id,
  day,
  children,
  isOutsideMonth,
  onQuickCreate
}: {
  id: string;
  day: Date;
  children: React.ReactNode;
  isOutsideMonth: boolean;
  onQuickCreate: (day: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`calendar-day-cell ${isOutsideMonth ? "calendar-day-outside" : ""} ${isOver ? "calendar-day-over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onQuickCreate(day)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onQuickCreate(day);
        }
      }}
    >
      {children}
    </div>
  );
}

function DroppableSlot({
  id,
  hour,
  children,
  onQuickCreate
}: {
  id: string;
  hour: Date;
  children?: React.ReactNode;
  onQuickCreate: (day: Date, hour: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`calendar-time-slot ${isOver ? "calendar-slot-over" : ""}`}
      onDoubleClick={() => onQuickCreate(hour, hour.getHours())}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onQuickCreate(hour, hour.getHours());
        }
      }}
    >
      {children}
    </div>
  );
}

export function eventTypeLabel(
  sourceType: CalendarEvent["sourceType"],
  t: (key: string) => string
) {
  if (sourceType === "hearing") return t("calendar.eventTypes.hearing");
  if (sourceType === "task") return t("calendar.eventTypes.task");
  return t("calendar.eventTypes.invoice");
}

function eventLink(event: CalendarEvent) {
  if (event.sourceType === "hearing") {
    return (
      <Link
        className="text-accent hover:underline"
        to="/app/hearings/$hearingId/edit"
        params={{ hearingId: event.linkParams.hearingId }}
      >
        {event.title}
      </Link>
    );
  }

  if (event.sourceType === "task") {
    return (
      <Link
        className="text-accent hover:underline"
        to="/app/tasks/$taskId"
        params={{ taskId: event.linkParams.taskId }}
      >
        {event.title}
      </Link>
    );
  }

  return (
    <Link
      className="text-accent hover:underline"
      to="/app/invoices/$invoiceId"
      params={{ invoiceId: event.linkParams.invoiceId }}
    >
      {event.title}
    </Link>
  );
}

export function nowIndicatorOffsetPx() {
  const now = new Date();
  return (now.getHours() + now.getMinutes() / 60) * SLOT_HEIGHT;
}

export function normalizeCreateTask(form: CreateTaskDto) {
  return {
    ...form,
    caseId: form.caseId || null,
    assignedToId: form.assignedToId || null,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null
  };
}

export function normalizeCreateHearing(form: CreateHearingDto) {
  return {
    ...form,
    assignedLawyerId: form.assignedLawyerId || null,
    sessionDatetime: new Date(form.sessionDatetime).toISOString(),
    nextSessionAt: form.nextSessionAt
      ? new Date(form.nextSessionAt).toISOString()
      : null,
    notes: form.notes || null
  };
}

export function CalendarPage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [msgApi, msgContext] = message.useMessage();
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [mobileMode, setMobileMode] = useState<CalendarMobileMode>("agenda");
  const [selectedTypes, setSelectedTypes] = useState<CalendarEventSource[]>([
    "hearing",
    "task",
    "invoice"
  ]);
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickType, setQuickType] = useState<"hearing" | "task">("hearing");
  const [pendingDrag, setPendingDrag] = useState<{
    event: CalendarEvent;
    nextAt: string;
  } | null>(null);
  const [drawerWidth, setDrawerWidth] = useState<number | string>(440);

  useEffect(() => {
    const onResize = () =>
      setDrawerWidth(window.innerWidth < 640 ? "100%" : 440);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [quickTaskForm, setQuickTaskForm] = useState<CreateTaskDto>({
    title: "",
    caseId: "",
    assignedToId: "",
    dueAt: slotDateTime(new Date())
  });

  const [quickHearingForm, setQuickHearingForm] = useState<CreateHearingDto>({
    caseId: "",
    assignedLawyerId: "",
    sessionDatetime: slotDateTime(new Date()),
    nextSessionAt: "",
    notes: "",
    outcome: null
  });

  const weekStartsOn = useMemo(
    () => resolveWeekStartIndex(i18n.resolvedLanguage ?? i18n.language ?? "en"),
    [i18n.language, i18n.resolvedLanguage]
  );
  const visibleRange = useMemo(
    () => getVisibleRange(view, focusDate, weekStartsOn),
    [focusDate, view, weekStartsOn]
  );

  const hearingsQuery = useQuery({
    queryKey: [
      "calendar-hearings",
      visibleRange.from.toISOString(),
      visibleRange.to.toISOString()
    ],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(
        `/api/hearings?from=${encodeURIComponent(visibleRange.from.toISOString())}&to=${encodeURIComponent(visibleRange.to.toISOString())}&limit=300`
      )
  });

  const tasksQuery = useQuery({
    queryKey: [
      "calendar-tasks",
      visibleRange.from.toISOString(),
      visibleRange.to.toISOString()
    ],
    queryFn: () =>
      apiFetch<TaskListResponseDto>(
        `/api/tasks?from=${encodeURIComponent(visibleRange.from.toISOString())}&to=${encodeURIComponent(visibleRange.to.toISOString())}&limit=300`
      )
  });

  const invoicesQuery = useInvoices({
    from: visibleRange.from.toISOString(),
    to: visibleRange.to.toISOString(),
    limit: 300
  });

  const casesQuery = useQuery({
    queryKey: ["calendar-cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=300")
  });

  const usersQuery = useQuery({
    queryKey: ["calendar-users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users?limit=300")
  });

  const events = useMemo(() => {
    const hearingEvents = normalizeHearingEvents(
      hearingsQuery.data?.items ?? []
    );
    const taskEvents = normalizeTaskEvents(tasksQuery.data?.items ?? []);
    const invoiceEvents = normalizeInvoiceEvents(
      invoicesQuery.data?.items ?? []
    );
    return [...hearingEvents, ...taskEvents, ...invoiceEvents].sort(
      (left, right) =>
        new Date(left.at).getTime() - new Date(right.at).getTime()
    );
  }, [
    hearingsQuery.data?.items,
    invoicesQuery.data?.items,
    tasksQuery.data?.items
  ]);

  const filteredEvents = useMemo(
    () =>
      applyEventFilters(events, {
        visibleTypes: selectedTypes,
        assignee: selectedAssignee
      }),
    [events, selectedAssignee, selectedTypes]
  );

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = getEventDayKey(event.at);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [filteredEvents]);

  const monthDays = useMemo(
    () => getMonthGridDays(focusDate, weekStartsOn),
    [focusDate, weekStartsOn]
  );
  const weekDays = useMemo(
    () => getWeekDays(focusDate, weekStartsOn),
    [focusDate, weekStartsOn]
  );

  const assigneeOptions = useMemo(() => {
    const names = new Map<string, string>();
    names.set("all", t("labels.all"));
    names.set("unassigned", t("labels.unassigned"));
    names.set("finance", "Finance");

    for (const user of usersQuery.data?.items ?? []) {
      names.set(user.id, user.fullName);
    }

    return Array.from(names.entries()).map(([value, label]) => ({
      value,
      label
    }));
  }, [t, usersQuery.data?.items]);

  const caseOptions = useMemo(
    () =>
      (casesQuery.data?.items ?? []).map((caseItem) =>
        toCaseSelectOption(t, caseItem)
      ),
    [casesQuery.data?.items, t]
  );

  const hasError =
    hearingsQuery.isError || tasksQuery.isError || invoicesQuery.isError;

  const headerTitle = useMemo(() => {
    if (view === "day") {
      return new Intl.DateTimeFormat(i18n.language, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(focusDate);
    }
    return new Intl.DateTimeFormat(i18n.language, {
      month: "long",
      year: "numeric"
    }).format(focusDate);
  }, [focusDate, i18n.language, view]);

  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(normalizeCreateTask(payload))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      msgApi.success(t("actions.createTask"));
      setQuickCreateOpen(false);
      setDrawerOpen(false);
    }
  });

  const createHearingMutation = useMutation({
    mutationFn: (payload: CreateHearingDto) =>
      apiFetch("/api/hearings", {
        method: "POST",
        body: JSON.stringify(normalizeCreateHearing(payload))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar-hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      msgApi.success(t("actions.scheduleHearing"));
      setQuickCreateOpen(false);
      setDrawerOpen(false);
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({
      event,
      nextAt
    }: {
      event: CalendarEvent;
      nextAt: string;
    }) => {
      if (event.sourceType === "hearing") {
        if (!event.editable.hearing) {
          throw new Error("Missing hearing payload.");
        }

        return apiFetch(`/api/hearings/${event.sourceId}`, {
          method: "PUT",
          body: JSON.stringify({
            caseId: event.editable.hearing.caseId,
            assignedLawyerId: event.editable.hearing.assignedLawyerId,
            sessionDatetime: nextAt,
            nextSessionAt: event.editable.hearing.nextSessionAt,
            outcome: event.editable.hearing.outcome,
            notes: event.editable.hearing.notes
          })
        });
      }

      if (event.sourceType === "task") {
        if (!event.editable.task) {
          throw new Error("Missing task payload.");
        }

        return apiFetch(`/api/tasks/${event.sourceId}`, {
          method: "PUT",
          body: JSON.stringify({
            caseId: event.editable.task.caseId,
            title: event.editable.task.title,
            description: event.editable.task.description,
            status: event.editable.task.status,
            priority: event.editable.task.priority,
            assignedToId: event.editable.task.assignedToId,
            dueAt: nextAt
          })
        });
      }

      return apiFetch(`/api/invoices/${event.sourceId}`, {
        method: "PUT",
        body: JSON.stringify({
          feeType: event.editable.invoice?.feeType,
          taxAmount: event.editable.invoice?.taxAmount,
          discountAmount: event.editable.invoice?.discountAmount,
          dueDate: nextAt
        })
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar-hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["hearings"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      msgApi.success(t("actions.saveChanges"));
      setPendingDrag(null);
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  function openQuickCreate(day: Date, hour = 9) {
    const datetimeLocal = slotDateTime(day, hour);
    setQuickTaskForm((current) => ({ ...current, dueAt: datetimeLocal }));
    setQuickHearingForm((current) => ({
      ...current,
      sessionDatetime: datetimeLocal
    }));
    setQuickCreateOpen(true);
  }

  function openEventDetail(event: CalendarEvent) {
    if (event.sourceType === "hearing") {
      void navigate({
        to: "/app/hearings/$hearingId/edit",
        params: { hearingId: event.sourceId }
      });
      return;
    }
    if (event.sourceType === "task") {
      void navigate({
        to: "/app/tasks/$taskId",
        params: { taskId: event.sourceId }
      });
      return;
    }
    void navigate({
      to: "/app/invoices/$invoiceId",
      params: { invoiceId: event.sourceId }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";

    if (!activeId.startsWith("event:") || !overId.startsWith("slot:")) {
      return;
    }

    const eventId = activeId.replace("event:", "");
    const targetIso = overId.replace("slot:", "");

    const draggedEvent = filteredEvents.find((item) => item.id === eventId);
    if (!draggedEvent) {
      return;
    }

    const targetDate = new Date(targetIso);
    const lockToHour = view !== "month";
    const nextAt = buildIsoForDroppedDate(
      draggedEvent.at,
      targetDate,
      lockToHour
    );

    if (nextAt === draggedEvent.at) {
      return;
    }

    setPendingDrag({ event: draggedEvent, nextAt });
  }

  const monthColumns = useMemo(() => {
    const ordered = DAY_NAMES_START_SUNDAY.map((_, index) => {
      const value = (index + weekStartsOn) % 7;
      return DAY_NAMES_START_SUNDAY[value];
    });

    return ordered.map((day) =>
      new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
        addDays(
          startOfDay(new Date("2026-03-22T00:00:00.000Z")),
          DAY_NAMES_START_SUNDAY.indexOf(day)
        )
      )
    );
  }, [i18n.language, weekStartsOn]);

  const quickCreateContent = (
    <div className="w-[310px]">
      <Segmented
        value={quickType}
        options={[
          { label: t("calendar.eventTypes.hearing"), value: "hearing" },
          { label: t("calendar.eventTypes.task"), value: "task" }
        ]}
        onChange={(value) => setQuickType(value as "hearing" | "task")}
        block
      />

      {quickType === "task" ? (
        <Form
          layout="vertical"
          className="mt-3"
          onFinish={() => createTaskMutation.mutate(quickTaskForm)}
        >
          <Form.Item label={t("labels.eventTitle")} required>
            <input
              className="calendar-input"
              value={quickTaskForm.title}
              onChange={(event) =>
                setQuickTaskForm((current) => ({
                  ...current,
                  title: event.target.value
                }))
              }
            />
          </Form.Item>
          <Form.Item label={t("labels.dueDate")} required>
            <DatePicker
              className="elms-date-picker"
              classNames={{ popup: { root: "elms-date-picker-dropdown" } }}
              showTime={{ format: "HH:mm" }}
              format={DATE_PICKER_DATETIME_FORMAT}
              value={toDatePickerValue(
                toDateTimeLocalValue(quickTaskForm.dueAt ?? ""),
                "datetime-local"
              )}
              onChange={(nextValue) =>
                setQuickTaskForm((current) => ({
                  ...current,
                  dueAt: fromDatePickerValue(nextValue, "datetime-local")
                }))
              }
              style={{ direction: "ltr", width: "100%" }}
              needConfirm={false}
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createTaskMutation.isPending}
              disabled={!quickTaskForm.title.trim() || !quickTaskForm.dueAt}
            >
              {t("actions.create")}
            </Button>
            <Button onClick={() => setDrawerOpen(true)}>
              {t("actions.more")}
            </Button>
            <Button
              type="link"
              onClick={() => void navigate({ to: "/app/invoices/new" })}
            >
              {t("actions.newInvoice")}
            </Button>
          </Space>
        </Form>
      ) : (
        <Form
          layout="vertical"
          className="mt-3"
          onFinish={() => createHearingMutation.mutate(quickHearingForm)}
        >
          <Form.Item label={t("labels.case")} required>
            <Select
              showSearch
              filterOption={(input, option) => selectLabelFilter(input, option)}
              optionFilterProp="label"
              value={quickHearingForm.caseId}
              options={caseOptions}
              onChange={(value) =>
                setQuickHearingForm((current) => ({
                  ...current,
                  caseId: value
                }))
              }
            />
          </Form.Item>
          <Form.Item label={t("labels.sessionDatetime")} required>
            <DatePicker
              className="elms-date-picker"
              classNames={{ popup: { root: "elms-date-picker-dropdown" } }}
              showTime={{ format: "HH:mm" }}
              format={DATE_PICKER_DATETIME_FORMAT}
              value={toDatePickerValue(
                toDateTimeLocalValue(quickHearingForm.sessionDatetime),
                "datetime-local"
              )}
              onChange={(nextValue) =>
                setQuickHearingForm((current) => ({
                  ...current,
                  sessionDatetime: fromDatePickerValue(
                    nextValue,
                    "datetime-local"
                  )
                }))
              }
              style={{ direction: "ltr", width: "100%" }}
              needConfirm={false}
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={createHearingMutation.isPending}
              disabled={
                !quickHearingForm.caseId || !quickHearingForm.sessionDatetime
              }
            >
              {t("actions.create")}
            </Button>
            <Button onClick={() => setDrawerOpen(true)}>
              {t("actions.more")}
            </Button>
            <Button
              type="link"
              onClick={() => void navigate({ to: "/app/invoices/new" })}
            >
              {t("actions.newInvoice")}
            </Button>
          </Space>
        </Form>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {msgContext}
      <PageHeader
        eyebrow={t("nav.calendar")}
        title={t("calendar.title")}
        description={t("calendar.description")}
        actions={
          <Space wrap>
            <Segmented
              value={view}
              options={[
                { label: t("hearings.views.month"), value: "month" },
                { label: t("hearings.views.week"), value: "week" },
                { label: t("hearings.views.day"), value: "day" }
              ]}
              onChange={(value) => setView(value as CalendarView)}
            />
            <Button
              onClick={() => setFocusDate(shiftFocusDate(view, focusDate, -1))}
            >
              {t("hearings.previous")}
            </Button>
            <Button onClick={() => setFocusDate(new Date())}>
              {t("hearings.today")}
            </Button>
            <Button
              onClick={() => setFocusDate(shiftFocusDate(view, focusDate, 1))}
            >
              {t("hearings.next")}
            </Button>
            <Popover
              trigger="click"
              open={quickCreateOpen}
              onOpenChange={setQuickCreateOpen}
              content={quickCreateContent}
            >
              <Button type="primary">{t("actions.create")}</Button>
            </Popover>
          </Space>
        }
      />

      <SectionCard title={headerTitle} description={t("hearings.rangeHelp")}>
        <div className="calendar-filter-row">
          <div className="flex flex-wrap items-center gap-2">
            {(["hearing", "task", "invoice"] as CalendarEventSource[]).map(
              (sourceType) => (
                <Tag.CheckableTag
                  key={sourceType}
                  checked={selectedTypes.includes(sourceType)}
                  onChange={(checked) =>
                    setSelectedTypes((current) =>
                      checked
                        ? Array.from(new Set([...current, sourceType]))
                        : current.filter((item) => item !== sourceType)
                    )
                  }
                >
                  {eventTypeLabel(sourceType, t)}
                </Tag.CheckableTag>
              )
            )}
          </div>

          <Select
            className="w-full md:w-64"
            value={selectedAssignee}
            options={assigneeOptions}
            onChange={setSelectedAssignee}
          />
        </div>

        <div className="md:hidden mb-3">
          <Segmented
            value={mobileMode}
            options={[
              { label: t("calendar.mobileAgenda"), value: "agenda" },
              { label: t("calendar.mobileTimeline"), value: "timeline" }
            ]}
            onChange={(value) => setMobileMode(value as CalendarMobileMode)}
            block
          />
        </div>

        {hasError ? (
          <ErrorState
            title={t("errors.title")}
            description={t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => {
              void hearingsQuery.refetch();
              void tasksQuery.refetch();
              void invoicesQuery.refetch();
            }}
          />
        ) : null}

        {!hasError && !filteredEvents.length ? (
          <EmptyState
            title={t("hearings.emptyRangeTitle")}
            description={t("hearings.emptyRangeDescription")}
          />
        ) : null}

        {!hasError ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {view === "month" ? (
              <div
                className={
                  mobileMode === "timeline" ? "hidden md:block" : "block"
                }
              >
                <div className="calendar-month-grid">
                  {monthColumns.map((label) => (
                    <div className="calendar-weekday-header" key={label}>
                      {label}
                    </div>
                  ))}

                  {monthDays.map((day) => {
                    const dayKey = getDayKey(day);
                    const dayEvents = eventsByDay.get(dayKey) ?? [];
                    const outsideMonth =
                      day.getMonth() !== focusDate.getMonth();

                    return (
                      <DroppableDayCell
                        key={dayKey}
                        id={`slot:${startOfDay(day).toISOString()}`}
                        day={day}
                        onQuickCreate={openQuickCreate}
                        isOutsideMonth={outsideMonth}
                      >
                        <div className="calendar-day-number">
                          {day.getDate()}
                        </div>
                        <div className="mt-2 space-y-1">
                          {dayEvents.slice(0, 4).map((item) => (
                            <Tooltip
                              key={item.id}
                              title={`${item.title} • ${formatDateTime(item.at)}`}
                            >
                              <div>
                                <CalendarEventPill
                                  event={item}
                                  onOpen={openEventDetail}
                                  compact
                                />
                              </div>
                            </Tooltip>
                          ))}
                          {dayEvents.length > 4 ? (
                            <button
                              type="button"
                              className="text-xs text-slate-500"
                              onClick={(event) => {
                                event.stopPropagation();
                                setFocusDate(day);
                                setView("day");
                              }}
                            >
                              +{dayEvents.length - 4} more
                            </button>
                          ) : null}
                        </div>
                      </DroppableDayCell>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {view === "week" || view === "day" ? (
              <div
                className={
                  mobileMode === "timeline" ? "hidden md:block" : "block"
                }
              >
                <div className="calendar-timeline-shell">
                  <div className="calendar-time-label-col">
                    <div className="h-10" />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        className="calendar-time-label"
                        style={{ height: SLOT_HEIGHT }}
                      >
                        {`${hour.toString().padStart(2, "0")}:00`}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-time-columns">
                    <div
                      className="calendar-time-columns-header"
                      style={{
                        gridTemplateColumns: `repeat(${view === "day" ? 1 : weekDays.length}, minmax(0, 1fr))`
                      }}
                    >
                      {(view === "day" ? [focusDate] : weekDays).map((day) => {
                        const label = new Intl.DateTimeFormat(i18n.language, {
                          weekday: "short",
                          day: "numeric",
                          month: "short"
                        }).format(day);
                        return (
                          <div
                            className="calendar-day-header"
                            key={day.toISOString()}
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className="calendar-time-columns-grid"
                      style={{
                        gridTemplateColumns: `repeat(${view === "day" ? 1 : weekDays.length}, minmax(0, 1fr))`
                      }}
                    >
                      {(view === "day" ? [focusDate] : weekDays).map((day) => {
                        const key = day.toISOString();
                        const dayEvents = filteredEvents.filter((eventItem) =>
                          isSameDay(new Date(eventItem.at), day)
                        );

                        return (
                          <div className="calendar-time-day" key={key}>
                            {hourSlots(day).map((hour) => (
                              <DroppableSlot
                                key={hour.toISOString()}
                                id={`slot:${hour.toISOString()}`}
                                hour={hour}
                                onQuickCreate={openQuickCreate}
                              />
                            ))}

                            {isSameDay(day, new Date()) ? (
                              <div
                                className="calendar-now-indicator"
                                style={{ top: nowIndicatorOffsetPx() + 40 }}
                              />
                            ) : null}

                            {dayEvents.map((eventItem) => {
                              const at = new Date(eventItem.at);
                              const top =
                                (at.getHours() + at.getMinutes() / 60) *
                                SLOT_HEIGHT;
                              const height = Math.max(
                                (eventItem.durationMinutes / 60) * SLOT_HEIGHT,
                                30
                              );

                              return (
                                <div
                                  key={eventItem.id}
                                  className="calendar-time-event"
                                  style={{ top: top + 40, height }}
                                >
                                  <CalendarEventPill
                                    event={eventItem}
                                    onOpen={openEventDetail}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              className={`space-y-3 ${mobileMode === "timeline" ? "md:hidden" : ""}`}
            >
              {Array.from(eventsByDay.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([day, dayEvents]) => (
                  <article
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                    key={day}
                  >
                    <h3 className="font-semibold">{formatDate(day)}</h3>
                    <div className="mt-3 space-y-2">
                      {dayEvents.map((eventItem) => (
                        <div
                          className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                          key={eventItem.id}
                        >
                          <div>
                            <p className="text-xs text-slate-500">
                              {eventTypeLabel(eventItem.sourceType, t)}
                            </p>
                            <p className="font-medium">
                              {eventLink(eventItem)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {eventItem.subtitle}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(eventItem.at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          </DndContext>
        ) : null}
      </SectionCard>

      <Drawer
        title={
          quickType === "hearing"
            ? t("hearings.createTitle")
            : t("tasks.createTitle")
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={drawerWidth}
      >
        {quickType === "hearing" ? (
          <Form
            layout="vertical"
            onFinish={() => createHearingMutation.mutate(quickHearingForm)}
          >
            <Form.Item label={t("labels.case")} required>
              <Select
                showSearch
                filterOption={(input, option) => selectLabelFilter(input, option)}
                optionFilterProp="label"
                value={quickHearingForm.caseId}
                options={caseOptions}
                onChange={(value) =>
                  setQuickHearingForm((current) => ({
                    ...current,
                    caseId: value
                  }))
                }
              />
            </Form.Item>
            <Form.Item label={t("labels.assignedLawyer")}>
              <Select
                allowClear
                value={quickHearingForm.assignedLawyerId || undefined}
                options={(usersQuery.data?.items ?? []).map((user) => ({
                  value: user.id,
                  label: user.fullName
                }))}
                onChange={(value) =>
                  setQuickHearingForm((current) => ({
                    ...current,
                    assignedLawyerId: value ?? ""
                  }))
                }
              />
            </Form.Item>
            <Form.Item label={t("labels.sessionDatetime")} required>
              <DatePicker
                className="elms-date-picker"
                classNames={{ popup: { root: "elms-date-picker-dropdown" } }}
                showTime={{ format: "HH:mm" }}
                format={DATE_PICKER_DATETIME_FORMAT}
                value={toDatePickerValue(
                  toDateTimeLocalValue(quickHearingForm.sessionDatetime),
                  "datetime-local"
                )}
                onChange={(nextValue) =>
                  setQuickHearingForm((current) => ({
                    ...current,
                    sessionDatetime: fromDatePickerValue(
                      nextValue,
                      "datetime-local"
                    )
                  }))
                }
                style={{ direction: "ltr", width: "100%" }}
                needConfirm={false}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createHearingMutation.isPending}
                  disabled={
                    !quickHearingForm.caseId ||
                    !quickHearingForm.sessionDatetime
                  }
                >
                  {t("actions.create")}
                </Button>
                <Button
                  onClick={() => void navigate({ to: "/app/hearings/new" })}
                >
                  {t("actions.more")}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <Form
            layout="vertical"
            onFinish={() => createTaskMutation.mutate(quickTaskForm)}
          >
            <Form.Item label={t("labels.eventTitle")} required>
              <input
                className="calendar-input"
                value={quickTaskForm.title}
                onChange={(event) =>
                  setQuickTaskForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
              />
            </Form.Item>
            <Form.Item label={t("labels.assignedLawyer")}>
              <Select
                allowClear
                value={quickTaskForm.assignedToId || undefined}
                options={(usersQuery.data?.items ?? []).map((user) => ({
                  value: user.id,
                  label: user.fullName
                }))}
                onChange={(value) =>
                  setQuickTaskForm((current) => ({
                    ...current,
                    assignedToId: value ?? ""
                  }))
                }
              />
            </Form.Item>
            <Form.Item label={t("labels.dueDate")} required>
              <DatePicker
                className="elms-date-picker"
                classNames={{ popup: { root: "elms-date-picker-dropdown" } }}
                showTime={{ format: "HH:mm" }}
                format={DATE_PICKER_DATETIME_FORMAT}
                value={toDatePickerValue(
                  toDateTimeLocalValue(quickTaskForm.dueAt ?? ""),
                  "datetime-local"
                )}
                onChange={(nextValue) =>
                  setQuickTaskForm((current) => ({
                    ...current,
                    dueAt: fromDatePickerValue(nextValue, "datetime-local")
                  }))
                }
                style={{ direction: "ltr", width: "100%" }}
                needConfirm={false}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createTaskMutation.isPending}
                  disabled={!quickTaskForm.title.trim() || !quickTaskForm.dueAt}
                >
                  {t("actions.create")}
                </Button>
                <Button onClick={() => void navigate({ to: "/app/tasks/new" })}>
                  {t("actions.more")}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Drawer>

      <Modal
        title={t("calendar.confirmMoveTitle")}
        open={Boolean(pendingDrag)}
        onCancel={() => setPendingDrag(null)}
        onOk={() => {
          if (pendingDrag) {
            rescheduleMutation.mutate(pendingDrag);
          }
        }}
        confirmLoading={rescheduleMutation.isPending}
      >
        {pendingDrag ? (
          <Space direction="vertical" size={4}>
            <Badge
              color="var(--color-accent)"
              text={eventTypeLabel(pendingDrag.event.sourceType, t)}
            />
            <div>{pendingDrag.event.title}</div>
            <div className="text-slate-500">
              {formatDateTime(pendingDrag.nextAt)}
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
