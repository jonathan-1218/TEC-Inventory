import assert from "node:assert"
import { matchTotp, totpAt } from "../src/lib/totp"
// RFC 6238 test vector: secret "12345678901234567890" (base32 below), T=59 s → 94287082 (8 digits) → last 6: 287082.
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
assert.equal(totpAt(secret, 1), "287082")
assert.equal(matchTotp(secret, "287082", 59_000), 1)
assert.equal(matchTotp(secret, "287082", 59_000 + 30_000), 1) // one step of drift allowed
assert.equal(matchTotp(secret, "287082", 59_000 + 90_000), null)
assert.equal(matchTotp(secret, "28708x"), null)
console.log("✓ totp checks passed")
