"use client"

import { Children, useState, useTransition } from "react"
import { Pencil, Trash2, X } from "lucide-react"
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
import { ConfirmDelete } from "@/components/confirm-delete"
import { FormField } from "@/components/form-field"
import { ProjectFormDialog, type EditableProject, type TeamOption } from "@/components/projects/project-form"
import {
  deleteProgressUpdate,
  deleteProject,
  removeProjectComponent,
  removeProjectMember,
  upsertProjectComponent,
  upsertProjectMember,
} from "@/app/actions/projects"
import { formValues, runAction } from "@/lib/client"
import type { SelectOptions } from "@/lib/queries"

const ROLES = [
  "Project Lead",
  "Firmware",
  "Hardware",
  "Software",
  "Backend",
  "Frontend",
  "Dashboard",
  "Design",
  "Documentation",
  "Testing",
]

// ---------- Project ----------

export function ProjectHeaderActions({ project, teams }: { project: EditableProject; teams: TeamOption[] }) {
  return (
    <>
      <ProjectFormDialog
        teams={teams}
        project={project}
        trigger={
          <Button variant="outline">
            <Pencil /> Edit
          </Button>
        }
      />
      <ConfirmDelete
        trigger={
          <Button variant="destructive">
            <Trash2 /> Delete
          </Button>
        }
        title={`Delete “${project.title}”?`}
        description="Members, updates and component requirements are removed; issuance history is kept."
        successMessage="Project deleted"
        onConfirm={() => deleteProject({ id: project.id, redirectTo: "/projects" })}
      />
    </>
  )
}

// ---------- Members ----------

/** Add a member (pick from `candidates`) or change an existing member's role. */
export function MemberDialog({
  projectId,
  member,
  candidates = [],
  trigger,
}: {
  projectId: string
  member?: { id: string; name: string; role: string }
  candidates?: SelectOptions["members"]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow">Project team</p>
          <DialogTitle>{member ? `Change ${member.name}'s role` : "Add member"}</DialogTitle>
          <DialogDescription>
            {member ? "Update what they do on this project." : "Add an active club member to this project."}
          </DialogDescription>
        </DialogHeader>
        <MemberForm projectId={projectId} member={member} candidates={candidates} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  projectId,
  member,
  candidates,
  onDone,
}: {
  projectId: string
  member?: { id: string; name: string; role: string }
  candidates: SelectOptions["members"]
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(
        upsertProjectMember({ ...values, projectId }),
        member ? "Role updated" : "Member added"
      )
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="project-member-form" onSubmit={onSubmit} className="grid gap-4">
        {member ? (
          <input type="hidden" name="memberId" value={member.id} />
        ) : (
          <FormField label="Member" error={errors.memberId}>
            <Select name="memberId" required>
              <SelectTrigger className="w-full" aria-label="Member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.rollNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField label="Role in project" htmlFor="pm-role" error={errors.roleInProject}>
          <Input
            id="pm-role"
            name="roleInProject"
            list="pm-roles"
            defaultValue={member?.role}
            placeholder="e.g. Firmware"
            required
            maxLength={60}
          />
          <datalist id="pm-roles">
            {ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="project-member-form" variant="brand" disabled={pending}>
          {pending ? "Saving…" : member ? "Save role" : "Add member"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function RemoveMemberButton({ projectId, member }: { projectId: string; member: { id: string; name: string } }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name} from project`}>
          <X />
        </Button>
      }
      title={`Remove ${member.name}?`}
      description="They are taken off this project. Their issuances and progress updates are kept."
      confirmLabel="Remove"
      successMessage="Member removed"
      onConfirm={() => removeProjectMember({ projectId, memberId: member.id })}
    />
  )
}

// ---------- Required components ----------

type RequirementTarget = { id: string; name: string; required: number; issued: number }

/** Add a component requirement (pick from `candidates`) or change the required quantity. */
export function RequirementDialog({
  projectId,
  component,
  candidates = [],
  trigger,
}: {
  projectId: string
  component?: RequirementTarget
  candidates?: SelectOptions["components"]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow">Parts list</p>
          <DialogTitle>{component ? `Edit ${component.name}` : "Add required component"}</DialogTitle>
          <DialogDescription>
            {component
              ? "Change how many units this project needs."
              : "Record a component this project needs from inventory."}
          </DialogDescription>
        </DialogHeader>
        <RequirementForm
          projectId={projectId}
          component={component}
          candidates={candidates}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function RequirementForm({
  projectId,
  component,
  candidates,
  onDone,
}: {
  projectId: string
  component?: RequirementTarget
  candidates: SelectOptions["components"]
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(
        upsertProjectComponent({ ...values, projectId }),
        component ? "Requirement updated" : "Component added"
      )
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="project-component-form" onSubmit={onSubmit} className="grid gap-4">
        {component ? (
          <input type="hidden" name="componentId" value={component.id} />
        ) : (
          <FormField label="Component" error={errors.componentId}>
            <Select name="componentId" required>
              <SelectTrigger className="w-full" aria-label="Component">
                <SelectValue placeholder="Select a component" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.modelNumber ? ` (${c.modelNumber})` : ""} — {c.quantityAvailable} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField
          label="Quantity required"
          htmlFor="pc-qty"
          error={errors.quantityRequired}
          hint={component ? `${component.issued} currently issued for this project` : undefined}
        >
          <Input
            id="pc-qty"
            name="quantityRequired"
            type="number"
            min={1}
            defaultValue={component?.required ?? 1}
            required
          />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="project-component-form" variant="brand" disabled={pending}>
          {pending ? "Saving…" : component ? "Save" : "Add component"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function RemoveRequirementButton({
  projectId,
  component,
}: {
  projectId: string
  component: { id: string; name: string }
}) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${component.name} requirement`}>
          <Trash2 />
        </Button>
      }
      title={`Remove ${component.name}?`}
      description="The requirement is removed from this project. Units still issued for it must be returned first."
      confirmLabel="Remove"
      successMessage="Requirement removed"
      onConfirm={() => removeProjectComponent({ projectId, componentId: component.id })}
    />
  )
}

// ---------- Progress updates ----------

export function DeleteUpdateButton({ id }: { id: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label="Delete progress update">
          <Trash2 />
        </Button>
      }
      title="Delete this update?"
      description="The project's progress falls back to the latest remaining update."
      successMessage="Update deleted"
      onConfirm={() => deleteProgressUpdate({ id })}
    />
  )
}
