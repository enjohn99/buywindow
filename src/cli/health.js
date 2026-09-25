import { getReadiness } from "../config/readiness.js";

const result = getReadiness(process.env);
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "ok" ? 0 : 1);
