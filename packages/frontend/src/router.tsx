import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LoginPage } from "./routes/auth/LoginPage";
import { BackendConnectionPage } from "./routes/auth/BackendConnectionPage";
import { SetupPage } from "./routes/auth/SetupPage";
import { AboutPage } from "./routes/public/AboutPage";
import { DashboardPage } from "./routes/app/DashboardPage";
import { AppLayout } from "./routes/app/AppLayout";
import { ClientsPage } from "./routes/app/ClientsPage";
import { ClientCreatePage } from "./routes/app/ClientCreatePage";
import { ClientDetailPage } from "./routes/app/ClientDetailPage";
import { ClientEditPage } from "./routes/app/ClientEditPage";
import { CasesPage } from "./routes/app/CasesPage";
import { CaseCreatePage } from "./routes/app/CaseCreatePage";
import { CaseQuickIntakePage } from "./routes/app/CaseQuickIntakePage";
import { CaseDetailPage } from "./routes/app/CaseDetailPage";
import { HearingsPage } from "./routes/app/HearingsPage";
import { CalendarPage } from "./routes/app/CalendarPage";
import { HearingCreatePage } from "./routes/app/HearingCreatePage";
import { HearingEditPage } from "./routes/app/HearingEditPage";
import { TasksPage } from "./routes/app/TasksPage";
import { TaskCreatePage } from "./routes/app/TaskCreatePage";
import { TaskDetailPage } from "./routes/app/TaskDetailPage";
import { UsersPage } from "./routes/app/UsersPage";
import { UserCreatePage } from "./routes/app/UserCreatePage";
import { UserDetailPage } from "./routes/app/UserDetailPage";
import { InvitationsPage } from "./routes/app/InvitationsPage";
import { InvitationCreatePage } from "./routes/app/InvitationCreatePage";
import { SettingsPage } from "./routes/app/SettingsPage";
import { LookupSettingsPage } from "./routes/app/LookupSettingsPage";
import { LookupSettingsDetailPage } from "./routes/app/LookupSettingsDetailPage";
import { RoleSettingsPage } from "./routes/app/RoleSettingsPage";
import { RoleCreatePage } from "./routes/app/RoleCreatePage";
import { RoleEditPage } from "./routes/app/RoleEditPage";
import { DocumentsPage } from "./routes/app/DocumentsPage";
import { DocumentUploadPage } from "./routes/app/DocumentUploadPage";
import { SearchPage } from "./routes/app/SearchPage";
import { InvoicesPage } from "./routes/app/InvoicesPage";
import { InvoiceCreatePage } from "./routes/app/InvoiceCreatePage";
import { InvoiceDetailPage } from "./routes/app/InvoiceDetailPage";
import { ExpensesPage } from "./routes/app/ExpensesPage";
import { NotificationsPage } from "./routes/app/NotificationsPage";
import { NotificationPreferencesPage } from "./routes/app/NotificationPreferencesPage";
import { TemplatesPage } from "./routes/app/TemplatesPage";
import { TemplateCreatePage } from "./routes/app/TemplateCreatePage";
import { TemplateEditPage } from "./routes/app/TemplateEditPage";
import { ReportsPage } from "./routes/app/ReportsPage";
import { ReportBuilderPage } from "./routes/app/ReportBuilderPage";
import { PpoPortalPage } from "./routes/app/PpoPortalPage";
import { ResearchPage } from "./routes/app/research/ResearchPage";
import { ResearchSessionPage } from "./routes/app/research/ResearchSessionPage";
import { LibraryPage } from "./routes/app/library/LibraryPage";
import { LibraryDocumentPage } from "./routes/app/library/LibraryDocumentPage";
import { LibrarySearchPage } from "./routes/app/library/LibrarySearchPage";
import { LibraryAdminPage } from "./routes/app/library/LibraryAdminPage";
import { LibraryUploadPage } from "./routes/app/library/LibraryUploadPage";
import { ImportPage } from "./routes/app/ImportPage";
import { PortalLayout } from "./routes/portal/PortalLayout";
import { PortalLoginPage } from "./routes/portal/PortalLoginPage";
import { PortalDashboardPage } from "./routes/portal/PortalDashboardPage";
import { PortalCasePage } from "./routes/portal/PortalCasePage";
import { useAuthBootstrap } from "./store/authStore";
import { ErrorFallback } from "./components/ErrorFallback";
import { PermissionGate } from "./components/PermissionGate";

