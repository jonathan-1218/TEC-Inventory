import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityHeatmap,
  BarList,
  DeltaChip,
  ProgressRing,
  ProgressTimeline,
  RangeToggle,
  Sparkline,
  StackedBars,
  TrendChart,
  parseRange,
} from "@/components/charts"
import { parseDateInput, toDateInput } from "@/lib/dates"

export const metadata: Metadata = { title: "Chart kit" }

// Dev-only showcase of src/components/charts with fake (but plausible) club data.
const END = "2026-09-27"

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function days(n: number) {
  const end = parseDateInput(END).getTime()
  return Array.from({ length: n }, (_, i) => toDateInput(new Date(end - (n - 1 - i) * 86_400_000)))
}

const rand = rng(7)
// Club meets Tue / Thu / Sat, so those days are busy.
const checkouts = days(90).map((date, i) => {
  const dow = parseDateInput(date).getUTCDay()
  const busy = dow === 2 || dow === 4 || dow === 6
  const issued = Math.round((busy ? 5 : 1) + rand() * (busy ? 7 : 2.5) + i / 30)
  return { date, issued, returned: Math.max(0, Math.round(issued * (0.55 + rand() * 0.5))) }
})
const heatmap = days(26 * 7).map((date) => {
  const dow = parseDateInput(date).getUTCDay()
  const r = rand()
  return { date, count: r < 0.35 ? 0 : Math.round(r * (dow === 2 || dow === 4 || dow === 6 ? 11 : 4)) }
})

const inventory = [
  { label: "Microcontroller", available: 34, issued: 18, damaged: 2, underRepair: 1 },
  { label: "Sensor", available: 61, issued: 22, damaged: 4, underRepair: 0 },
  { label: "Actuator / Motor", available: 27, issued: 14, damaged: 3, underRepair: 2 },
  { label: "Power", available: 40, issued: 9, damaged: 1, underRepair: 0 },
  { label: "Display", available: 12, issued: 7, damaged: 0, underRepair: 1 },
  { label: "Communication", available: 18, issued: 11, damaged: 1, underRepair: 0 },
  { label: "Tools", available: 23, issued: 5, damaged: 0, underRepair: 3 },
]

type Kpi = { label: string; value: string; delta: number; suffix: string; good: "up" | "down"; danger?: boolean; data: number[] }
const kpis: Kpi[] = [
  { label: "Parts on loan", value: "86", delta: 12, suffix: "%", good: "up", data: [61, 64, 60, 66, 70, 69, 73, 71, 76, 79, 77, 82, 84, 86] },
  { label: "Checkouts · 14d", value: "57", delta: 8, suffix: "%", good: "up", data: checkouts.slice(-14).map((d) => d.issued) },
  { label: "Overdue returns", value: "3", delta: 1, suffix: "", good: "down", danger: true, data: [2, 3, 2, 2, 3, 2, 2, 1, 2, 2, 3, 2, 2, 3] },
  { label: "Avg project progress", value: "58%", delta: 6, suffix: " pts", good: "up", data: [41, 42, 42, 45, 47, 47, 49, 50, 52, 52, 54, 55, 57, 58] },
]

const timeline = [
  {
    id: "lf",
    name: "Line follower bot",
    points: [
      { date: "2026-07-06", progress: 5 },
      { date: "2026-07-20", progress: 20 },
      { date: "2026-08-03", progress: 35 },
      { date: "2026-08-24", progress: 55 },
      { date: "2026-09-14", progress: 72 },
    ],
  },
  {
    id: "ws",
    name: "Weather station",
    points: [
      { date: "2026-07-13", progress: 10 },
      { date: "2026-08-10", progress: 25 },
      { date: "2026-09-07", progress: 45 },
    ],
  },
  {
    id: "sd",
    name: "Smart dustbin",
    points: [
      { date: "2026-07-01", progress: 30 },
      { date: "2026-07-27", progress: 60 },
      { date: "2026-08-17", progress: 90 },
      { date: "2026-08-31", progress: 100 },
    ],
  },
]

