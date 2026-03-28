# ELMS — Feature Matrix (Code-Truth)

## Backend domain modules

| Domain | Implemented module path |
|---|---|
| Auth | `modules/auth` |
| Firms | `modules/firms` |
| Roles | `modules/roles` |
| Users | `modules/users` |
| Invitations | `modules/invitations` |
| Clients | `modules/clients` |
| Cases | `modules/cases` |
| Hearings | `modules/hearings` |
| Tasks | `modules/tasks` |
| Dashboard | `modules/dashboard` |
| Documents + Search | `modules/documents` |
| Lookups | `modules/lookups` |
| Billing | `modules/billing` |
| Notifications | `modules/notifications` |
| Templates | `modules/templates` |
| Reports | `modules/reports` |
| Library | `modules/library` |
| Research | `modules/research` |
| Import | `modules/import` |
| Portal | `modules/portal` |
| Integrations | `modules/integrations` |
| Powers | `modules/powers` |

## Frontend route coverage

Primary app routes exist for: dashboard, clients, cases, calendar/hearings, tasks, users, settings, documents, search, invoices/expenses, notifications, reports, library, import, templates, and portal routes.

## Source of truth

- `packages/backend/src/app.ts`
- `packages/backend/src/modules/**`
- `packages/frontend/src/router.tsx`
