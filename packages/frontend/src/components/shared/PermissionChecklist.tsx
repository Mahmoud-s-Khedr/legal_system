import { useTranslation } from "react-i18next";

const ALL_PERMISSIONS = [
  "firms:read",
  "settings:read",
  "settings:update",
  "users:create",
  "users:read",
  "users:update",
  "users:delete",
  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",
  "invitations:create",
  "invitations:read",
  "invitations:revoke",
  "cases:create",
  "cases:read",
  "cases:update",
  "cases:assign",
  "cases:status",
  "cases:delete",
  "clients:create",
  "clients:read",
  "clients:update",
  "clients:delete",
  "hearings:create",
  "hearings:read",
  "hearings:update",
  "hearings:delete",
  "tasks:create",
  "tasks:read",
  "tasks:update",
  "tasks:delete",
  "dashboard:read",
  "documents:create",
  "documents:read",
  "documents:update",
  "documents:delete",
  "reports:read",
  "research:use",
  "lookups:read",
  "lookups:manage"
];

function groupPermissions(permissions: string[]): Record<string, string[]> {
  return permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const resource = perm.split(":")[0] ?? perm;
    (acc[resource] ??= []).push(perm);
    return acc;
  }, {});
}

interface PermissionChecklistProps {
  selected: string[];
  onChange: (permissions: string[]) => void;
}

export function PermissionChecklist({ selected, onChange }: PermissionChecklistProps) {
  const { t } = useTranslation("app");
  const grouped = groupPermissions(ALL_PERMISSIONS);
  const selectedSet = new Set(selected);

  function toggle(perm: string) {
    if (selectedSet.has(perm)) {
      onChange(selected.filter((p) => p !== perm));
    } else {
      onChange([...selected, perm]);
    }
  }

  function toggleGroup(resource: string, perms: string[]) {
    const allSelected = perms.every((p) => selectedSet.has(p));
    if (allSelected) {
      onChange(selected.filter((p) => !perms.includes(p)));
    } else {
      const newPerms = new Set([...selected, ...perms]);
      onChange([...newPerms]);
    }
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([resource, perms]) => {
        const allSelected = perms.every((p) => selectedSet.has(p));
        return (
          <div key={resource}>
            <div className="mb-2 flex items-center gap-2">
              <input
                checked={allSelected}
                className="rounded"
                id={`group-${resource}`}
                onChange={() => toggleGroup(resource, perms)}
                type="checkbox"
              />
              <label
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 rtl:tracking-normal cursor-pointer"
                htmlFor={`group-${resource}`}
              >
                {t(`permissions.resources.${resource}`, resource)}
              </label>
            </div>
            <div className="ms-5 flex flex-wrap gap-3">
              {perms.map((perm) => {
                const action = perm.split(":")[1] ?? perm;
                return (
                  <label className="flex items-center gap-1.5 cursor-pointer" key={perm}>
                    <input
                      checked={selectedSet.has(perm)}
                      className="rounded"
                      onChange={() => toggle(perm)}
                      type="checkbox"
                    />
                    <span className="text-sm text-slate-700">{t(`permissions.actions.${action}`, action)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
