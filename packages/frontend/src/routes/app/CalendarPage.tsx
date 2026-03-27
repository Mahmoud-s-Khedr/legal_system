import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { HearingListResponseDto, TaskListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useInvoices } from "../../lib/billing";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  formatDate,
  formatDateTime
} from "./ui";
import type { CalendarEvent } from "./calendarEvents";
import { normalizeHearingEvents, normalizeInvoiceEvents, normalizeTaskEvents } from "./calendarEvents";
import { type CalendarView, getVisibleRange, shiftFocusDate } from "./hearingCalendar";

function eventTypeLabel(sourceType: CalendarEvent["sourceType"], t: (key: string) => string) {
  if (sourceType === "hearing") return t("calendar.eventTypes.hearing");
  if (sourceType === "task") return t("calendar.eventTypes.task");
  return t("calendar.eventTypes.invoice");
}

function eventLink(event: CalendarEvent) {
  if (event.sourceType === "hearing") {
    return <Link className="text-accent hover:underline" to="/app/hearings/$hearingId/edit" params={{ hearingId: event.linkParams.hearingId }}>{event.title}</Link>;
  }

  if (event.sourceType === "task") {
    return <Link className="text-accent hover:underline" to="/app/tasks/$taskId" params={{ taskId: event.linkParams.taskId }}>{event.title}</Link>;
  }

  return <Link className="text-accent hover:underline" to="/app/invoices/$invoiceId" params={{ invoiceId: event.linkParams.invoiceId }}>{event.title}</Link>;
}

export function CalendarPage() {
  const { t, i18n } = useTranslation("app");
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => new Date());

  const visibleRange = useMemo(() => getVisibleRange(view, focusDate), [focusDate, view]);

  const hearingsQuery = useQuery({
    queryKey: ["calendar-hearings", visibleRange.from.toISOString(), visibleRange.to.toISOString()],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(
        `/api/hearings?from=${encodeURIComponent(visibleRange.from.toISOString())}&to=${encodeURIComponent(visibleRange.to.toISOString())}&limit=200`
      )
  });

  const tasksQuery = useQuery({
    queryKey: ["calendar-tasks", visibleRange.from.toISOString(), visibleRange.to.toISOString()],
    queryFn: () =>
      apiFetch<TaskListResponseDto>(
        `/api/tasks?from=${encodeURIComponent(visibleRange.from.toISOString())}&to=${encodeURIComponent(visibleRange.to.toISOString())}&limit=200`
      )
  });

  const invoicesQuery = useInvoices({
    from: visibleRange.from.toISOString(),
    to: visibleRange.to.toISOString()
  });

  const events = useMemo(() => {
    const hearingEvents = normalizeHearingEvents(hearingsQuery.data?.items ?? []);
    const taskEvents = normalizeTaskEvents(tasksQuery.data?.items ?? []);
    const invoiceEvents = normalizeInvoiceEvents(invoicesQuery.data?.items ?? []);
    return [...hearingEvents, ...taskEvents, ...invoiceEvents].sort(
      (left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()
    );
  }, [hearingsQuery.data?.items, invoicesQuery.data?.items, tasksQuery.data?.items]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.at.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const hasError = hearingsQuery.isError || tasksQuery.isError || invoicesQuery.isError;

  const headerTitle = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric"
  }).format(focusDate);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.calendar")}
        title={t("calendar.title")}
        description={t("calendar.description")}
        actions={
          <>
            <div className="flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-1">
              {(["month", "week", "day"] as CalendarView[]).map((mode) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    view === mode ? "bg-accent text-white" : "text-slate-600"
                  }`}
                  key={mode}
                  onClick={() => setView(mode)}
                  type="button"
                >
                  {t(`hearings.views.${mode}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                onClick={() => setFocusDate(shiftFocusDate(view, focusDate, -1))}
                type="button"
              >
                {t("hearings.previous")}
              </button>
              <button
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                onClick={() => setFocusDate(new Date())}
                type="button"
              >
                {t("hearings.today")}
              </button>
              <button
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                onClick={() => setFocusDate(shiftFocusDate(view, focusDate, 1))}
                type="button"
              >
                {t("hearings.next")}
              </button>
            </div>
          </>
        }
      />

      <SectionCard title={headerTitle} description={t("hearings.rangeHelp")}>
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

        {!hasError && !events.length ? (
          <EmptyState title={t("hearings.emptyRangeTitle")} description={t("hearings.emptyRangeDescription")} />
        ) : null}

        {!hasError ? (
          <div className="space-y-3">
            {groupedByDate.map(([day, dayEvents]) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4" key={day}>
                <h3 className="font-semibold">{formatDate(day)}</h3>
                <div className="mt-3 space-y-2">
                  {dayEvents.map((event) => (
                    <div
                      className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      key={event.id}
                    >
                      <div>
                        <p className="text-xs text-slate-500">{eventTypeLabel(event.sourceType, t)}</p>
                        <p className="font-medium">{eventLink(event)}</p>
                        <p className="text-xs text-slate-500">{event.subtitle}</p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDateTime(event.at)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
