import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-muted px-4 py-6">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 grid gap-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-44 rounded-2xl" />)}
      </div>
    </main>
  )
}
