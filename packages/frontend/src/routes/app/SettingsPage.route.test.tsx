import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditionKey, Language } from "@elms/shared";

const {
  queryMock,
  addToastMock,
  mutationMocks,
  authBootstrapMock,
  desktopDownloadData,
  desktopBackupData
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  addToastMock: vi.fn(),
  mutationMocks: [] as Array<{
    mutate: ReturnType<typeof vi.fn>;
    mutateAsync: ReturnType<typeof vi.fn>;
  }>,
  authBootstrapMock: vi.fn(),
  desktopDownloadData: { effectivePath: "/tmp/downloads" },
  desktopBackupData: {
    policy: {
      enabled: true,
      frequency: "daily" as const,
      timeLocal: "02:00",
      weeklyDay: null,
      retentionCount: 14
    },
    effectiveBackupDirectory: "/tmp/backups",
    backups: [{ path: "/tmp/backups/a.zip", name: "A.zip" }],
    lastBackupAt: null,
    lastBackupResult: null,
    nextScheduledBackupAt: null
  }
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to
  }: {
    children: JSX.Element | string;
    to: string;
  }) => <a href={to}>{children}</a>
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args),
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  }),
  useMutation: (options: {
    mutationFn: (variables: unknown) => Promise<unknown> | unknown;
    onSuccess?: (data: unknown) => Promise<void> | void;
    onError?: (error: unknown) => Promise<void> | void;
  }) => {
    const mutateAsync = vi.fn(async (variables: unknown) => {
      try {
        const data = await options.mutationFn(variables);
        await options.onSuccess?.(data);
        return data;
      } catch (error) {
        await options.onError?.(error);
        throw error;
      }
    });
    const mutate = vi.fn((variables: unknown) => {
      void mutateAsync(variables);
    });
    const entry = {
      mutate,
      mutateAsync
    };
    mutationMocks.push(entry);
    return {
      ...entry,
      isPending: false,
      error: null
    };
  }
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

vi.mock("../../store/toastStore", () => ({
  useToastStore: (selector: (state: { addToast: typeof addToastMock }) => unknown) =>
    selector({ addToast: addToastMock })
}));

vi.mock("../../lib/enumLabel", () => ({
  getEnumLabel: (_t: unknown, _type: string, value: string) => value
}));

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

vi.mock("../../lib/desktopDownloads", () => ({
  chooseDesktopDownloadDirectory: vi.fn(async () => desktopDownloadData),
  getDesktopDownloadSettings: vi.fn(async () => ({
    effectivePath: "/tmp/downloads"
  })),
  isDesktopDownloadsEnabled: vi.fn(() => true),
  resetDesktopDownloadDirectory: vi.fn(async () => desktopDownloadData)
}));

