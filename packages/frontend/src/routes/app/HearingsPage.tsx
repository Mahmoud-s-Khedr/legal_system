import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  type HearingDto,
  type HearingListResponseDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  formatDateTime
} from "./ui";
import {
  type CalendarView,
  getDayKey,
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  shiftFocusDate
} from "./hearingCalendar";

const hearingPalette = [
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-sky-200 bg-sky-50 text-sky-900",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-rose-200 bg-rose-50 text-rose-900",
  "border-violet-200 bg-violet-50 text-violet-900",
  "border-cyan-200 bg-cyan-50 text-cyan-900"
];

export function HearingsPage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);

    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isMobile && view !== "day") {
      setView("day");
    }
  }, [isMobile, view]);

  const visibleRange = useMemo(() => getVisibleRange(view, focusDate), [focusDate, view]);

  const hearingsQuery = useQuery({
    queryKey: [
      "hearings",
      view,
      visibleRange.from.toISOString(),
      visibleRange.to.toISOString()
    ],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(
        `/api/hearings?from=${encodeURIComponent(visibleRange.from.toISOString())}&to=${encodeURIComponent(visibleRange.to.toISOString())}`
      )
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const hearings = hearingsQuery.data?.items ?? [];

  const hearingsByDay = useMemo(() => {
    const grouped = new Map<string, HearingDto[]>();

    for (const hearing of hearings) {
      const key = getDayKey(hearing.sessionDatetime);
      grouped.set(key, [...(grouped.get(key) ?? []), hearing]);
    }

    for (const entry of grouped.values()) {
      entry.sort(
        (left, right) =>
          new Date(left.sessionDatetime).getTime() - new Date(right.sessionDatetime).getTime()
      );
    }

    return grouped;
  }, [hearings]);

  const colorByLawyer = useMemo(() => {
    const lawywers = Array.from(
      new Set(hearings.map((hearing) => hearing.assignedLawyerId ?? hearing.assignedLawyerName ?? "unassigned"))
    );

    return new Map(
      lawywers.map((lawyerKey, index) => [lawyerKey, hearingPalette[index % hearingPalette.length]])
    );
  }, [hearings]);

  const headerTitle = useMemo(() => {
    if (view === "day") {
      return new Intl.DateTimeFormat(i18n.language, {
        weekday: "long",
        month: "long",
        day: "numeric"
      }).format(focusDate);
    }

    if (view === "week") {
      const weekDays = getWeekDays(focusDate);
      const first = weekDays[0];
      const last = weekDays[weekDays.length - 1];

      return `${new Intl.DateTimeFormat(i18n.language, {
        month: "short",
        day: "numeric"
      }).format(first)} - ${new Intl.DateTimeFormat(i18n.language, {
        month: "short",
        day: "numeric"
      }).format(last)}`;
    }

    return new Intl.DateTimeFormat(i18n.language, {
      month: "long",
      year: "numeric"
    }).format(focusDate);
  }, [focusDate, i18n.language, view]);

  const visibleDays = view === "month" ? getMonthGridDays(focusDate) : getWeekDays(focusDate);
  const dayHearings = hearingsByDay.get(getDayKey(focusDate)) ?? [];

  function openCreateForDate(_date: Date) {
    void _date;
    void navigate({ to: "/app/hearings/new" });
  }

  const actions = (
    <>
      {!isMobile ? (
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
      ) : (
        <span className="rounded-full bg-accentSoft px-4 py-2 text-sm font-semibold text-emerald-900">
          {t("hearings.mobileDayView")}
        </span>
      )}
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
        <Link
          className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
          to="/app/hearings/new"
        >
          {t("hearings.newHearing")}
        </Link>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={actions}
        eyebrow={t("hearings.eyebrow")}
        title={t("hearings.title")}
        description={t("hearings.description")}
      />
      <SectionCard title={headerTitle} description={t("hearings.rangeHelp")}>
        {view === "month" ? (
          <MonthCalendar
            colorByLawyer={colorByLawyer}
            focusDate={focusDate}
            onCreate={openCreateForDate}
            hearingsByDay={hearingsByDay}
            visibleDays={visibleDays}
          />
        ) : null}
        {view === "week" ? (
          <WeekCalendar
            colorByLawyer={colorByLawyer}
            onCreate={openCreateForDate}
            hearingsByDay={hearingsByDay}
            visibleDays={visibleDays}
          />
        ) : null}
        {view === "day" ? (
          <DayCalendar
            colorByLawyer={colorByLawyer}
            day={focusDate}
            hearings={dayHearings}
            onCreate={openCreateForDate}
            unassignedLabel={t("labels.unassigned")}
          />
        ) : null}
        {!hearings.length ? (
          <div className="mt-4">
            <EmptyState
              title={t("hearings.emptyRangeTitle")}
              description={t("hearings.emptyRangeDescription")}
            />
          </div>
        ) : null}
      </SectionCard>
      <SectionCard title={t("hearings.legend")} description={t("hearings.legendHelp")}>
        <div className="flex flex-wrap gap-3">
          {(usersQuery.data?.items ?? [])
            .filter((user) => hearings.some((hearing) => hearing.assignedLawyerId === user.id))
            .map((user) => (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorByLawyer.get(user.id) ?? hearingPalette[0]}`}
                key={user.id}
              >
                {user.fullName}
              </span>
            ))}
          {hearings.some((hearing) => !hearing.assignedLawyerId) ? (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorByLawyer.get("unassigned") ?? hearingPalette[0]}`}
            >
              {t("labels.unassigned")}
            </span>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

function MonthCalendar({
  visibleDays,
  hearingsByDay,
  focusDate,
  colorByLawyer,
  onCreate
}: {
  visibleDays: Date[];
  hearingsByDay: Map<string, HearingDto[]>;
  focusDate: Date;
  colorByLawyer: Map<string, string>;
  onCreate: (date: Date) => void;
}) {
  const { i18n } = useTranslation("app");

  const weekdayHeaders = useMemo(() => {
    const sunday = new Date(2023, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(d.getDate() + i);
      return new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(d);
    });
  }, [i18n.language]);

  return (
    <div>
      <div className="mb-2 grid gap-3 md:grid-cols-7">
        {weekdayHeaders.map((day) => (
          <div
            className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide rtl:tracking-normal text-slate-500"
            key={day}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {visibleDays.map((day) => {
          const items = hearingsByDay.get(getDayKey(day)) ?? [];
          const isCurrentMonth = day.getMonth() === focusDate.getMonth();
          return (
            <div
              className={`min-h-40 rounded-3xl border p-4 text-start ${isCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-400"}`}
              key={day.toISOString()}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{day.getDate()}</span>
                <span
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 cursor-pointer"
                  onClick={() => onCreate(day)}
                >
                  {items.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {items.slice(0, 3).map((hearing) => (
                  <Link
                    className={`block rounded-2xl border px-3 py-2 text-start text-xs font-semibold ${colorByLawyer.get(hearing.assignedLawyerId ?? "unassigned") ?? hearingPalette[0]}`}
                    key={hearing.id}
                    params={{ hearingId: hearing.id }}
                    to="/app/hearings/$hearingId/edit"
                  >
                    <p>{hearing.caseTitle}</p>
                    <p className="mt-1 opacity-80">{formatDateTime(hearing.sessionDatetime)}</p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekCalendar({
  visibleDays,
  hearingsByDay,
  colorByLawyer,
  onCreate
}: {
  visibleDays: Date[];
  hearingsByDay: Map<string, HearingDto[]>;
  colorByLawyer: Map<string, string>;
  onCreate: (date: Date) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {visibleDays.map((day) => {
        const items = hearingsByDay.get(getDayKey(day)) ?? [];
        return (
          <div className="rounded-3xl border border-slate-200 bg-white p-4" key={day.toISOString()}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500">
                  {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day)}
                </p>
                <p className="font-semibold">{day.getDate()}</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => onCreate(day)}
                type="button"
              >
                +
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {!items.length ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                items.map((hearing) => (
                  <Link
                    className={`block rounded-2xl border px-3 py-3 text-start text-xs font-semibold ${colorByLawyer.get(hearing.assignedLawyerId ?? "unassigned") ?? hearingPalette[0]}`}
                    key={hearing.id}
                    params={{ hearingId: hearing.id }}
                    to="/app/hearings/$hearingId/edit"
                  >
                    <p>{hearing.caseTitle}</p>
                    <p className="mt-1 opacity-80">{formatDateTime(hearing.sessionDatetime)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCalendar({
  day,
  hearings,
  colorByLawyer,
  onCreate,
  unassignedLabel
}: {
  day: Date;
  hearings: HearingDto[];
  colorByLawyer: Map<string, string>;
  onCreate: (date: Date) => void;
  unassignedLabel: string;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 11 }, (_, index) => index + 8).map((hour) => {
        const slotItems = hearings.filter(
          (hearing) => new Date(hearing.sessionDatetime).getHours() === hour
        );
        return (
          <div
            className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[110px_1fr]"
            key={hour}
          >
            <button
              className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-start text-sm font-semibold text-slate-600"
              onClick={() => onCreate(day)}
              type="button"
            >
              {`${`${hour}`.padStart(2, "0")}:00`}
            </button>
            {!slotItems.length ? (
              <p className="self-center text-sm text-slate-400">—</p>
            ) : (
              <div className="space-y-2">
                {slotItems.map((hearing) => (
                  <Link
                    className={`block rounded-2xl border px-4 py-3 text-start ${colorByLawyer.get(hearing.assignedLawyerId ?? "unassigned") ?? hearingPalette[0]}`}
                    key={hearing.id}
                    params={{ hearingId: hearing.id }}
                    to="/app/hearings/$hearingId/edit"
                  >
                    <p className="font-semibold">{hearing.caseTitle}</p>
                    <p className="mt-1 text-sm opacity-80">
                      {formatDateTime(hearing.sessionDatetime)}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      {hearing.assignedLawyerName ?? unassignedLabel}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
