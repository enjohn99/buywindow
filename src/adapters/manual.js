import { RetailerAdapter } from "./types.js";

export class ManualAdapter extends RetailerAdapter {
  constructor(results) {
    super("manual");
    this.results = results;
  }

  async search() {
    return this.results;
  }
}
