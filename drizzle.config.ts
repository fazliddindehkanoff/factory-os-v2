import { defineConfig } from "drizzle-kit"

const databaseUrl = process.env.DATABASE_URL ?? "file:data/factory-os.sqlite"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl,
  },
  strict: true,
  verbose: true,
})
