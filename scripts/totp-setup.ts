// Prints a new admin 2FA secret. Put it in ADMIN_TOTP_SECRET (Vercel env + .env) and add it to an authenticator app.
import { newTotpSecret, totpUri } from "../src/lib/totp"

const secret = newTotpSecret()
console.log(`ADMIN_TOTP_SECRET=${secret}\n\nAdd to your authenticator app (enter the key manually, or turn this link into a QR code):\n${totpUri(secret)}`)
