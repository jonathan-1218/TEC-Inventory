"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"
import type { ProjectStatus } from "@prisma/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ProjectStatusBadge } from "@/components/badges"
import { FormField } from "@/components/form-field"
import { updateOwnMemberRole, updateOwnProject, updateOwnTeam } from "@/app/actions/portal"
import { formValues, runAction } from "@/lib/client"
import { formatDate } from "@/lib/dates"
import { STATUSES, STATUS_LABELS, TECH_STACK_KEYS, TECH_STACK_LABELS, type TechStack } from "@/lib/labels"

/** A settings card: reads like a profile by default, and its Edit button turns the content into fields. */
function SectionShell({
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  title: string
  description?: string
  editing: boolean
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="bg-card rounded-2xl border p-6 sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          {description && <p className="text-muted-foreground mt-1 text-sm text-pretty">{description}</p>}
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
            <Pencil /> Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="eyebrow mb-1.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

const Empty = ({ children = "Not set" }: { children?: string }) => <span className="text-muted-foreground">{children}</span>

function FormButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 border-t pt-4">
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
    </div>
  )
}

// ---------- Project ----------

type ProjectData = { title: string; description: string; status: ProjectStatus; startDate: string; targetDate: string; techStack: TechStack }

export function ProjectSection({ projectId, project }: { projectId: string; project: ProjectData }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const stack = TECH_STACK_KEYS.filter((k) => project.techStack[k].length > 0)

  return (
    <SectionShell
      title="Project"
      description="Title, description, status, dates and the tools you are using."
      editing={editing}
      onEdit={() => {
        setStatus(project.status)
        setErrors({})
        setEditing(true)
      }}
    >
      {!editing ? (
        <dl className="grid gap-6">
          <Field label="Title">
            <span className="font-display text-xl font-extrabold">{project.title}</span>
          </Field>
          <Field label="Description">
            {project.description ? <p className="max-w-2xl leading-relaxed whitespace-pre-wrap">{project.description}</p> : <Empty>No description yet.</Empty>}
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Status">
              <ProjectStatusBadge status={project.status} />
            </Field>
            <Field label="Start date">{project.startDate ? formatDate(project.startDate) : <Empty />}</Field>
            <Field label="Target date">{project.targetDate ? formatDate(project.targetDate) : <Empty />}</Field>
          </div>
          <Field label="Tech stack">
            {stack.length === 0 ? (
              <Empty>Nothing listed yet.</Empty>
            ) : (
              <div className="grid gap-3">
                {stack.map((k) => (
                  <div key={k} className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground w-24 text-xs">{TECH_STACK_LABELS[k]}</span>
                    {project.techStack[k].map((t) => (
                      <span key={t} className="bg-muted rounded-full px-3 py-1 text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Field>
        </dl>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            const v = formValues(e.currentTarget)
            start(async () => {
              const res = await runAction(
                updateOwnProject({
                  projectId,
                  title: v.title,
                  description: v.description,
                  status,
                  startDate: v.startDate,
                  targetDate: v.targetDate,
                  techStack: { languages: v.languages, frameworks: v.frameworks, hardware: v.hardware, tools: v.tools, cloud: v.cloud },
                } as Parameters<typeof updateOwnProject>[0]),
                "Project settings saved"
              )
              if (res.ok) setEditing(false)
              else setErrors(res.fieldErrors ?? {})
            })
          }}
        >
          <FormField label="Project title" htmlFor="s-title" error={errors.title}>
            <Input id="s-title" name="title" required maxLength={120} defaultValue={project.title} autoFocus />
          </FormField>
          <FormField label="Description" htmlFor="s-desc" error={errors.description} hint="What you are building, and why.">
            <Textarea id="s-desc" name="description" rows={4} maxLength={5000} defaultValue={project.description} />
          </FormField>
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <FormField label="Status" error={errors.status}>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Start date" htmlFor="s-start" error={errors.startDate}>
              <Input id="s-start" name="startDate" type="date" defaultValue={project.startDate} />
            </FormField>
            <FormField label="Target date" htmlFor="s-target" error={errors.targetDate}>
              <Input id="s-target" name="targetDate" type="date" defaultValue={project.targetDate} />
            </FormField>
          </div>
          <fieldset className="grid gap-4">
            <legend className="eyebrow mb-1 w-full border-t pt-4">Tech stack · separate items with commas</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {TECH_STACK_KEYS.map((k) => (
                <FormField key={k} label={TECH_STACK_LABELS[k]} htmlFor={`s-${k}`} error={errors[`techStack.${k}`]}>
                  <Input id={`s-${k}`} name={k} defaultValue={project.techStack[k].join(", ")} placeholder={k === "hardware" ? "Arduino, ESP32" : undefined} />
                </FormField>
              ))}
            </div>
          </fieldset>
          <FormButtons pending={pending} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionShell>
  )
}

// ---------- Team ----------

export function TeamSection({ projectId, team }: { projectId: string; team: { name: string; description: string } }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  return (
    <SectionShell
      title="Team"
      description="How your team appears on the club's Teams page."
      editing={editing}
      onEdit={() => {
        setErrors({})
        setEditing(true)
      }}
    >
      {!editing ? (
        <dl className="grid gap-6">
          <Field label="Team name">
            <span className="font-display text-xl font-extrabold">{team.name}</span>
          </Field>
          <Field label="About the team">
            {team.description ? <p className="max-w-2xl leading-relaxed whitespace-pre-wrap">{team.description}</p> : <Empty>No description yet.</Empty>}
          </Field>
        </dl>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            const v = formValues(e.currentTarget)
            start(async () => {
              const res = await runAction(updateOwnTeam({ projectId, name: v.name, description: v.description }), "Team details saved")
              if (res.ok) setEditing(false)
              else setErrors(res.fieldErrors ?? {})
            })
          }}
        >
          <FormField label="Team name" htmlFor="s-team" error={errors.name}>
            <Input id="s-team" name="name" required maxLength={80} defaultValue={team.name} autoFocus />
          </FormField>
          <FormField label="About the team" htmlFor="s-team-desc" error={errors.description} hint="Shown on the club's Teams page.">
            <Textarea id="s-team-desc" name="description" rows={3} maxLength={1000} defaultValue={team.description} />
          </FormField>
          <FormButtons pending={pending} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionShell>
  )
}

// ---------- Members and roles ----------

type MemberRow = { id: string; name: string; role: string; isLead: boolean }

export function MembersSection({ projectId, members }: { projectId: string; members: MemberRow[] }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const roleOf = (m: MemberRow) => roles[m.id] ?? m.role

  return (
    <SectionShell
      title="Members and roles"
      description="What each person does on the project. To add or remove people, ask a club admin."
      editing={editing}
      onEdit={() => {
        setRoles({})
        setError(undefined)
        setEditing(true)
      }}
    >
      {!editing ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="bg-muted/40 flex items-center gap-3 rounded-xl p-3">
              <span className="bg-foreground text-background grid size-10 shrink-0 place-items-center rounded-full font-mono text-xs">
                {m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{m.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {m.role}
                  {m.isLead && " · team lead"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            const changed = members.filter((m) => roleOf(m).trim() && roleOf(m).trim() !== m.role)
            if (changed.length === 0) return setEditing(false)
            start(async () => {
              for (const m of changed) {
                const res = await runAction(updateOwnMemberRole({ projectId, memberId: m.id, roleInProject: roleOf(m) }))
                if (!res.ok) return setError(`${m.name}: ${res.error}`)
              }
              setEditing(false)
              toast.success(changed.length === 1 ? "Role saved" : "Roles saved")
            })
          }}
        >
          <ul className="grid divide-y">
            {members.map((m) => (
              <li key={m.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_18rem] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  {m.isLead && <p className="text-muted-foreground text-xs">Team lead</p>}
                </div>
                <FormField label={<span className="sr-only">Role of {m.name}</span>} htmlFor={`role-${m.id}`}>
                  <Input id={`role-${m.id}`} value={roleOf(m)} maxLength={60} onChange={(e) => setRoles((r) => ({ ...r, [m.id]: e.target.value }))} />
                </FormField>
              </li>
            ))}
          </ul>
          {error && <p className="text-danger text-sm font-medium">{error}</p>}
          <FormButtons pending={pending} onCancel={() => setEditing(false)} />
        </form>
      )}
    </SectionShell>
  )
}
