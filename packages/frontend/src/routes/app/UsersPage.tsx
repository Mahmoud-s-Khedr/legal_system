import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthMode, UserStatus, type UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
import { useAuthBootstrap } from "../../store/authStore";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SectionCard,
  SelectField,
  SortableTableHeadCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableToolbar,
  TableWrapper
} from "./ui";

export function UsersPage() {
  const { t } = useTranslation("app");
  const { mode, user } = useAuthBootstrap();
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const usersQuery = useQuery({
    queryKey: ["users", table.state],
    queryFn: () =>
      apiFetch<UserListResponseDto>(`/api/users?${table.toApiQueryString()}`)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("users.eyebrow")}
        title={t("users.title")}
        description={t("users.description")}
        actions={
          mode === AuthMode.LOCAL &&
          user?.permissions.includes("users:create") ? (
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              to="/app/users/new"
            >
              {t("actions.newUser")}
            </Link>
          ) : undefined
        }
      />
      <SectionCard
        title={t("users.directory")}
        description={t("users.directoryHelp")}
      >
        <TableToolbar>
          <Field
            label={t("labels.search")}
            onChange={table.setQ}
            placeholder={t("users.searchPlaceholder")}
            value={table.state.q}
          />
          <SelectField
            label={t("labels.status")}
            value={table.state.filters.status ?? ""}
            onChange={(value) => table.setFilter("status", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(UserStatus).map((value) => ({
                value,
                label: getEnumLabel(t, "UserStatus", value)
              }))
            ]}
          />
        </TableToolbar>
        {usersQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : usersQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (usersQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void usersQuery.refetch()}
          />
        ) : !usersQuery.data?.items.length ? (
          <EmptyState
            title={t("empty.noUsers")}
            description={t("empty.noUsersHelp")}
          />
        ) : (
          <>
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <SortableTableHeadCell
                      label={t("labels.fullName")}
                      sortKey="fullName"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <SortableTableHeadCell
                      label={t("labels.email")}
                      sortKey="email"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell>{t("labels.role")}</TableHeadCell>
                    <SortableTableHeadCell
                      label={t("labels.status")}
                      sortKey="status"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell align="end">
                      {t("actions.more")}
                    </TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {usersQuery.data.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {getEnumLabel(t, "UserRole", user.roleKey)}
                      </TableCell>
                      <TableCell>
                        {getEnumLabel(t, "UserStatus", user.status)}
                      </TableCell>
                      <TableCell align="end">
                        <Link
                          className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          params={{ userId: user.id }}
                          to="/app/users/$userId"
                        >
                          {t("users.manageUser")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={usersQuery.data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
