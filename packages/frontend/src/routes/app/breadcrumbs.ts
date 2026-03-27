interface BreadcrumbMeta {
  pattern: RegExp;
  labelKey: string;
}

const BREADCRUMB_META: BreadcrumbMeta[] = [
  { pattern: /^\/app\/dashboard$/, labelKey: "nav.dashboard" },
  { pattern: /^\/app\/clients$/, labelKey: "nav.clients" },
  { pattern: /^\/app\/clients\/new$/, labelKey: "actions.newClient" },
  { pattern: /^\/app\/clients\/[^/]+$/, labelKey: "nav.clients" },
  { pattern: /^\/app\/clients\/[^/]+\/edit$/, labelKey: "actions.edit" },
  { pattern: /^\/app\/cases$/, labelKey: "nav.cases" },
  { pattern: /^\/app\/cases\/new$/, labelKey: "actions.newCase" },
  { pattern: /^\/app\/cases\/[^/]+$/, labelKey: "nav.cases" },
  { pattern: /^\/app\/calendar$/, labelKey: "nav.calendar" },
  { pattern: /^\/app\/hearings$/, labelKey: "nav.hearings" },
  { pattern: /^\/app\/hearings\/new$/, labelKey: "actions.newHearing" },
  { pattern: /^\/app\/hearings\/[^/]+\/edit$/, labelKey: "actions.edit" },
  { pattern: /^\/app\/tasks$/, labelKey: "nav.tasks" },
  { pattern: /^\/app\/tasks\/new$/, labelKey: "actions.newTask" },
  { pattern: /^\/app\/tasks\/[^/]+$/, labelKey: "nav.tasks" },
  { pattern: /^\/app\/documents$/, labelKey: "nav.documents" },
  { pattern: /^\/app\/documents\/new$/, labelKey: "actions.uploadNew" },
  { pattern: /^\/app\/invoices$/, labelKey: "nav.invoices" },
  { pattern: /^\/app\/invoices\/new$/, labelKey: "actions.newInvoice" },
  { pattern: /^\/app\/invoices\/[^/]+$/, labelKey: "billing.invoice" },
  { pattern: /^\/app\/expenses$/, labelKey: "nav.expenses" },
  { pattern: /^\/app\/reports$/, labelKey: "nav.reports" },
  { pattern: /^\/app\/reports\/builder$/, labelKey: "reports.builderTitle" },
  { pattern: /^\/app\/integrations\/ppo$/, labelKey: "nav.ppoPortal" },
  { pattern: /^\/app\/templates$/, labelKey: "nav.templates" },
  { pattern: /^\/app\/templates\/new$/, labelKey: "actions.create" },
  { pattern: /^\/app\/templates\/[^/]+\/edit$/, labelKey: "actions.edit" },
  { pattern: /^\/app\/users$/, labelKey: "nav.users" },
  { pattern: /^\/app\/users\/new$/, labelKey: "actions.newUser" },
  { pattern: /^\/app\/users\/[^/]+$/, labelKey: "nav.users" },
  { pattern: /^\/app\/settings$/, labelKey: "nav.settings" },
  { pattern: /^\/app\/settings\/lookups$/, labelKey: "lookups.title" },
  { pattern: /^\/app\/settings\/lookups\/[^/]+$/, labelKey: "lookups.manageValues" },
  { pattern: /^\/app\/settings\/roles$/, labelKey: "roles.title" },
  { pattern: /^\/app\/settings\/roles\/new$/, labelKey: "roles.createRole" },
  { pattern: /^\/app\/settings\/roles\/[^/]+\/edit$/, labelKey: "roles.editRole" },
  { pattern: /^\/app\/settings\/notifications$/, labelKey: "notifications.preferences" },
  { pattern: /^\/app\/notifications$/, labelKey: "notifications.title" },
  { pattern: /^\/app\/search$/, labelKey: "search.title" },
  { pattern: /^\/app\/library$/, labelKey: "nav.library" },
  { pattern: /^\/app\/library\/search$/, labelKey: "library.searchTitle" },
  { pattern: /^\/app\/library\/admin$/, labelKey: "library.adminTitle" },
  { pattern: /^\/app\/library\/upload$/, labelKey: "actions.uploadDocument" },
  { pattern: /^\/app\/library\/documents\/[^/]+$/, labelKey: "library.title" }
];

export function resolveBreadcrumbLabelKey(pathname: string): string | null {
  const match = BREADCRUMB_META.find((entry) => entry.pattern.test(pathname));
  return match?.labelKey ?? null;
}
