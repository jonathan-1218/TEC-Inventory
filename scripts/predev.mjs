// Runs before `npm run dev`: make sure .env exists and has real database URLs.
import { copyFileSync, existsSync } from "node:fs"

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env")
  console.log("Created .env from .env.example")
}
process.loadEnvFile(".env")

const missing = ["DATABASE_URL", "DIRECT_URL"].filter((k) => !process.env[k] || process.env[k].includes("[YOUR-PASSWORD]"))
if (missing.length) {
  console.error(
    `\n✖ Set ${missing.join(" and ")} in .env first.\n` +
      "  Supabase dashboard → your project → Connect → ORMs → Prisma, copy both URLs,\n" +
      "  and replace [YOUR-PASSWORD] with your database password.\n"
  )
  process.exit(1)
}
