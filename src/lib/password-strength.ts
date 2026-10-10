// ponytail: rule-based check with a short common-password list, no zxcvbn dependency.
// Upgrade path: zxcvbn-ts or a HaveIBeenPwned k-anonymity lookup if guessable passwords still slip through.
const COMMON = new Set(
  `password password1 password123 passw0rd 12345678 123456789 1234567890 qwerty123 qwertyuiop 1q2w3e4r 1qaz2wsx
   abc12345 abcd1234 iloveyou welcome123 admin123 administrator letmein123 sunshine1 football1 baseball1 monkey123
   dragon123 master123 trustno1 superman1 princess1 starwars1 computer1 whatever1 freedom123 india123 india@123
   tec12345 tecclub123 tecadmin admin@123 welcome@123 password@123 pass@123 test1234 changeme`.split(/\s+/)
)

export const PASSWORD_MIN = 10

/** Problems with a password, empty when it's acceptable. `personal` = words it must not contain (email, names). */
export function passwordProblems(pw: string, personal: string[] = []): string[] {
  const out: string[] = []
  const lower = pw.toLowerCase()
  if (pw.length < PASSWORD_MIN) out.push(`Use at least ${PASSWORD_MIN} characters`)
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  // Long passphrases are strong on length alone; shorter ones need variety.
  if (pw.length < 16 && classes < 3) out.push("Mix at least three of: lowercase, uppercase, numbers, symbols")
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[^a-z0-9@]/g, ""))) out.push("This password is too common")
  if (/^(.)\1+$/.test(pw) || /(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pw) && pw.length < 14) {
    out.push("Avoid repeated or sequential characters")
  }
  for (const word of personal.map((w) => w.toLowerCase().trim()).filter((w) => w.length >= 4)) {
    if (lower.includes(word)) {
      out.push("Don't use your email, name or roll number in it")
      break
    }
  }
  return out
}

/** 0–4 for a strength meter. */
export function passwordScore(pw: string, personal: string[] = []): number {
  if (!pw) return 0
  const problems = passwordProblems(pw, personal).length
  if (problems) return Math.max(1, 2 - problems)
  return pw.length >= 16 ? 4 : 3
}
