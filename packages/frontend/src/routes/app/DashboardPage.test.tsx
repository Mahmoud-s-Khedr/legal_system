import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const authBootstrapMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args)
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to
  }: {
    children: JSX.Element | JSX.Element[] | string;
    to: string;
  }) => <a href={to}>{children}</a>
}));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key
    })
  };
});

vi.mock("../../store/authStore", () => ({
  useAuthBootstrap: () => authBootstrapMock()
}));

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

vi.mock("../../components/shared/Skeleton", () => ({
  StatCardSkeleton: () => <div>stat-skeleton</div>,
  SectionCardSkeleton: () => <div>section-skeleton</div>
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  LineChart: ({ children }: { children: JSX.Element[] | JSX.Element }) => <div>{children}</div>,
  BarChart: ({ children }: { children: JSX.Element[] | JSX.Element }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: ({ name }: { name: string }) => <span>{name}</span>,
  Bar: ({ name }: { name: string }) => <span>{name}</span>
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: JSX.Element }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
  SectionCard: ({
    title,
    description,
    children
  }: {
    title: string;
    description?: string;
    children: JSX.Element;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  formatDateTime: (value: string) => value,
  formatCurrency: (value: number) => `$${value.toFixed(2)}`
}));

const { DashboardPage } = await import("./DashboardPage");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

beforeEach(() => {
  vi.clearAllMocks();
  authBootstrapMock.mockReturnValue({ user: { fullName: "Desktop Admin" } });
  queryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "dashboard") {
      return {
        isLoading: false,
        isError: false,
        data: {
          roleLabel: "Firm Admin",
          priorityCards: [
            { key: "dueToday", value: 2, href: "/app/tasks?open=true&from=2026-05-13T00%3A00%3A00.000Z" },
            { key: "overdue", value: 1, href: "/app/tasks?overdue=true" },
            { key: "hearings7d", value: 3, href: "/app/hearings?from=2026-05-13T00%3A00%3A00.000Z" },
            { key: "unassigned", value: 4, href: "/app/tasks?assignedToId=unassigned&open=true" }
          ],
          upcomingTasks: [
            {
              id: "t-1",
              type: "task",
              title: "Draft motion",
              subtitle: "Case A",
              dueAt: "2026-05-14T09:00:00.000Z",
              href: "/app/tasks/t-1",
              priority: "high"
            }
          ],
          upcomingSessions: [
            {
              id: "h-1",
              type: "hearing",
              title: "Case B",
              subtitle: "Hearing",
              dueAt: "2026-05-15T09:00:00.000Z",
              href: "/app/hearings/h-1/edit",
              priority: "high"
            }
          ],
          recentActivity: [{ id: "a-1", title: "tasks update", subtitle: "Task", createdAt: "2026-05-13T08:00:00.000Z" }],
          widgets: [{ key: "analytics", title: "Analytics", description: "Allowed widget" }]
        },
        error: null,
        refetch: vi.fn()
      };
    }

    return {
      isLoading: false,
      isError: false,
      data: {
        charts: [
          {
            key: "financeTrend",
            series: [{ key: "revenue" }, { key: "profit" }, { key: "expenses" }],
            points: [{ label: "2026-05", values: { revenue: 1200, profit: 750, expenses: 450 } }],
            redacted: false,
            valueFormat: "currency"
          }
        ]
      },
      error: null,
      refetch: vi.fn()
    };
  });
});

describe("DashboardPage", () => {
  it("renders KPI card links, separate upcoming sections, and finance series columns", () => {
    const view = render(<DashboardPage />);

    expect(view.textContent).toContain("dashboard.analytics.sections.upcomingTasks.title");
    expect(view.textContent).toContain("dashboard.analytics.sections.upcomingSessions.title");
    expect(view.textContent).toContain("dashboard.analytics.series.financeTrend.revenue");
    expect(view.textContent).toContain("dashboard.analytics.series.financeTrend.profit");
    expect(view.textContent).toContain("dashboard.analytics.series.financeTrend.expenses");
    expect(view.textContent).not.toContain("dashboard.analytics.sections.activity.title");
    expect(view.textContent).not.toContain("dashboard.analytics.sections.widgets.title");

    const links = Array.from(view.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(links).toContain("/app/tasks?overdue=true");
    expect(links).toContain("/app/tasks?assignedToId=unassigned&open=true");
    expect(links).toContain("/app/hearings/h-1/edit");
  });
});
