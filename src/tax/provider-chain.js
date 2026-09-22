import { JurisdictionRulesTaxProvider } from "./jurisdiction-rules.js";
import { StripeTaxProvider } from "./stripe-tax.js";

export function createTaxProviders(env = process.env) {
  const providers = [];
  if (env.STRIPE_SECRET_KEY) {
    providers.push(new StripeTaxProvider({ secretKey: env.STRIPE_SECRET_KEY }));
  }
  providers.push(new JurisdictionRulesTaxProvider());
  return providers;
}
