import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthMode, type UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper } from "./ui";

export function UsersPage() {
  const { t } = useTranslation("app");
  const { mode } = useAuthBootstrap();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("users.eyebrow")}
        title={t("users.title")}
        description={t("users.description")}
        actions={
          mode === AuthMode.LOCAL ? (
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              to="/app/users/new"
            >
              {t("actions.newUser")}
            </Link>
          ) : undefined
        }
      />
      <SectionCard title={t("users.directory")} description={t("users.directoryHelp")}>
        {usersQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(usersQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void usersQuery.refetch()}
          />
        ) : !usersQuery.data?.items.length ? (
          <EmptyState title={t("empty.noUsers")} description={t("empty.noUsersHelp")} />
        ) : (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("labels.fullName")}</TableHeadCell>
                  <TableHeadCell>{t("labels.email")}</TableHeadCell>
                  <TableHeadCell>{t("labels.role")}</TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {usersQuery.data.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getEnumLabel(t, "UserRole", user.roleKey)}</TableCell>
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
        )}
      </SectionCard>
    </div>
  );
}
