import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface BootstrapStatus {
  phase: "starting" | "ready" | "recovering" | "failed";
  message?: string | null;
}

const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";

async function invokeDesktopCommand<T>(command: string): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command);
}

async function quitApp() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export function DesktopBootstrapGate({ children }: PropsWithChildren) {
  const { t } = useTranslation("app");
  const [status, setStatus] = useState<BootstrapStatus>({
    phase: isDesktopShell ? "starting" : "ready",
    message: null
  });
  const pollRef = useRef<number | null>(null);
  const phaseRef = useRef<BootstrapStatus["phase"]>(status.phase);

  useEffect(() => {
    phaseRef.current = status.phase;
  }, [status.phase]);

  useEffect(() => {
    if (!isDesktopShell) {
      return undefined;
    }

    let cancelled = false;

    const poll = async () => {
      let nextPhase = phaseRef.current;

      try {
        const nextStatus = await invokeDesktopCommand<BootstrapStatus>("desktop_bootstrap_status");
        nextPhase = nextStatus.phase;
        if (!cancelled) {
          setStatus(nextStatus);
        }
      } catch {
        nextPhase = "failed";
        if (!cancelled) {
          setStatus({
            phase: "failed",
            message: t("desktopBootstrap.unreachable")
          });
        }
      } finally {
        if (!cancelled) {
          const isTerminal = nextPhase === "ready";
          pollRef.current = window.setTimeout(poll, isTerminal ? 2500 : 750);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollRef.current !== null) {
        window.clearTimeout(pollRef.current);
      }
    };
  }, [t]);

  const failureMessage = status.message ?? "";
  const isRecoverableMigrationFailure =
    status.phase === "failed" &&
    (failureMessage.includes("P3009") || failureMessage.toLowerCase().includes("migration failed"));

  if (!isDesktopShell || status.phase === "ready") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f8edd8,_#f7f3ec_55%,_#ede4d3)] px-6 py-10 text-ink">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <p className="text-sm uppercase tracking-[0.35em] rtl:tracking-normal text-slate-500">
          {t("desktopBootstrap.eyebrow")}
        </p>
        <h1 className="mt-4 font-heading text-3xl">{t(`desktopBootstrap.${status.phase}.title`)}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          {status.message || t(`desktopBootstrap.${status.phase}.description`)}
        </p>
        {status.phase === "failed" ? (
          <div className="mt-6 flex gap-3">
            {isRecoverableMigrationFailure ? (
              <button
                className="rounded-2xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
                onClick={() => {
                  setStatus({
                    phase: "recovering",
                    message: t("desktopBootstrap.repairing")
                  });
                  void invokeDesktopCommand("repair_bootstrap_migrations");
                }}
                type="button"
              >
                {t("desktopBootstrap.repair")}
              </button>
            ) : null}
            <button
              className="rounded-2xl bg-accent px-5 py-3 font-semibold text-white"
              onClick={() => {
                setStatus({
                  phase: "starting",
                  message: t("desktopBootstrap.retrying")
                });
                void invokeDesktopCommand("retry_bootstrap");
              }}
              type="button"
            >
              {t("desktopBootstrap.retry")}
            </button>
            {isRecoverableMigrationFailure ? (
              <button
                className="rounded-2xl border border-rose-300 px-5 py-3 font-semibold text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  const approved = window.confirm(t("desktopBootstrap.resetConfirm"));
                  if (!approved) {
                    return;
                  }

                  setStatus({
                    phase: "recovering",
                    message: t("desktopBootstrap.resetting")
                  });
                  void invokeDesktopCommand("reset_local_database");
                }}
                type="button"
              >
                {t("desktopBootstrap.resetDatabase")}
              </button>
            ) : null}
            <button
              className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => void quitApp()}
              type="button"
            >
              {t("desktopBootstrap.quit")}
            </button>
          </div>
        ) : (
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/3 animate-desktop-bootstrap rounded-full bg-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
