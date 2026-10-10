import assert from "node:assert"
import { passwordProblems } from "../src/lib/password-strength"
assert.ok(passwordProblems("short1A!").length)               // too short
assert.ok(passwordProblems("alllowercaseword").length === 0) // 16+ chars passphrase OK
assert.ok(passwordProblems("lowercaseonly").length)          // <16, one class
assert.ok(passwordProblems("Password123").length)            // common-ish + sequence
assert.ok(passwordProblems("Kavin2024!Robo", ["kavin@tec.edu".split("@")[0]]).length) // personal word
assert.deepEqual(passwordProblems("Tr1cky-Servo-Lid"), [])
console.log("✓ password checks passed")
