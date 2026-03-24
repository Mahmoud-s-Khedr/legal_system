import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthMode, type UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import { EmptyState, PageHeader, SectionCard } from "./ui";

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
        {!usersQuery.data?.items.length ? (
          <EmptyState title={t("empty.noUsers")} description={t("empty.noUsersHelp")} />
        ) : (
          <div className="space-y-3">
            {usersQuery.data.items.map((user) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4" key={user.id}>
                <p className="font-semibold">{user.fullName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {user.email} · {getEnumLabel(t, "UserRole", user.roleKey)}
                </p>
                <div className="mt-3">
                  <Link
                    className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                    params={{ userId: user.id }}
                    to="/app/users/$userId"
                  >
                    {t("users.manageUser")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
