import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";

export function AcceptInvitePage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { acceptInvite } = useAuthBootstrap();
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? "";
  });
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await acceptInvite({ token, fullName, password });
      await navigate({ to: "/app/dashboard" });
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  }

  return (
    <AuthShell subtitle={t("inviteSubtitle")} title={t("inviteTitle")}>
      <form className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl" onSubmit={handleSubmit}>
        <Field label={t("inviteToken")} value={token} onChange={setToken} />
        <Field label={t("fullName")} value={fullName} onChange={setFullName} />
        <Field label={t("password")} type="password" value={password} onChange={setPassword} />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white" type="submit">
          {t("acceptInvite")}
        </button>
      </form>
    </AuthShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}<span className="text-red-500 ms-1" aria-hidden="true">*</span></label>
      <input
        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}
