"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GraduationCap, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { signUp } from "@/app/actions/accounts"
import { runAction } from "@/lib/client"
import { cn } from "@/lib/utils"
import { MAX_GROUP, personalWords } from "@/lib/validators"
import { PASSWORD_MIN, passwordProblems, passwordScore } from "@/lib/password-strength"

type Mentor = { id: string; name: string; designation: string; department: string | null }
type Kind = "INDIVIDUAL" | "GROUP"
type Person = { name: string; rollNumber: string; department: string; yearOfStudy: string }

const STEPS = ["Type", "Members", "Project", "Login", "Review"] as const
const YEARS = ["1", "2", "3", "4", "5", "6"]
const SIZES = Array.from({ length: MAX_GROUP - 1 }, (_, i) => i + 2)
const blank = (): Person => ({ name: "", rollNumber: "", department: "", yearOfStudy: "1" })

export function SignupForm({ mentors }: { mentors: Mentor[] }) {
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<Kind>()
  const [size, setSize] = useState(2)
  const [people, setPeople] = useState<Person[]>([blank()])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [mentorId, setMentorId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const count = kind === "GROUP" ? size : 1
  const members = Array.from({ length: count }, (_, i) => people[i] ?? blank())
  const mentor = mentors.find((m) => m.id === mentorId)
  const personal = personalWords(email, members)
  const score = passwordScore(password, personal)
  const setPerson = (i: number, patch: Partial<Person>) =>
    setPeople(Array.from({ length: Math.max(people.length, i + 1) }, (_, j) => (j === i ? { ...members[i], ...patch } : (people[j] ?? blank()))))

  /** Returns an error message for the current step, or undefined when it's complete. */
  function check(s: number): string | undefined {
    if (s === 0 && !kind) return "Choose individual or group."
    if (s === 1) {
      const missing = members.findIndex((m) => !m.name.trim() || !m.rollNumber.trim() || !m.department.trim())
      if (missing >= 0) return `Fill in every field for ${count > 1 ? `member ${missing + 1}` : "yourself"}.`
      const rolls = members.map((m) => m.rollNumber.trim().toUpperCase())
      if (new Set(rolls).size !== rolls.length) return "Each member needs a different roll number."
    }
    if (s === 2) {
      if (!title.trim()) return "Give your project a title."
      if (!mentorId) return "Pick your project's mentor."
    }
    if (s === 3) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email."
      const problem = passwordProblems(password, personal)[0]
      if (problem) return `${problem}.`
      if (password !== confirm) return "The two passwords don't match."
    }
  }
  const next = () => {
    const e = check(step)
    setError(e)
    if (!e) setStep(step + 1)
  }
  const submit = () =>
    startTransition(async () => {
      const res = await runAction(
        signUp({
          kind: kind!,
          title,
          description,
          mentorId,
          members: members.map((m) => ({ ...m, yearOfStudy: Number(m.yearOfStudy) })),
          email,
          password,
        })
      )
      if (res.ok) setDone(true)
      else setError(res.error)
    })

  if (done) {
    return (
      <div className="bg-card grid justify-items-center gap-3 rounded-xl border px-6 py-14 text-center">
        <span className="bg-brand/15 grid size-14 place-items-center rounded-full">
          <CheckCircle2 className="text-brand size-8" />
        </span>
        <h2 className="font-display text-2xl font-extrabold">Sign-up sent</h2>
        <p className="text-muted-foreground max-w-md text-sm text-pretty">
          A club admin will review <span className="text-foreground font-medium">{title}</span>. Once it&apos;s approved, log in
          with <span className="text-foreground font-mono">{email}</span>.
        </p>
        <Button asChild variant="brand" className="mt-2">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      {/* Progress rail */}
      <ol className="bg-muted/40 grid grid-cols-5 border-b" aria-label="Sign-up steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1.5 px-1 py-3 text-center",
              i === step && "after:bg-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5"
            )}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border font-mono text-xs tabular-nums",
                i < step && "bg-brand text-brand-foreground border-brand",
                i === step && "border-brand text-brand-strong font-semibold",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("eyebrow text-[10px]", i === step && "text-foreground")}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 p-5 sm:p-7">
        {step === 0 && (
          <Step title="Is this an individual or a group project?">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice selected={kind === "INDIVIDUAL"} onClick={() => setKind("INDIVIDUAL")} icon={User} title="Individual" text="Just you, building it on your own." />
              <Choice selected={kind === "GROUP"} onClick={() => setKind("GROUP")} icon={Users} title="Group" text={`A team of 2 to ${MAX_GROUP} members.`} />
            </div>
            {kind === "GROUP" && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">How many members, including you?</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Team size">
                  {SIZES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={size === n}
                      onClick={() => setSize(n)}
                      className={cn(
                        "size-10 rounded-md border font-mono text-sm tabular-nums transition-colors",
                        size === n ? "border-brand bg-brand/12 text-brand-strong font-semibold" : "hover:bg-muted"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Step>
        )}

        {step === 1 && (
          <Step title={count > 1 ? "Who's on the team?" : "Your details"} hint={count > 1 ? "Member 1 is you, the project lead." : undefined}>
            <div className="grid gap-4">
              {members.map((m, i) => (
                <fieldset key={i} className="grid items-start gap-3 rounded-lg border p-4 sm:grid-cols-[2fr_1.2fr_1.4fr_0.8fr]">
                  <legend className="eyebrow px-1">
                    {count > 1 ? `Member ${i + 1}${i === 0 ? " · you (lead)" : ""}` : "You"}
                  </legend>
                  <FormField label="Name" htmlFor={`m${i}-name`}>
                    <Input id={`m${i}-name`} value={m.name} maxLength={100} onChange={(e) => setPerson(i, { name: e.target.value })} />
                  </FormField>
                  <FormField label="Roll no." htmlFor={`m${i}-roll`}>
                    <Input id={`m${i}-roll`} value={m.rollNumber} maxLength={40} className="font-mono uppercase" onChange={(e) => setPerson(i, { rollNumber: e.target.value })} />
                  </FormField>
                  <FormField label="Department" htmlFor={`m${i}-dept`}>
                    <Input id={`m${i}-dept`} value={m.department} maxLength={80} placeholder="e.g. ECE" onChange={(e) => setPerson(i, { department: e.target.value })} />
                  </FormField>
                  <FormField label="Year" htmlFor={`m${i}-year`}>
                    <Select value={m.yearOfStudy} onValueChange={(v) => setPerson(i, { yearOfStudy: v })}>
                      <SelectTrigger id={`m${i}-year`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </fieldset>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Project and mentor">
            <FormField label="Project title" htmlFor="title">
              <Input id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField label="What are you building?" htmlFor="description" hint="Optional, a sentence or two.">
              <Textarea id="description" value={description} maxLength={2000} rows={3} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Project mentor</p>
              {mentors.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  No mentors are listed yet. Ask a club admin to add yours.
                </p>
              ) : (
                <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label="Project mentor">
                  {mentors.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={mentorId === m.id}
                      onClick={() => setMentorId(m.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                        mentorId === m.id ? "border-brand bg-brand/10" : "hover:bg-muted"
                      )}
                    >
                      <GraduationCap className={cn("size-5 shrink-0", mentorId === m.id ? "text-brand-strong" : "text-muted-foreground")} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {m.designation}
                          {m.department && ` · ${m.department}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Your team login" hint="One login per project. Share it only with your team.">
            <FormField label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <FormField label="Password" htmlFor="password">
                <Input id="password" type="password" autoComplete="new-password" value={password} maxLength={200} onChange={(e) => setPassword(e.target.value)} />
                <StrengthMeter score={score} hint={password ? (passwordProblems(password, personal)[0] ?? "Strong password") : `At least ${PASSWORD_MIN} characters; a long passphrase works best.`} />
              </FormField>
              <FormField label="Confirm password" htmlFor="confirm">
                <Input id="confirm" type="password" autoComplete="new-password" value={confirm} maxLength={200} onChange={(e) => setConfirm(e.target.value)} />
              </FormField>
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Check and send" hint="An admin approves it before you can log in.">
            <dl className="grid divide-y rounded-lg border text-sm">
              <Row label="Type" onEdit={() => setStep(0)}>
                {kind === "GROUP" ? `Group · ${count} members` : "Individual"}
              </Row>
              <Row label="Members" onEdit={() => setStep(1)}>
                <ul className="grid gap-0.5">
                  {members.map((m, i) => (
                    <li key={i}>
                      {m.name} <span className="text-muted-foreground font-mono text-xs uppercase">{m.rollNumber}</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        · {m.department}, year {m.yearOfStudy}
                        {i === 0 && count > 1 && " · lead"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Row>
              <Row label="Project" onEdit={() => setStep(2)}>
                <span className="font-medium">{title}</span>
                {description && <span className="text-muted-foreground block text-xs">{description}</span>}
              </Row>
              <Row label="Mentor" onEdit={() => setStep(2)}>
                {mentor ? `${mentor.name}, ${mentor.designation}` : "—"}
              </Row>
              <Row label="Login" onEdit={() => setStep(3)}>
                <span className="font-mono">{email}</span>
              </Row>
            </dl>
          </Step>
        )}

        {error && (
          <p role="alert" className="text-danger flex items-center gap-1.5 text-sm font-medium">
            <span aria-hidden className="bg-danger size-1.5 rounded-full" />
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || pending}
            onClick={() => {
              setError(undefined)
              setStep(step - 1)
            }}
          >
            <ArrowLeft /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="brand" onClick={next}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="button" variant="brand" disabled={pending} onClick={submit}>
              {pending ? "Sending…" : "Send for approval"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-[-0.01em]">{title}</h2>
        {hint && <p className="text-muted-foreground mt-1 text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Choice({
  selected,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  selected: boolean
  onClick: () => void
  icon: typeof User
  title: string
  text: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-start transition-colors",
        selected ? "border-brand bg-brand/10 ring-brand/30 ring-2" : "hover:bg-muted"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", selected ? "bg-brand text-brand-foreground" : "bg-muted")}>
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{text}</span>
      </span>
    </button>
  )
}

function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr_auto] items-start gap-3 px-4 py-3">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="min-w-0">{children}</dd>
      <Button type="button" variant="link" size="xs" onClick={onEdit}>
        Edit
      </Button>
    </div>
  )
}

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"]

function StrengthMeter({ score, hint }: { score: number; hint: string }) {
  return (
    <div className="grid gap-1" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1 rounded-full", i > score ? "bg-muted" : score <= 1 ? "bg-danger" : score === 2 ? "bg-brand/60" : "bg-brand")}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {score > 0 && <span className="text-foreground font-medium">{STRENGTH[score]} · </span>}
        {hint}
      </p>
    </div>
  )
}