vi.mock("../../lib/desktopBackup", () => ({
  chooseDesktopBackupDirectory: vi.fn(async () => desktopBackupData),
  getDesktopBackupPolicy: vi.fn(async () => ({
    policy: {
      enabled: true,
      frequency: "daily",
      timeLocal: "02:00",
      weeklyDay: null,
      retentionCount: 14
    },
    effectiveBackupDirectory: "/tmp/backups",
    backups: [{ path: "/tmp/backups/a.zip", name: "A.zip" }],
    lastBackupAt: null,
    lastBackupResult: null,
    nextScheduledBackupAt: null
  })),
  isDesktopBackupEnabled: vi.fn(() => true),
  resetDesktopBackupDirectory: vi.fn(async () => desktopBackupData),
  restoreDesktopBackup: vi.fn(async () => ({
    ok: true,
    message: "Restore started. Desktop services are restarting.",
    backupPath: null
  })),
  runDesktopBackupNow: vi.fn(async () => ({
    ok: true,
    message: "Backup completed",
    backupPath: "/tmp/backups/new.zip"
  })),
  setDesktopBackupPolicy: vi.fn(async () => desktopBackupData),
  validateBackupTimeLocal: vi.fn(() => true),
  canSubmitRestoreAcknowledgement: (a: boolean, b: boolean) => a && b
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
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
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div>
      {title}:{description}
    </div>
  ),
  Badge: ({ children }: { children: string }) => <span>{children}</span>,
  PrimaryButton: ({
    children,
    type = "button"
  }: {
    children: string;
    type?: "button" | "submit";
  }) => <button type={type}>{children}</button>,
  Field: ({
    id,
    label,
    value,
    onChange,
    type = "text",
    dir
  }: {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    dir?: string;
  }) => (
    <label>
      {label}
      <input
        id={id}
        aria-label={label}
        dir={dir}
        value={value}
        type={type}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
  SelectField: ({
    id,
    label,
    value,
    onChange,
    options
  }: {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <label>
      {label}
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  formatDate: (value: string) => value
}));

const { SettingsPage } = await import("./SettingsPage");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const baseUser = {
  id: "user-1",
  fullName: "User One",
  email: "user@example.com",
  roleKey: "ADMIN",
  preferredLanguage: Language.AR,
  permissions: ["settings:update", "lookups:manage", "roles:read", "cases:read"]
};

const baseFirm = {
  firm: {
    id: "firm-1",
    name: "Firm A",
    slug: "firm-a",
    type: "LAW_FIRM",
    defaultLanguage: Language.AR,
    editionKey: EditionKey.SOLO_OFFLINE,
    pendingEditionKey: null,
    trialEnabled: true,
    trialEndsAt: "2026-05-01T00:00:00.000Z",
    licenseRequired: false,
    isLicensed: false
  }
};

const selfData = {
  id: "user-1",
  roleId: "role-1",
  status: "ACTIVE",
  fullName: "User One",
  email: "user@example.com",
  preferredLanguage: Language.AR
};

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

function unmountCurrent() {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMocks.length = 0;
  authBootstrapMock.mockReturnValue({
    user: baseUser,
    refreshSession: vi.fn(async () => undefined)
  });
  queryMock.mockImplementation((input: { queryKey: string[] }) => {
    const key = input.queryKey[0];
    if (key === "firm-me") return { data: baseFirm };
    if (key === "user") return { data: selfData };
    if (key === "desktop-download-settings") return { data: desktopDownloadData };
    if (key === "desktop-backup-policy") return { data: desktopBackupData };
    return { data: null };
  });
});

afterEach(() => {
  unmountCurrent();
});

describe("SettingsPage route behavior", () => {
  it("shows empty state when session or firm is missing", () => {
    authBootstrapMock.mockReturnValue({
      user: null,
      refreshSession: vi.fn(async () => undefined)
    });
    queryMock.mockReturnValue({ data: null });

    const view = render(<SettingsPage />);
    expect(view.textContent).toContain("empty.noSettings");
  });

  it("renders settings sections and triggers key submit/click handlers", async () => {
    const view = render(<SettingsPage />);

    expect(view.textContent).toContain("settings.title");
    expect(view.textContent).toContain("settings.licensingTitle");
    expect(view.textContent).toContain("settings.backupTitle");
    expect(view.textContent).toContain("settings.profileTitle");
    expect(view.textContent).toContain("settings.passwordTitle");

    const activationInput = view.querySelector(
      "input#activation-key"
    ) as HTMLInputElement | null;
    act(() => {
      if (activationInput) {
        activationInput.value = "ABC-123";
        activationInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const forms = view.querySelectorAll("form");
    expect(forms.length).toBeGreaterThanOrEqual(4);
    act(() => {
      forms[0]?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      forms[1]?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      forms[2]?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      forms[3]?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    const backupAcks = view.querySelectorAll('input[type="checkbox"]');
    act(() => {
      backupAcks[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      backupAcks[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const actionButtons = Array.from(view.querySelectorAll("button")).filter(
      (button) =>
        [
          "settings.chooseDownloadFolder",
          "settings.resetDownloadFolder",
          "settings.chooseBackupFolder",
          "settings.resetBackupFolder",
          "settings.saveBackupPolicy",
          "settings.runBackupNow",
          "settings.restoreNow"
        ].includes(button.textContent ?? "")
    );

    act(() => {
      actionButtons.forEach((button) => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });
    await flush();

    expect(mutationMocks.length).toBeGreaterThanOrEqual(11);
    const mutateCalls = mutationMocks.flatMap((mutation) => mutation.mutate.mock.calls);
    const mutateAsyncCalls = mutationMocks.flatMap(
      (mutation) => mutation.mutateAsync.mock.calls
    );

    expect(mutateCalls.length).toBeGreaterThanOrEqual(3);
    expect(mutateCalls).toContainEqual([
      { editionKey: EditionKey.SOLO_OFFLINE }
    ]);
    expect(mutateAsyncCalls.length).toBeGreaterThanOrEqual(6);
    expect(mutateAsyncCalls).toContainEqual(["/tmp/backups/a.zip"]);
    expect(addToastMock).toHaveBeenCalledWith(
      "settings.downloadFolderUpdatedTo",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "settings.downloadFolderResetTo",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "settings.backupFolderUpdatedTo",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "settings.backupFolderResetTo",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "settings.backupPolicySaved",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "Backup completed messages.fileSavedTo",
      "success"
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "Restore started. Desktop services are restarting.",
      "success"
    );
  });
});
