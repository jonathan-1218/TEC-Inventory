"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MemberFormDialog } from "@/components/members/member-form-dialog"
import { RowActions, type MemberRow } from "@/components/members/members-table"
import { useDesignations } from "@/components/designations-context"
import mark from "@/assets/tec-mark.png"
import { cn } from "@/lib/utils"
import styles from "./officer-card.module.css"

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

/** An office bearer as a trading card; clicking it opens their About view (photo and bio). */
export function OfficerCard({ m, departments, admin }: { m: MemberRow; departments: string[]; admin: boolean }) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const role = useDesignations().label(m.designation)

  return (
    <>
      <div className={styles.wrapper}>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${m.name}, ${role}. Open about`}
          className={cn(styles.card, !m.isActive && styles.inactive)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              setOpen(true)
            }
          }}
        >
          <div className={styles.main}>
            <div className={styles.content}>
              <div className={styles.header}>
                <span className={styles.logo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mark.src} alt="" />
                  TEC
                </span>
                <span className="flex items-center gap-2">
                  <span className={styles.type}>Office bearer</span>
                  {admin && (
                    // Admin menu: clicks here must not also open the About view.
                    <span className={styles.menu} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <RowActions member={m} departments={departments} />
                    </span>
                  )}
                </span>
              </div>

              <h3 className={styles.title}>{role}</h3>
              <p className={styles.subtitle}>{m.isActive ? "Club executive" : "Club executive · inactive"}</p>

              <dl className={styles.details}>
                <div className={cn(styles.item, styles.wide)}>
                  <dt className={styles.label}>Name</dt>
                  <dd className={styles.name}>{m.name}</dd>
                </div>
                <div className={styles.item}>
                  <dt className={styles.label}>Department</dt>
                  <dd className={styles.value}>{m.department}</dd>
                </div>
                <div className={styles.item}>
                  <dt className={styles.label}>Year</dt>
                  <dd className={styles.value}>Year {m.yearOfStudy}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className={styles.footer}>
            <span>Read about {m.name.split(" ")[0]}</span>
            <ArrowRight className="size-4" />
          </div>
        </div>
      </div>

      {admin && <MemberFormDialog member={m} departments={departments} open={editOpen} onOpenChange={setEditOpen} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <div className="grid gap-6 sm:grid-cols-[11rem_1fr]">
            <div className={cn(styles.aboutPhoto, "mx-auto sm:mx-0")}>
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt={m.name} referrerPolicy="no-referrer" />
              ) : (
                <div className={styles.placeholder} aria-hidden>
                  <span>{initials(m.name)}</span>
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <DialogHeader>
                <p className="eyebrow">{role} · TEC Club</p>
                <DialogTitle className="font-display text-3xl leading-tight font-extrabold tracking-tight">{m.name}</DialogTitle>
                <DialogDescription>
                  {m.department} · Year {m.yearOfStudy}
                </DialogDescription>
              </DialogHeader>
              <div>
                <p className="eyebrow mb-2">About</p>
                {m.bio ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.bio}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {admin ? "No bio yet. Add one from the ⋯ menu on the card (Edit)." : "No bio added yet."}
                  </p>
                )}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="-ms-2">
                  <Link href={`/members/${m.id}`}>
                    Full profile <ArrowRight />
                  </Link>
                </Button>
                {admin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false)
                      setEditOpen(true)
                    }}
                  >
                    <Pencil /> Edit card
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
