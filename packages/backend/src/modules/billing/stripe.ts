import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  // Keep runtime config minimal so package upgrades do not break typechecking.
});
