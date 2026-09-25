/**
 * Tax providers must return either:
 * { status: "observed"|"estimated", taxAmount, ...provenance }
 * or { status: "unavailable", reason }.
 *
 * Providers should never guess a rate when the required jurisdiction or
 * product-taxability information is unavailable.
 */
export class TaxProvider {
  constructor(name) {
    this.name = name;
  }

  canCalculate(_input) {
    return false;
  }

  async calculate(_input) {
    throw new Error("calculate() must be implemented by a tax provider");
  }
}