function RootComponent() {
  return <Outlet />;
}

function ProtectedRoute() {
  const { t } = useTranslation("app");
  const { user, isBootstrapped, bootstrap } = useAuthBootstrap();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isBootstrapped && !user) {
      void navigate({ to: "/login" });
    }
  }, [isBootstrapped, navigate, user]);

  if (!isBootstrapped) {
    return <div className="p-8 text-center text-ink">{t("labels.loading")}</div>;
  }

  if (!user) {
    return null;
  }

  return <AppLayout />;
}

function LandingRedirect() {
  const { t } = useTranslation("app");
  const { user, needsSetup, isBootstrapped, bootstrap } = useAuthBootstrap();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isBootstrapped) {
      if (user) {
        void navigate({ to: "/app/dashboard" });
      } else if (needsSetup) {
        void navigate({ to: "/setup" });
      } else {
        void navigate({ to: "/login" });
      }
    }
  }, [isBootstrapped, navigate, needsSetup, user]);

  if (!isBootstrapped) {
    return <div className="p-8 text-center text-ink">{t("labels.loading")}</div>;
  }

  return null;
}

const rootRoute = createRootRoute({
  component: RootComponent,
  errorComponent: ({ error }) => <ErrorFallback error={error as Error} />
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingRedirect
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});

const backendConnectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connection",
  component: BackendConnectionPage
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: AboutPage
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: ProtectedRoute
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/dashboard",
  component: DashboardPage
});

// Clients
const clientsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients",
  component: ClientsPage
});

const clientCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients/new",
  component: ClientCreatePage
});

const clientDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients/$clientId",
  component: ClientDetailPage
});

const clientEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/clients/$clientId/edit",
  component: ClientEditPage
});

// Cases
const casesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/cases",
  component: CasesPage
});

const caseCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/cases/new",
  component: CaseCreatePage
});

const caseQuickIntakeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/cases/quick-new",
  component: CaseQuickIntakePage
});

const caseDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/cases/$caseId",
  component: CaseDetailPage
});

// Hearings
const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/calendar",
  component: CalendarPage
});

const hearingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/hearings",
  component: HearingsPage
});

const hearingCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/hearings/new",
  component: HearingCreatePage
});

const hearingEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/hearings/$hearingId/edit",
  component: HearingEditPage
});

// Tasks
const tasksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/tasks",
  component: TasksPage
});

const taskCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/tasks/new",
  component: TaskCreatePage
});

const taskDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/tasks/$taskId",
  component: TaskDetailPage
});

// Users — requires users:read permission
const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/users",
  component: () => <PermissionGate permission="users:read"><UsersPage /></PermissionGate>
});

const userCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/users/new",
  component: () => <PermissionGate permission="users:create"><UserCreatePage /></PermissionGate>
});

const userDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/users/$userId",
  component: () => <PermissionGate permission="users:read"><UserDetailPage /></PermissionGate>
});

// Invitations — requires invitations:read permission
const invitationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/invitations",
  component: () => <PermissionGate permission="invitations:read"><InvitationsPage /></PermissionGate>
});

const invitationCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/invitations/new",
  component: () => <PermissionGate permission="invitations:create"><InvitationCreatePage /></PermissionGate>
});

// Settings — requires settings:read permission
const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: () => <PermissionGate permission="settings:read"><SettingsPage /></PermissionGate>
});

const lookupSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/lookups",
  component: () => <PermissionGate permission="lookups:manage"><LookupSettingsPage /></PermissionGate>
});

const lookupSettingsDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/lookups/$entity",
  component: () => <PermissionGate permission="lookups:manage"><LookupSettingsDetailPage /></PermissionGate>
});

const roleSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/roles",
  component: () => <PermissionGate permission="roles:read"><RoleSettingsPage /></PermissionGate>
});

const roleCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/roles/new",
  component: () => <PermissionGate permission="roles:create"><RoleCreatePage /></PermissionGate>
});

const roleEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/roles/$roleId/edit",
  component: () => <PermissionGate permission="roles:update"><RoleEditPage /></PermissionGate>
});

// Documents
const documentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents",
  component: DocumentsPage
});

const documentUploadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents/new",
  component: DocumentUploadPage
});

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/search",
  component: SearchPage
});

// Invoices
const invoicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/invoices",
  component: () => <PermissionGate permission="invoices:read"><InvoicesPage /></PermissionGate>
});

const invoiceCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/invoices/new",
  component: () => <PermissionGate permission="invoices:create"><InvoiceCreatePage /></PermissionGate>
});

const invoiceDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/invoices/$invoiceId",
  component: () => <PermissionGate permission="invoices:read"><InvoiceDetailPage /></PermissionGate>
});

// Expenses
const expensesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/expenses",
  component: () => <PermissionGate permission="expenses:read"><ExpensesPage /></PermissionGate>
});

// Notifications
const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notifications",
  component: NotificationsPage
});

const notificationPreferencesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings/notifications",
  component: NotificationPreferencesPage
});

// Reports
const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  component: () => <PermissionGate permission="reports:read"><ReportsPage /></PermissionGate>
});

const reportBuilderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports/builder",
  component: () => <PermissionGate permission="reports:read"><ReportBuilderPage /></PermissionGate>
});

const ppoPortalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/integrations/ppo",
  component: PpoPortalPage
});

// Research
const researchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/research",
  component: () => <PermissionGate permission="research:use"><ResearchPage /></PermissionGate>
});

const researchSessionRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/research/$sessionId",
  component: () => <PermissionGate permission="research:use"><ResearchSessionPage /></PermissionGate>
});

// Library
const libraryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library",
  component: () => <PermissionGate permission="library:read"><LibraryPage /></PermissionGate>
});

const libraryDocumentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library/documents/$documentId",
  component: () => <PermissionGate permission="library:read"><LibraryDocumentPage /></PermissionGate>
});

const librarySearchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library/search",
  component: () => <PermissionGate permission="library:read"><LibrarySearchPage /></PermissionGate>
});

const libraryAdminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library/admin",
  component: () => <PermissionGate permission="library:manage"><LibraryAdminPage /></PermissionGate>
});

const libraryUploadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library/upload",
  component: () => <PermissionGate permission="library:read"><LibraryUploadPage /></PermissionGate>
});

// Import
const importRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/import",
  component: () => <PermissionGate permission="clients:create"><ImportPage /></PermissionGate>
});

// Templates
const templatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/templates",
  component: () => <PermissionGate permission="templates:read"><TemplatesPage /></PermissionGate>
});

const templateCreateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/templates/new",
  component: () => <PermissionGate permission="templates:create"><TemplateCreatePage /></PermissionGate>
});

const templateEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/templates/$templateId/edit",
  component: () => <PermissionGate permission="templates:read"><TemplateEditPage /></PermissionGate>
});

// Portal routes
const portalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/portal",
  component: PortalLayout
});

const portalLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/portal/$firmId/login",
  component: PortalLoginPage
});

const portalDashboardRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/dashboard",
  component: PortalDashboardPage
});

const portalCaseRoute = createRoute({
  getParentRoute: () => portalRoute,
  path: "/cases/$caseId",
  component: PortalCasePage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  backendConnectionRoute,
  setupRoute,
  aboutRoute,
  portalLoginRoute,
  portalRoute.addChildren([
    portalDashboardRoute,
    portalCaseRoute
  ]),
  appRoute.addChildren([
    dashboardRoute,
    clientsRoute,
    clientCreateRoute,
    clientDetailRoute,
    clientEditRoute,
    casesRoute,
    caseCreateRoute,
    caseQuickIntakeRoute,
    caseDetailRoute,
    calendarRoute,
    hearingsRoute,
    hearingCreateRoute,
    hearingEditRoute,
    tasksRoute,
    taskCreateRoute,
    taskDetailRoute,
    usersRoute,
    userCreateRoute,
    userDetailRoute,
    invitationsRoute,
    invitationCreateRoute,
    settingsRoute,
    lookupSettingsRoute,
    lookupSettingsDetailRoute,
    roleSettingsRoute,
    roleCreateRoute,
    roleEditRoute,
    documentsRoute,
    documentUploadRoute,
    searchRoute,
    invoicesRoute,
    invoiceCreateRoute,
    invoiceDetailRoute,
    expensesRoute,
    notificationsRoute,
    notificationPreferencesRoute,
    reportsRoute,
    reportBuilderRoute,
    ppoPortalRoute,
    researchRoute,
    researchSessionRoute,
    libraryRoute,
    libraryDocumentRoute,
    librarySearchRoute,
    libraryAdminRoute,
    libraryUploadRoute,
    importRoute,
    templatesRoute,
    templateCreateRoute,
    templateEditRoute
  ])
]);

export const router = createRouter({
  routeTree
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
