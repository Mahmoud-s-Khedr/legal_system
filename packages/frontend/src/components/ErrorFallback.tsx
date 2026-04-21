export function ErrorFallback({ error }: { error: Error }) {
  // We do NOT use useTranslation here, because if the app crashes during early
  // bootstrap (before the i18n provider is initialized), this component itself
  // would throw an exception, resulting in a completely silent blank white screen.

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const isAppRoute = pathname.startsWith("/app");
  const isPortalRoute = pathname.startsWith("/portal");
  const safeHref = isAppRoute
    ? "/app/dashboard"
    : isPortalRoute
      ? "/portal/dashboard"
      : "/login";
  const safeLabel = isAppRoute
    ? "Go to Dashboard / اذهب إلى لوحة التحكم"
    : isPortalRoute
      ? "Go to Portal Home / اذهب إلى بوابة العملاء"
      : "Go to Login / اذهب إلى تسجيل الدخول";
  const pageDir =
    typeof document !== "undefined" && document.documentElement.dir === "rtl"
      ? "rtl"
      : "ltr";

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center animate-fade-in bg-sand text-ink"
      dir={pageDir}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-2">
        <span className="text-2xl">⚠</span>
      </div>
      <h1 className="font-heading text-2xl font-semibold text-red-600">
        Application Error / خطأ في التطبيق
      </h1>
      <p className="max-w-md text-sm text-slate-600 my-2">
        {error?.message ??
          "An unexpected error occurred while starting the application."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <a
          className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
          href={safeHref}
        >
          {safeLabel}
        </a>
        <button
          className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload Application / إعادة تحميل
        </button>
      </div>
    </div>
  );
}
