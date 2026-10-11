// Creates a new admin 2FA secret and writes it to a private file (never to the screen, so it can't leak
// into terminal logs or chat transcripts). Put it in ADMIN_TOTP_SECRET (Vercel env + .env) and add it to an
// authenticator app, then delete the file.
import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { newTotpSecret, totpUri } from "../src/lib/totp"

const dir = join(homedir(), ".config", "tec-inventory")
const file = join(dir, "admin-totp.txt")
const secret = newTotpSecret()
mkdirSync(dir, { recursive: true, mode: 0o700 })
writeFileSync(
  file,
  `ADMIN_TOTP_SECRET=${secret}\n\nAuthenticator app: add an account, choose "enter a setup key", type the key above.\nOr turn this link into a QR code: ${totpUri(secret)}\n\nDelete this file once it's in Vercel, .env and your app.\n`,
  { mode: 0o600 }
)
console.log(`New 2FA key written to ${file} (only you can read it).\nOpen it in a text editor — don't print it in a shared terminal.`)
