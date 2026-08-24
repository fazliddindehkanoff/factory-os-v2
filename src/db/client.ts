import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import * as schema from "@/db/schema"

function normalizeDatabaseUrl(value: string | undefined) {
  if (!value) return "file:data/factory-os.sqlite"
  if (value.startsWith("file:") || value.startsWith("libsql:") || value.startsWith("https:")) {
    return value
  }
  return `file:${value}`
}

const globalDatabase = globalThis as typeof globalThis & {
  factoryOsDatabaseClient?: ReturnType<typeof createClient>
}

export const databaseClient = globalDatabase.factoryOsDatabaseClient ?? createClient({
  url: normalizeDatabaseUrl(process.env.DATABASE_URL),
  authToken: process.env.DATABASE_AUTH_TOKEN,
})

if (process.env.NODE_ENV !== "production") {
  globalDatabase.factoryOsDatabaseClient = databaseClient
}

export const db = drizzle(databaseClient, { schema })
export type Database = typeof db
