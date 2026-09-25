import { JurisdictionRulesTaxProvider } from "./jurisdiction-rules.js";

export function createTaxProviders() {
  return [
    new JurisdictionRulesTaxProvider(),
  ];
}
