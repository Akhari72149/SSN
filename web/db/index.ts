import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  if (typeof window !== "undefined") {
    throw new Error("The PostgreSQL client is server-only");
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  client ??= postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export async function closeDb() {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = undefined;
}
