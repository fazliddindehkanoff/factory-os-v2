import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-[560px] bg-[#f4f6f9]">
      <div className="h-24 bg-[#1a2b4a] px-5 py-4">
        <Skeleton className="h-3 w-20 bg-white/10" />
        <Skeleton className="mt-3 h-5 w-44 bg-white/15" />
      </div>
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-[14px] bg-white" />)}
        </div>
        <div className="mt-6 grid gap-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-60 rounded-[14px] bg-white" />)}
        </div>
      </div>
    </main>
  )
}
