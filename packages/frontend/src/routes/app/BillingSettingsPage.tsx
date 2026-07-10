import { apiFetch } from "../../lib/api";

const billingMode = (import.meta.env.VITE_SAAS_BILLING_MODE as string | undefined)?.trim() || "manual";
const supportEmail =
  (import.meta.env.VITE_FOOTER_EMAIL as string | undefined)?.trim() || "support@elms.app";

export function BillingSettingsPage() {
  const checkoutMutation = async () => {
    const data = await apiFetch<{ url?: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ priceId: "price_dummy" })
    });
    if (data.url) {
      window.location.href = data.url;
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 font-heading text-3xl font-semibold">Billing & Plan</h1>
      
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-medium">Hosted Billing</h2>
        {billingMode === "stripe" ? (
          <p className="mb-6 text-slate-600">
            You are currently on the <strong>30-Day Free Trial</strong>. Upgrade to a paid plan to ensure uninterrupted access.
          </p>
        ) : (
          <p className="mb-6 text-slate-600">
            This hosted beta uses <strong>manual billing</strong>. Contact support to confirm your firm plan, trial extension, or invoice status.
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="mb-2 text-lg font-bold">Standard Plan</h3>
            <p className="mb-4 text-sm text-slate-500">Perfect for small law firms running the hosted beta.</p>
            <p className="mb-6 text-2xl font-bold">EGP 500<span className="text-sm font-normal text-slate-500">/mo</span></p>
            {billingMode === "stripe" ? (
              <button
                onClick={() => checkoutMutation()}
                className="w-full rounded-lg bg-accent px-4 py-2 font-semibold text-white transition-colors hover:bg-accent/90"
              >
                Subscribe Now
              </button>
            ) : (
              <a
                href={`mailto:${supportEmail}?subject=ELMS%20Hosted%20Beta%20Billing`}
                className="block w-full rounded-lg bg-accent px-4 py-2 text-center font-semibold text-white transition-colors hover:bg-accent/90"
              >
                Contact Billing
              </a>
            )}
          </div>
          
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="mb-2 text-lg font-bold">Enterprise Plan</h3>
            <p className="mb-4 text-sm text-slate-500">For large firms with advanced needs.</p>
            <p className="mb-6 text-2xl font-bold">Custom</p>
            <a href={`mailto:${supportEmail}`} className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center font-semibold transition-colors hover:bg-slate-50">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
