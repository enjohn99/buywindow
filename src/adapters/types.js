/**
 * Retailer adapters normalize source-specific data into BuyWindow's common listing shape.
 * Implementations should use authorized/supported access methods and respect source terms.
 */
export class RetailerAdapter {
  constructor(retailer) {
    this.retailer = retailer;
  }

  async search(_query, _context = {}) {
    throw new Error("search() must be implemented by a retailer adapter");
  }
}
