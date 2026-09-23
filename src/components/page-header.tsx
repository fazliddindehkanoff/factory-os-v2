import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Shared page hero used across the web workspace (matches the dashboard header). */
export function HeaderDecor() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(0_102_255/0.08)_1px,transparent_0)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_60%)]" />
    </>
  )
}

export function PageHeader({ eyebrow, title, description, icon: Icon, leading, meta, actions, className }: {
  /** Replaces the icon tile, e.g. with an avatar. */
  leading?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("relative overflow-hidden rounded-2xl border bg-card px-5 py-5 shadow-xs md:px-6", className)}>
      <HeaderDecor />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {leading ?? (Icon ? (
            <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
              <Icon className="size-6" aria-hidden="true" />
            </span>
          ) : null)}
          <div className="min-w-0">
            {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
            {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export type StatTone = "default" | "primary" | "amber" | "red" | "emerald" | "sky"

const toneClasses: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: "bg-muted text-muted-foreground", value: "text-foreground" },
  primary: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  amber: { icon: "bg-amber-500/10 text-amber-700", value: "text-foreground" },
  red: { icon: "bg-red-500/10 text-red-600", value: "text-red-600" },
  emerald: { icon: "bg-emerald-500/10 text-emerald-700", value: "text-foreground" },
  sky: { icon: "bg-sky-500/10 text-sky-700", value: "text-foreground" },
}

/** Compact KPI tile; becomes a link when `href` is given. */
export function StatTile({ label, value, hint, icon: Icon, tone = "default", href, active }: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: StatTone
  href?: string
  active?: boolean
}) {
  const classes = toneClasses[tone]
  const body = (
    <>
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-medium leading-4 text-muted-foreground">{label}</p>
        <p className={cn("mt-1.5 whitespace-nowrap font-mono text-xl font-semibold tabular-nums tracking-tight sm:text-2xl md:text-3xl", classes.value)}>{value}</p>
        {hint ? <p className="mt-1 break-words text-[11px] leading-4 text-muted-foreground sm:text-xs">{hint}</p> : null}
      </div>
      {Icon ? (
        <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex", classes.icon)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
    </>
  )
  const className = cn(
    "flex min-w-0 items-start justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 shadow-xs",
    href && "transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active && "border-primary/50 ring-1 ring-primary/20",
  )
  return href
    ? <Link href={href} aria-current={active ? "page" : undefined} className={className}>{body}</Link>
    : <article className={className}>{body}</article>
}

/** Bordered surface for tables and panels. */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card shadow-xs", className)}>{children}</section>
}
