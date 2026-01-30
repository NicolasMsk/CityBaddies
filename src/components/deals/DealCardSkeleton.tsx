import { Skeleton } from "@/components/ui/Skeleton"

export default function DealCardSkeleton() {
  return (
    <div className="flex flex-col bg-[#0a0a0a] border border-white/10 h-full">
      {/* Image Container */}
      <div className="h-[220px] bg-[#050505] relative border-b border-white/5">
        <Skeleton className="w-full h-full bg-white/5 rounded-none" />
        
        {/* Fake Discount Badge */}
        <Skeleton className="absolute top-0 left-0 w-16 h-7 rounded-none bg-white/10" />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Brand & Meta */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-24 bg-white/10" />
          <Skeleton className="h-3 w-12 bg-white/5" />
        </div>

        {/* Title - 2 lines */}
        <div className="space-y-2 mb-6">
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-3/4 bg-white/10" />
        </div>
        
        {/* Price Section */}
        <div className="mt-auto pt-4 border-t border-white/5 flex items-end justify-between">
          <div className="space-y-2">
             <Skeleton className="h-3 w-12 bg-white/5" />
             <Skeleton className="h-7 w-20 bg-white/10" />
             <Skeleton className="h-3 w-16 bg-white/5" />
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-20 bg-white/5" />
            <Skeleton className="h-8 w-24 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
