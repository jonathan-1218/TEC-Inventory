"use client"

import { Children, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ProjectStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { createProject, updateProject } from "@/app/actions/projects"
import { formValues, runAction } from "@/lib/client"
import { toDateInput } from "@/lib/dates"
import {
  STATUSES,
  STATUS_LABELS,
  TECH_STACK_KEYS,
  TECH_STACK_LABELS,
  type TechStack,
  type TechStackKey,
} from "@/lib/labels"

export type TeamOption = { id: string; name: string }

export type EditableProject = {
  id: string
  title: string
  description: string | null
  teamId: string | null
  status: ProjectStatus
  progressPercent: number
  startDate: Date | null
  targetDate: Date | null
  techStack: TechStack
}

const PLACEHOLDERS: Record<TechStackKey, string> = {
  languages: "C++, Python",
  frameworks: "Arduino, ROS 2",
  hardware: "ESP32, L298N, HC-SR04",
  tools: "PlatformIO, KiCad",
  cloud: "Firebase, HiveMQ",
}

/** Create a project (no `project`) or edit one. `defaultOpen`: opened by `?new=1` (⌘K "New project"); closing drops the param. */
export function ProjectFormDialog({
  teams,
  project,
  trigger,
  defaultOpen = false,
}: {
  teams: TeamOption[]
  project?: EditableProject
  trigger: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpenState] = useState(defaultOpen)
  const setOpen = (o: boolean) => {
    setOpenState(o)
    const params = new URLSearchParams(window.location.search)
    if (!o && params.has("new")) {
      params.delete("new")
      window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* toArray resolves a lazy element (server-passed triggers can arrive lazy after a refresh; Slot can't clone those). */}
      <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="eyebrow">Project</p>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {project ? "Update the project details." : "Track a club project, its team and tech stack."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <ProjectForm teams={teams} project={project} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProjectForm({
  teams,
  project,
  onDone,
}: {
  teams: TeamOption[]
  project?: EditableProject
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    const payload = {
      ...values,
      techStack: {
        languages: values.languages,
        frameworks: values.frameworks,
        hardware: values.hardware,
        tools: values.tools,
        cloud: values.cloud,
      },
    }
    startTransition(async () => {
      if (project) {
        const res = await runAction(
          updateProject({ ...payload, id: project.id } as Parameters<typeof updateProject>[0]),
          "Project updated"
        )
        if (res.ok) onDone()
        else setErrors(res.fieldErrors ?? {})
      } else {
        const res = await runAction(
          createProject(payload as Parameters<typeof createProject>[0]),
          "Project created"
        )
        if (res.ok) {
          onDone()
          router.push(`/projects/${res.data.id}`)
        } else setErrors(res.fieldErrors ?? {})
      }
    })
  }

  return (
    <>
      <form id="project-form" onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Title" htmlFor="pf-title" error={errors.title}>
          <Input id="pf-title" name="title" defaultValue={project?.title} required maxLength={120} />
        </FormField>
        <FormField label="Description" htmlFor="pf-description" error={errors.description}>
          <Textarea
            id="pf-description"
            name="description"
            rows={3}
            defaultValue={project?.description ?? ""}
            placeholder="What is it, and what does done look like?"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Team" error={errors.teamId}>
            <Select name="teamId" defaultValue={project?.teamId ?? "none"}>
              <SelectTrigger className="w-full" aria-label="Team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No team (independent)</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Status" error={errors.status}>
            <Select name="status" defaultValue={project?.status ?? "PLANNING"}>
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
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Progress %" htmlFor="pf-progress" error={errors.progressPercent}>
            <Input
              id="pf-progress"
              name="progressPercent"
              type="number"
              min={0}
              max={100}
              defaultValue={project?.progressPercent ?? 0}
              required
            />
          </FormField>
          <FormField label="Start date" htmlFor="pf-start" error={errors.startDate}>
            <Input id="pf-start" name="startDate" type="date" defaultValue={toDateInput(project?.startDate)} />
          </FormField>
          <FormField label="Target date" htmlFor="pf-target" error={errors.targetDate}>
            <Input id="pf-target" name="targetDate" type="date" defaultValue={toDateInput(project?.targetDate)} />
          </FormField>
        </div>
        <fieldset className="grid gap-4">
          <legend className="eyebrow mb-3 w-full border-t pt-4">Tech stack · comma-separated</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {TECH_STACK_KEYS.map((k) => (
              <TagField
                key={k}
                field={k}
                defaultValue={project?.techStack[k].join(", ") ?? ""}
                error={errors[`techStack.${k}`]}
              />
            ))}
          </div>
        </fieldset>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="project-form" variant="brand" disabled={pending}>
          {pending ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Comma-separated input with a live chip preview. */
function TagField({ field, defaultValue, error }: { field: TechStackKey; defaultValue: string; error?: string[] }) {
  const [value, setValue] = useState(defaultValue)
  const tags = [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))]

  return (
    <FormField label={TECH_STACK_LABELS[field]} htmlFor={`pf-${field}`} error={error}>
      <Input
        id={`pf-${field}`}
        name={field}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={PLACEHOLDERS[field]}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </FormField>
  )
}
