import { getDb } from "../lib/db";
import { ensureSeed } from "../lib/seed";

getDb();
ensureSeed();
console.log("Seeded the fictional Palmetto Coast demo database.");