export default async function ChartKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { range, days: span } = parseRange((await searchParams).range)
  const trend = checkouts.slice(-span)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Dev only · src/components/charts</p>
        <h1 className="text-2xl font-semibold tracking-tight">Chart kit</h1>
        <p className="max-w-prose text-sm text-muted-foreground">Every chart the app uses, on fake club data. Hover, focus and use the arrow keys.</p>
      </header>

      <Section title="Sparkline" note="KPI cards">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} size="sm" className={`gap-2 px-4 ${k.danger ? "border-l-2 border-l-brand" : ""}`}>
              <p className="eyebrow">{k.label}</p>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <span className="font-display text-3xl leading-none font-bold">{k.value}</span>
                  <DeltaChip value={k.delta} suffix={k.suffix} good={k.good} danger={k.danger} />
                </div>
                <Sparkline data={k.data} className="max-w-32" summary={`${k.label}, last 14 days: ${k.data[0]} to ${k.data.at(-1)}`} />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="TrendChart + RangeToggle" note="URL mode: ?range=">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Checkout activity</CardTitle>
              <p className="text-sm text-muted-foreground">Parts issued vs returned per day</p>
            </div>
            <RangeToggle value={range} param="range" />
          </CardHeader>
          <CardContent>
            <TrendChart
              data={trend}
              series={[
                { key: "issued", label: "Issued" },
                { key: "returned", label: "Returned" },
              ]}
            />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>No checkouts (all zero)</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={checkouts.slice(-14).map((d) => ({ date: d.date, issued: 0 }))} series={[{ key: "issued", label: "Issued" }]} height={160} totals={false} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>No data yet (empty)</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={[]} series={[{ key: "issued", label: "Issued" }]} height={160} totals={false} emptyMessage="No checkouts recorded yet" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-5">
        <Section title="StackedBars" note="horizontal · inventory health" className="lg:col-span-3">
          <Card>
            <CardContent>
              <StackedBars data={inventory} />
            </CardContent>
          </Card>
        </Section>
        <Section title="StackedBars" note="vertical · few categories" className="lg:col-span-2">
          <Card>
            <CardContent>
              <StackedBars data={inventory.slice(0, 4)} orientation="vertical" height={250} />
            </CardContent>
          </Card>
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="ProgressRing" note="sm · md · lg">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6">
              <ProgressRing value={72} size="lg" label="Line follower bot" />
              <ProgressRing value={45} size="md" label="Weather station" />
              <ProgressRing value={100} size="md" label="Smart dustbin" />
              <ProgressRing value={18} size="sm" label="Drone flight controller" />
              <ProgressRing value={0} size="sm" label="Planning" />
            </CardContent>
          </Card>
        </Section>
        <Section title="BarList" note="ranked, optional links">
          <Card>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <BarList
                summary="Most issued parts, last 90 days"
                items={[
                  { label: "ESP32 DevKit", value: 42, href: "/inventory" },
                  { label: "Arduino Uno R3", value: 37, href: "/inventory" },
                  { label: "HC-SR04 ultrasonic", value: 29, href: "/inventory" },
                  { label: "SG90 micro servo", value: 21, href: "/inventory" },
                  { label: "L298N motor driver", value: 14, href: "/inventory" },
                ]}
              />
              <BarList
                summary="Top borrowers, last 90 days"
                items={[
                  { label: "Aarav Menon", value: 18, hint: "Robotics" },
                  { label: "Diya Krishnan", value: 15, hint: "IoT" },
                  { label: "Rohan Iyer", value: 11 },
                  { label: "Meera Pillai", value: 9 },
                  { label: "Kabir Nair", value: 4 },
                ]}
              />
            </CardContent>
          </Card>
        </Section>
      </div>

      <Section title="ActivityHeatmap" note="26 weeks · arrow keys">
        <Card>
          <CardContent>
            <ActivityHeatmap data={heatmap} end={END} />
          </CardContent>
        </Card>
      </Section>

      <Section title="ProgressTimeline" note="stepped % per project">
        <Card>
          <CardContent>
            <ProgressTimeline projects={timeline} end={END} />
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

function Section({ title, note, className, children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 ${className ?? ""}`}>
      <h2 className="flex items-baseline gap-2 text-sm font-medium">
        {title}
        {note && <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{note}</span>}
      </h2>
      {children}
    </section>
  )
}
